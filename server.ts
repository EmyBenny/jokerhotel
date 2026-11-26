import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  calculateQuote,
  computeLoyaltyTier,
  getAvailableUnitsForDates,
  hashPassword,
  loadDb,
  saveDb,
  verifyPassword,
} from './server/store.ts';
import { dispatchConfirmationEmail } from './server/mailer.ts';
import type {
  PaymentMethod,
  PushNotificationItem,
  Reservation,
  ReservationStatus,
  RoomStatus,
} from './src/types/hotel.ts';

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface PaymentIntentRecord {
  intentId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guestEmail: string;
  redeemPoints: number;
  promoCode?: string;
  amountNgn: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  cardLast4?: string;
  cardBrand?: string;
  virtualAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  verified: boolean;
  createdAt: number;
}

const paymentIntents = new Map<string, PaymentIntentRecord>();

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (Number.isNaN(d)) return false;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
}

function detectCardBrand(digits: string): string {
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^506|^650/.test(digits)) return 'Verve';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Card';
}

function signAdminToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastEvent(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connection:ready', timestamp: new Date().toISOString() }));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'joker-hotel-suites' });
  });

  app.get('/api/hotel/bootstrap', (req, res) => {
    const db = loadDb();
    const checkIn = typeof req.query.checkIn === 'string' ? req.query.checkIn : undefined;
    const checkOut = typeof req.query.checkOut === 'string' ? req.query.checkOut : undefined;

    const rooms = db.rooms.map((room) => ({
      ...room,
      availableUnits: getAvailableUnitsForDates(db, room, checkIn, checkOut),
    }));

    const dailyAvailability = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + idx);
      const dayIso = day.toISOString().slice(0, 10);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextIso = nextDay.toISOString().slice(0, 10);

      let availableSuites = 0;
      let lowestRateNgn = Infinity;
      for (const r of db.rooms) {
        const free = getAvailableUnitsForDates(db, r, dayIso, nextIso);
        availableSuites += free;
        if (free > 0 && r.nightlyRateNgn < lowestRateNgn) {
          lowestRateNgn = r.nightlyRateNgn;
        }
      }
      return {
        date: dayIso,
        availableSuites,
        lowestRateNgn: Number.isFinite(lowestRateNgn) ? lowestRateNgn : db.rooms[0]?.nightlyRateNgn || 45000,
      };
    });

    res.json({
      profile: db.profile,
      rooms,
      amenities: db.amenities,
      promotions: db.promotions.filter((p) => p.active),
      notifications: db.notifications.slice(0, 20),
      dailyAvailability,
    });
  });

  app.post('/api/bookings/quote', (req, res) => {
    try {
      const db = loadDb();
      const { roomId, checkIn, checkOut, guestEmail, redeemPoints, promoCode } = req.body as {
        roomId: string;
        checkIn: string;
        checkOut: string;
        guestEmail?: string;
        redeemPoints?: number;
        promoCode?: string;
      };
      const quote = calculateQuote(db, {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
      });
      res.json({ quote });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid quote request.' });
    }
  });

  app.post('/api/payments/create-intent', (req, res) => {
    try {
      const db = loadDb();
      const {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
        paymentMethod,
        cardNumber,
        cardExpiry,
        cardCvc,
      } = req.body as {
        roomId: string;
        checkIn: string;
        checkOut: string;
        guestEmail: string;
        redeemPoints?: number;
        promoCode?: string;
        paymentMethod: PaymentMethod;
        cardNumber?: string;
        cardExpiry?: string;
        cardCvc?: string;
      };

      if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        res.status(400).json({ error: 'A valid guest email address is required for confirmation.' });
        return;
      }

      const quote = calculateQuote(db, {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
      });

      if (quote.availableUnits <= 0) {
        res.status(409).json({ error: 'Selected suite has no available units for these dates.' });
        return;
      }

      const intentId = `pi_${crypto.randomBytes(10).toString('hex')}`;
      const paymentRef = `JHS-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      let cardLast4: string | undefined;
      let cardBrand: string | undefined;
      let virtualAccount: PaymentIntentRecord['virtualAccount'];

      if (paymentMethod === 'card') {
        const cleanDigits = (cardNumber || '').replace(/\D/g, '');
        if (!passesLuhn(cleanDigits)) {
          res.status(400).json({ error: 'Please enter a valid card number.' });
          return;
        }
        const expMatch = (cardExpiry || '').trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
        if (!expMatch) {
          res.status(400).json({ error: 'Card expiry must be in MM/YY format.' });
          return;
        }
        const expMonth = Number(expMatch[1]);
        const expYear = 2000 + Number(expMatch[2]);
        const now = new Date();
        if (expMonth < 1 || expMonth > 12 || expYear < now.getUTCFullYear() || (expYear === now.getUTCFullYear() && expMonth < now.getUTCMonth() + 1)) {
          res.status(400).json({ error: 'Card has expired. Please use an active card.' });
          return;
        }
        const cleanCvc = (cardCvc || '').replace(/\D/g, '');
        if (cleanCvc.length < 3 || cleanCvc.length > 4) {
          res.status(400).json({ error: 'Security CVC must be 3 or 4 digits.' });
          return;
        }
        cardLast4 = cleanDigits.slice(-4);
        cardBrand = detectCardBrand(cleanDigits);
      } else if (paymentMethod === 'bank_transfer') {
        virtualAccount = {
          bankName: 'Providus Bank · Joker Hospitality Escrow',
          accountNumber: `99${Math.floor(10000000 + Math.random() * 89999999)}`,
          accountName: 'Joker Hotel & Suites Benin',
        };
      }

      const record: PaymentIntentRecord = {
        intentId,
        roomId,
        checkIn,
        checkOut,
        guestEmail: guestEmail.trim().toLowerCase(),
        redeemPoints: quote.pointsToRedeem,
        promoCode: quote.appliedPromoCode,
        amountNgn: quote.totalNgn,
        paymentMethod,
        paymentRef,
        cardLast4,
        cardBrand,
        virtualAccount,
        verified: true,
        createdAt: Date.now(),
      };
      paymentIntents.set(intentId, record);

      res.json({
        intentId,
        paymentRef,
        amountNgn: quote.totalNgn,
        cardLast4,
        cardBrand,
        virtualAccount,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to initialize payment.' });
    }
  });

  app.post('/api/bookings/confirm', async (req, res) => {
    try {
      const db = loadDb();
      const {
        intentId,
        guestName,
        guestPhone,
        guestsCount,
        specialRequests,
        airportPickup,
      } = req.body as {
        intentId: string;
        guestName: string;
        guestPhone: string;
        guestsCount: number;
        specialRequests?: string;
        airportPickup?: boolean;
      };

      const intent = paymentIntents.get(intentId);
      if (!intent || !intent.verified || Date.now() - intent.createdAt > 1000 * 60 * 30) {
        res.status(400).json({ error: 'Payment session expired or invalid. Please re-verify payment.' });
        return;
      }

      if (!guestName?.trim() || !guestPhone?.trim()) {
        res.status(400).json({ error: 'Guest full name and phone number are required.' });
        return;
      }

      const quote = calculateQuote(db, {
        roomId: intent.roomId,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        guestEmail: intent.guestEmail,
        redeemPoints: intent.redeemPoints,
        promoCode: intent.promoCode,
      });

      if (quote.availableUnits <= 0) {
        res.status(409).json({ error: 'This suite was just booked by another guest. Please select another suite or date.' });
        return;
      }

      const room = db.rooms.find((r) => r.id === intent.roomId)!;
      const clampedGuests = Math.max(1, Math.min(room.maxGuests, Number(guestsCount) || 1));
      const nowIso = new Date().toISOString();
      const bookingRef = `JHS-${new Date().toISOString().slice(2, 7).replace('-', '')}-${crypto.randomInt(1000, 9999)}`;

      const reservation: Reservation = {
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        bookingRef,
        roomId: room.id,
        roomName: room.name,
        guestName: guestName.trim(),
        guestEmail: intent.guestEmail,
        guestPhone: guestPhone.trim(),
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        nights: quote.nights,
        guestsCount: clampedGuests,
        specialRequests: (specialRequests || '').trim(),
        airportPickup: Boolean(airportPickup),
        promoCode: quote.appliedPromoCode,
        subtotalNgn: quote.subtotalNgn,
        serviceFeeNgn: quote.serviceFeeNgn,
        promoDiscountNgn: quote.promoDiscountNgn,
        loyaltyDiscountNgn: quote.loyaltyDiscountNgn,
        totalPaidNgn: quote.totalNgn,
        paymentMethod: intent.paymentMethod,
        paymentRef: intent.paymentRef,
        cardLast4: intent.cardLast4,
        cardBrand: intent.cardBrand,
        paymentStatus: intent.paymentMethod === 'pay_at_hotel' ? 'guaranteed_hold' : 'paid',
        status: 'confirmed',
        pointsEarned: quote.pointsToEarn,
        pointsRedeemed: quote.pointsToRedeem,
        emailConfirmedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Consume payment intent so it cannot be replayed
      paymentIntents.delete(intentId);

      // Persist reservation
      db.reservations.unshift(reservation);

      // Update or create Loyalty Account
      let loyalty = db.loyaltyAccounts.find(
        (a) => a.guestEmail.toLowerCase() === intent.guestEmail.toLowerCase()
      );
      if (!loyalty) {
        loyalty = {
          memberId: `JHS-RC-${crypto.randomInt(1000, 9999)}`,
          guestEmail: intent.guestEmail,
          guestName: guestName.trim(),
          points: 0,
          lifetimePoints: 0,
          tier: 'Spade Silver',
          history: [],
        };
        db.loyaltyAccounts.push(loyalty);
      } else {
        loyalty.guestName = guestName.trim();
      }

      if (quote.pointsToRedeem > 0) {
        loyalty.points = Math.max(0, loyalty.points - quote.pointsToRedeem);
        loyalty.history.unshift({
          id: `loy-${crypto.randomUUID().slice(0, 6)}`,
          date: nowIso,
          description: `Points Redeemed · ${room.name}`,
          pointsDelta: -quote.pointsToRedeem,
          bookingRef,
        });
      }

      loyalty.points += quote.pointsToEarn;
      loyalty.lifetimePoints += quote.pointsToEarn;
      loyalty.tier = computeLoyaltyTier(loyalty.lifetimePoints);
      loyalty.history.unshift({
        id: `loy-${crypto.randomUUID().slice(0, 6)}`,
        date: nowIso,
        description: `Stay Points Earned · ${room.name}`,
        pointsDelta: quote.pointsToEarn,
        bookingRef,
      });

      // Dispatch automated email confirmation
      const emailLog = await dispatchConfirmationEmail(reservation, db.profile);
      db.emailLogs.unshift(emailLog);

      // Create automated push notification for confirmed reservation & check-in reminder
      const notification: PushNotificationItem = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        title: `Booking Confirmed · ${bookingRef}`,
        body: `${room.name} reserved for ${intent.checkIn} to ${intent.checkOut}. Confirmation email sent to ${intent.guestEmail}.`,
        category: 'reservation',
        bookingRef,
        createdAt: nowIso,
      };
      db.notifications.unshift(notification);

      saveDb(db);

      const updatedRooms = db.rooms.map((r) => ({
        ...r,
        availableUnits: getAvailableUnitsForDates(db, r),
      }));

      broadcastEvent('reservation:created', { reservation, emailLog });
      broadcastEvent('availability:updated', { rooms: updatedRooms });
      broadcastEvent('notification:push', notification);

      res.status(201).json({
        reservation,
        emailLog,
        loyalty,
        notification,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to confirm reservation.' });
    }
  });

  app.get('/api/guest/overview', (req, res) => {
    const db = loadDb();
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    if (!email) {
      res.json({
        reservations: [],
        loyalty: db.loyaltyAccounts[0] || null,
        emailLogs: [],
        notifications: db.notifications.slice(0, 15),
        promotions: db.promotions.filter((p) => p.active),
      });
      return;
    }

    const reservations = db.reservations.filter(
      (r) => r.guestEmail.toLowerCase() === email
    );
    const loyalty =
      db.loyaltyAccounts.find((a) => a.guestEmail.toLowerCase() === email) || {
        memberId: 'NEW-MEMBER',
        guestEmail: email,
        guestName: reservations[0]?.guestName || 'Valued Guest',
        points: 0,
        lifetimePoints: 0,
        tier: 'Spade Silver' as const,
        history: [],
      };
    const emailLogs = db.emailLogs.filter((e) => e.toEmail.toLowerCase() === email);

    res.json({
      reservations,
      loyalty,
      emailLogs,
      notifications: db.notifications.slice(0, 20),
      promotions: db.promotions.filter((p) => p.active),
    });
  });

  app.post('/api/guest/check-reminders', (req, res) => {
    const db = loadDb();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const upcoming = db.reservations.find(
      (r) =>
        (!email || r.guestEmail.toLowerCase() === email) &&
        r.status === 'confirmed'
    );
    if (!upcoming) {
      res.json({ reminder: null });
      return;
    }
    const reminder: PushNotificationItem = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      title: `Upcoming Check-In Reminder · ${upcoming.bookingRef}`,
      body: `We look forward to welcoming ${upcoming.guestName} to ${upcoming.roomName} on ${upcoming.checkIn} at 14:00 WAT.`,
      category: 'booking_reminder',
      bookingRef: upcoming.bookingRef,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(reminder);
    saveDb(db);
    broadcastEvent('notification:push', reminder);
    res.json({ reminder });
  });

  // Admin Auth Routes
  app.get('/api/admin/auth/status', (_req, res) => {
    const db = loadDb();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    res.json({
      configured: Boolean(envPasscode || db.adminCredential),
      envManaged: Boolean(envPasscode),
    });
  });

  app.post('/api/admin/auth/setup', (req, res) => {
    const db = loadDb();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode || db.adminCredential) {
      res.status(409).json({ error: 'Admin passcode is already configured. Please sign in.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (password.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }
    const { hash, salt } = hashPassword(password);
    db.adminCredential = {
      passwordHash: hash,
      salt,
      claimedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ token: signAdminToken() });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const db = loadDb();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();

    if (envPasscode) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPasscode);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
      res.json({ token: signAdminToken() });
      return;
    }

    if (!db.adminCredential) {
      res.status(400).json({ error: 'Admin passcode has not been claimed yet.' });
      return;
    }

    if (!verifyPassword(password, db.adminCredential.passwordHash, db.adminCredential.salt)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    res.json({ token: signAdminToken() });
  });

  // Protected Admin Endpoints
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = loadDb();
    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    res.json({
      rooms,
      reservations: db.reservations,
      emailLogs: db.emailLogs,
      promotions: db.promotions,
      loyaltyAccounts: db.loyaltyAccounts,
    });
  });

  app.patch('/api/admin/reservations/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const target = db.reservations.find((r) => r.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Reservation not found.' });
      return;
    }
    const status = req.body?.status as ReservationStatus | undefined;
    if (!status || !['confirmed', 'checked_in', 'checked_out', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid reservation status.' });
      return;
    }
    target.status = status;
    if (status === 'cancelled' && target.paymentStatus === 'paid') {
      target.paymentStatus = 'refunded';
    }
    target.updatedAt = new Date().toISOString();
    saveDb(db);

    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    broadcastEvent('reservation:updated', { reservation: target });
    broadcastEvent('availability:updated', { rooms });

    res.json({ reservation: target, rooms });
  });

  app.patch('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room category not found.' });
      return;
    }
    const { nightlyRateNgn, totalUnits, maintenanceUnits, status } = req.body as {
      nightlyRateNgn?: number;
      totalUnits?: number;
      maintenanceUnits?: number;
      status?: RoomStatus;
    };

    if (typeof nightlyRateNgn === 'number' && nightlyRateNgn >= 10000) {
      room.nightlyRateNgn = Math.round(nightlyRateNgn);
    }
    if (typeof totalUnits === 'number' && totalUnits >= 1 && totalUnits <= 50) {
      room.totalUnits = Math.round(totalUnits);
    }
    if (typeof maintenanceUnits === 'number' && maintenanceUnits >= 0) {
      room.maintenanceUnits = Math.min(room.totalUnits, Math.round(maintenanceUnits));
    }
    if (status && ['available', 'maintenance', 'sold_out'].includes(status)) {
      room.status = status;
    }

    saveDb(db);

    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    broadcastEvent('availability:updated', { rooms });

    res.json({ room: { ...room, availableUnits: getAvailableUnitsForDates(db, room) }, rooms });
  });

  app.post('/api/admin/promotions', requireAdmin, (req, res) => {
    const db = loadDb();
    const { title, code, discountPercent, validUntil, description, category } = req.body as {
      title: string;
      code: string;
      discountPercent: number;
      validUntil: string;
      description: string;
      category: 'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape';
    };

    if (!title?.trim() || !code?.trim()) {
      res.status(400).json({ error: 'Promotion title and promo code are required.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const promo = {
      id: `promo-${crypto.randomUUID().slice(0, 6)}`,
      title: title.trim(),
      code: code.trim().toUpperCase(),
      discountPercent: Math.max(5, Math.min(50, Number(discountPercent) || 10)),
      validUntil: validUntil || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
      description: (description || '').trim(),
      category: category || 'Seasonal Offer',
      active: true,
      createdAt: nowIso,
    };
    db.promotions.unshift(promo);

    const notification: PushNotificationItem = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      title: `${promo.title} (${promo.code})`,
      body: promo.description || `Unlock ${promo.discountPercent}% off your next stay with code ${promo.code}.`,
      category: 'promotion',
      promoCode: promo.code,
      createdAt: nowIso,
    };
    db.notifications.unshift(notification);
    saveDb(db);

    broadcastEvent('promotion:published', { promo, promotions: db.promotions.filter((p) => p.active) });
    broadcastEvent('notification:push', notification);

    res.status(201).json({ promo, notification });
  });

  app.delete('/api/admin/promotions/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const promo = db.promotions.find((p) => p.id === req.params.id);
    if (!promo) {
      res.status(404).json({ error: 'Promotion not found.' });
      return;
    }
    promo.active = false;
    saveDb(db);
    broadcastEvent('promotion:published', { promotions: db.promotions.filter((p) => p.active) });
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Joker Hotel & Suites server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
