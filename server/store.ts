import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  BookingQuote,
  EmailLog,
  HotelAmenity,
  HotelProfile,
  LoyaltyAccount,
  LoyaltyTier,
  PushNotificationItem,
  Reservation,
  RoomCategory,
  SeasonalPromotion,
} from '../src/types/hotel.ts';

export interface AdminCredential {
  passwordHash: string;
  salt: string;
  claimedAt: string;
}

export interface HotelDatabase {
  profile: HotelProfile;
  rooms: RoomCategory[];
  amenities: HotelAmenity[];
  reservations: Reservation[];
  emailLogs: EmailLog[];
  loyaltyAccounts: LoyaltyAccount[];
  promotions: SeasonalPromotion[];
  notifications: PushNotificationItem[];
  adminCredential: AdminCredential | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'hotel-db.json');

function addDaysIso(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function computeLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 3000) return 'Obsidian VIP';
  if (lifetimePoints >= 1000) return 'Gold Crown';
  return 'Spade Silver';
}

function createInitialDb(): HotelDatabase {
  const today = addDaysIso(0);
  const tomorrow = addDaysIso(1);
  const inThreeDays = addDaysIso(3);
  const inFiveDays = addDaysIso(5);
  const yesterday = addDaysIso(-1);

  return {
    profile: {
      name: 'Joker Hotel & Suites',
      location: 'Benin City, Edo',
      address: 'GRA Executive Boulevard, Benin City, Edo State, Nigeria',
      whatsappPhone: '0905 048 3401',
      email: 'reservations@jokerhotelsuites.com',
      flyerImageUrl: '/assets/aistudio/WhatsApp_Image_2026-11-26_at_4.34.50_AM_a7eab22c.jpeg',
      checkInTime: '14:00 WAT',
      checkOutTime: '12:00 WAT',
      ngnPerUsd: 1580,
    },
    rooms: [
      {
        id: 'room-classic',
        slug: 'classic-standard-room',
        name: 'Classic Standard Room',
        tier: 'Classic',
        tagline: 'Quiet sanctuary with Egyptian cotton bedding and breakfast.',
        description:
          'Tailored for solo business travelers and short Benin City stays. Features plush queen bedding, high-speed fiber Wi-Fi, 24/7 uninterrupted power, smart TV, and daily continental breakfast prepared by our kitchen team.',
        nightlyRateNgn: 45000,
        maxGuests: 2,
        bedConfig: '1 Queen Bed',
        sizeSqm: 28,
        totalUnits: 4,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/src/assets/images/room_classic_standard_1795697385308.jpg',
        amenities: [
          'Complimentary Continental Breakfast',
          '24/7 Power & Climate Control',
          'High-Speed Fiber Wi-Fi',
          '24/7 Uniformed Security',
        ],
        highlights: ['Queen bed', '28 m²', '2 Guests max', 'Breakfast included'],
      },
      {
        id: 'room-deluxe',
        slug: 'deluxe-executive-king',
        name: 'Deluxe Executive King',
        tier: 'Executive',
        tagline: 'Executive workspace, cognac leather reading lounge, and bar welcome.',
        description:
          'Designed for corporate executives visiting Edo State. Includes a handcrafted king bed, dark oak work desk, rainfall shower, 24-hour F&B room service, and a complimentary welcome cocktail at Joker Lounge & Bar.',
        nightlyRateNgn: 75000,
        maxGuests: 2,
        bedConfig: '1 King Bed',
        sizeSqm: 36,
        totalUnits: 4,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/src/assets/images/room_deluxe_king_1795697385690.jpg',
        amenities: [
          'Executive Oak Workstation',
          'Welcome Cocktail at Joker Lounge',
          '24-Hour F&B Room Service',
          'Express Laundry Service',
        ],
        highlights: ['King bed', '36 m²', '2 Guests max', 'Lounge welcome drink'],
      },
      {
        id: 'room-ambassador',
        slug: 'ambassadorial-junior-suite',
        name: 'Ambassadorial Junior Suite',
        tier: 'Suite',
        tagline: 'Separate timber-paneled parlour with Benin Airport chauffeur pickup.',
        description:
          'An expansive suite combining a private velvet entertaining parlour and serene king sleeping quarters. Includes complimentary Benin Airport chauffeur pickup by our experienced drivers and priority continental dining.',
        nightlyRateNgn: 120000,
        maxGuests: 3,
        bedConfig: '1 King Bed + Sofa Lounge',
        sizeSqm: 54,
        totalUnits: 3,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/src/assets/images/room_ambassador_suite_1795697387021.jpg',
        amenities: [
          'Complimentary Airport Chauffeur',
          'Separate Private Parlour',
          'Continental Chef Dining Credit',
          'Priority Check-In & Late Checkout',
        ],
        highlights: ['King + Parlour', '54 m²', '3 Guests max', 'Chauffeur pickup'],
      },
      {
        id: 'room-lounge',
        slug: 'joker-signature-lounge-suite',
        name: 'Joker Signature Lounge Suite',
        tier: 'Signature',
        tagline: 'Bespoke in-suite marble bar inspired by the Joker Evening Lounge.',
        description:
          'Our signature hospitality experience reflecting the warm amber atmosphere of Joker Hotel & Suites. Features an illuminated in-suite marble bar counter, Chester leather lounge seating, VIP table reservation at the main bar, and evening turndown service.',
        nightlyRateNgn: 185000,
        maxGuests: 3,
        bedConfig: '1 King Bed + Private Bar Salon',
        sizeSqm: 72,
        totalUnits: 2,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/src/assets/images/room_joker_lounge_suite_1795697386718.jpg',
        amenities: [
          'In-Suite Curated Marble Mini-Bar',
          'VIP Reserved Table at Joker Bar',
          'Private Chauffeur City Transfers',
          'Complimentary Full-Board Breakfast',
        ],
        highlights: ['King + Bar Salon', '72 m²', '3 Guests max', 'VIP Lounge access'],
      },
      {
        id: 'room-presidential',
        slug: 'royal-edo-presidential-suite',
        name: 'Royal Edo Presidential Suite',
        tier: 'Presidential',
        tagline: 'Two-bedroom residence with private dining salon and dedicated detail.',
        description:
          'The pinnacle of Benin City hospitality. Spanning an entire private wing with contemporary West African art, marble fireplace salon, two king suites, private Continental Chef dinner service, and dedicated chauffeur and security escort.',
        nightlyRateNgn: 320000,
        maxGuests: 4,
        bedConfig: '2 King Bedrooms + Grand Salon',
        sizeSqm: 128,
        totalUnits: 1,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/src/assets/images/room_royal_presidential_1795697388246.jpg',
        amenities: [
          'Private Continental Chef Dinner',
          'Dedicated Chauffeur & Security Escort',
          '24/7 Butler & F&B Supervisor Service',
          'Private Executive Boardroom Access',
        ],
        highlights: ['2 King Suites', '128 m²', '4 Guests max', 'Private chef & driver'],
      },
    ],
    amenities: [
      {
        id: 'amen-dining',
        title: 'Continental & Local Fine Dining',
        category: 'Culinary',
        description:
          'Curated continental breakfasts, grill plates, and traditional Edo delicacies prepared fresh daily by our Continental Chef and culinary brigade.',
        hours: '06:30 – 23:00 Daily',
        flyerDepartment: 'Continental Chef & Cooks',
      },
      {
        id: 'amen-lounge',
        title: 'Joker Evening Lounge & Bar',
        category: 'Lounge & F&B',
        description:
          'Signature warm-lit leather lounge serving aged spirits, craft cocktails, and small plates with attentive table service.',
        hours: '16:00 – 02:00 Daily',
        flyerDepartment: 'F&B Supervisor & Wait Staff',
      },
      {
        id: 'amen-chauffeur',
        title: 'Chauffeur & Airport Shuttle',
        category: 'Transport',
        description:
          'Punctual Benin Airport pickups and executive city transfers operated by vetted, experienced hotel drivers.',
        hours: '24/7 On Request',
        flyerDepartment: 'Experienced Drivers',
      },
      {
        id: 'amen-security',
        title: '24/7 Uniformed Security & CCTV',
        category: 'Safety',
        description:
          'Round-the-clock perimeter access control, monitored CCTV coverage, and trained on-site security personnel.',
        hours: '24/7 Continuous',
        flyerDepartment: 'Security Personnel',
      },
      {
        id: 'amen-concierge',
        title: 'Digital Reservations & Concierge',
        category: 'Guest Services',
        description:
          'Instant online booking confirmation, itemized corporate invoicing, and WhatsApp concierge support on 0905 048 3401.',
        hours: '24/7 Live Desk',
        flyerDepartment: 'Online Reservations & Accounts',
      },
      {
        id: 'amen-housekeeping',
        title: 'Express Room Service & Care',
        category: 'In-Room',
        description:
          'Twice-daily housekeeping, turndown amenities, and 24-hour in-room dining delivered directly to your suite.',
        hours: '24/7 Service',
        flyerDepartment: 'Hospitality & Storekeeping',
      },
    ],
    reservations: [
      {
        id: 'res-seed-1',
        bookingRef: 'JHS-2611-8402',
        roomId: 'room-lounge',
        roomName: 'Joker Signature Lounge Suite',
        guestName: 'Osahon Igbinedion',
        guestEmail: 'uzorbenny51@gmail.com',
        guestPhone: '+234 803 551 9024',
        checkIn: tomorrow,
        checkOut: inThreeDays,
        nights: 2,
        guestsCount: 2,
        specialRequests: 'Late evening lounge table reservation for 20:30.',
        airportPickup: true,
        subtotalNgn: 370000,
        serviceFeeNgn: 27750,
        promoDiscountNgn: 0,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 397750,
        paymentMethod: 'card',
        paymentRef: 'PAY-JHS-908412',
        cardLast4: '4242',
        cardBrand: 'Visa',
        paymentStatus: 'paid',
        status: 'confirmed',
        pointsEarned: 397,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 86400000).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'res-seed-2',
        bookingRef: 'JHS-2611-7319',
        roomId: 'room-deluxe',
        roomName: 'Deluxe Executive King',
        guestName: 'Efosa Obaseki',
        guestEmail: 'efosa.obaseki@example.com',
        guestPhone: '+234 809 224 1870',
        checkIn: yesterday,
        checkOut: tomorrow,
        nights: 2,
        guestsCount: 1,
        specialRequests: 'Quiet high-floor room, morning coffee at 07:00.',
        airportPickup: false,
        subtotalNgn: 150000,
        serviceFeeNgn: 11250,
        promoDiscountNgn: 0,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 161250,
        paymentMethod: 'bank_transfer',
        paymentRef: 'TRF-JHS-663201',
        paymentStatus: 'paid',
        status: 'checked_in',
        pointsEarned: 161,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 172800000).toISOString(),
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: 'res-seed-3',
        bookingRef: 'JHS-2611-5920',
        roomId: 'room-ambassador',
        roomName: 'Ambassadorial Junior Suite',
        guestName: 'Adesuwa Egharevba',
        guestEmail: 'adesuwa.e@example.com',
        guestPhone: '+234 812 904 3311',
        checkIn: today,
        checkOut: inFiveDays,
        nights: 5,
        guestsCount: 2,
        specialRequests: 'Benin Airport pickup on arrival.',
        airportPickup: true,
        subtotalNgn: 600000,
        serviceFeeNgn: 45000,
        promoDiscountNgn: 90000,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 555000,
        paymentMethod: 'card',
        paymentRef: 'PAY-JHS-552104',
        cardLast4: '8819',
        cardBrand: 'Mastercard',
        paymentStatus: 'paid',
        status: 'checked_in',
        pointsEarned: 555,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 259200000).toISOString(),
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 21600000).toISOString(),
      },
    ],
    emailLogs: [
      {
        id: 'mail-seed-1',
        bookingRef: 'JHS-2611-8402',
        toEmail: 'uzorbenny51@gmail.com',
        guestName: 'Osahon Igbinedion',
        subject: 'Reservation Confirmed · Joker Hotel & Suites (JHS-2611-8402)',
        bodyText: `Dear Osahon Igbinedion,\n\nYour reservation JHS-2611-8402 for Joker Signature Lounge Suite (${tomorrow} to ${inThreeDays}) is confirmed.\nTotal Paid: NGN 397,750\nCheck-in: 14:00 WAT · Benin City, Edo.\nWhatsApp Concierge: 0905 048 3401`,
        bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#F7F5F0;color:#14120F"><h2>Reservation Confirmed: JHS-2611-8402</h2><p>Dear Osahon Igbinedion, thank you for choosing Joker Hotel &amp; Suites, Benin City, Edo.</p><p><strong>Suite:</strong> Joker Signature Lounge Suite<br/><strong>Stay:</strong> ${tomorrow} to ${inThreeDays} (2 nights)<br/><strong>Total Paid:</strong> ₦397,750</p><p>Need airport chauffeur assistance? Message us on WhatsApp at <strong>0905 048 3401</strong>.</p></div>`,
        deliveryMode: 'dispatch_log',
        status: 'sent',
        sentAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    loyaltyAccounts: [
      {
        memberId: 'JHS-RC-8841',
        guestEmail: 'uzorbenny51@gmail.com',
        guestName: 'Osahon Igbinedion',
        points: 1450,
        lifetimePoints: 1850,
        tier: 'Gold Crown',
        history: [
          {
            id: 'loy-1',
            date: new Date(Date.now() - 86400000).toISOString(),
            description: 'Stay Points Earned · Joker Signature Lounge Suite',
            pointsDelta: 397,
            bookingRef: 'JHS-2611-8402',
          },
          {
            id: 'loy-2',
            date: new Date(Date.now() - 1209600000).toISOString(),
            description: 'Gold Crown Tier Welcome Bonus',
            pointsDelta: 500,
          },
          {
            id: 'loy-3',
            date: new Date(Date.now() - 2592000000).toISOString(),
            description: 'Ambassadorial Suite Weekend Stay',
            pointsDelta: 953,
          },
        ],
      },
    ],
    promotions: [
      {
        id: 'promo-1',
        title: 'Edo Heritage Festive Escape — 15% Off Suites',
        code: 'BENIN15',
        discountPercent: 15,
        validUntil: addDaysIso(35),
        description:
          'Save 15% on Ambassadorial, Signature Lounge, and Presidential Suites with complimentary airport chauffeur pickup.',
        category: 'Seasonal Offer',
        active: true,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 'promo-2',
        title: 'Executive Lounge & Continental Dinner Package',
        code: 'LOUNGE10',
        discountPercent: 10,
        validUntil: addDaysIso(21),
        description:
          'Enjoy 10% off Executive King and Lounge Suites plus priority evening seating at Joker Bar & Grill.',
        category: 'Lounge & Dining',
        active: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    notifications: [
      {
        id: 'notif-seed-1',
        title: 'Upcoming Check-In Tomorrow · JHS-2611-8402',
        body: `Your Joker Signature Lounge Suite is being prepared for check-in tomorrow (${tomorrow}) at 14:00 WAT. Tap to confirm airport chauffeur pickup.`,
        category: 'booking_reminder',
        bookingRef: 'JHS-2611-8402',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'notif-seed-2',
        title: 'Seasonal Offer: 15% Off Suites (BENIN15)',
        body: 'Book any Ambassadorial or Signature Lounge Suite before season close and unlock 15% savings plus complimentary airport pickup.',
        category: 'promotion',
        promoCode: 'BENIN15',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    adminCredential: null,
  };
}

let cachedDb: HotelDatabase | null = null;

export function loadDb(): HotelDatabase {
  if (cachedDb) return cachedDb;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      cachedDb = JSON.parse(raw) as HotelDatabase;
      return cachedDb;
    }
  } catch (err) {
    console.error('Failed to load hotel-db.json, seeding fresh store:', err);
  }
  cachedDb = createInitialDb();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: HotelDatabase): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function getNightsCount(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

export function getAvailableUnitsForDates(
  db: HotelDatabase,
  room: RoomCategory,
  checkIn?: string,
  checkOut?: string
): number {
  if (room.status !== 'available') return 0;
  const effectiveTotal = Math.max(0, room.totalUnits - room.maintenanceUnits);
  if (!checkIn || !checkOut || getNightsCount(checkIn, checkOut) <= 0) {
    // Default view: check occupancy against today's active stays
    const today = addDaysIso(0);
    const tomorrow = addDaysIso(1);
    const activeOccupied = db.reservations.filter(
      (r) =>
        r.roomId === room.id &&
        (r.status === 'confirmed' || r.status === 'checked_in') &&
        datesOverlap(r.checkIn, r.checkOut, today, tomorrow)
    ).length;
    return Math.max(0, effectiveTotal - activeOccupied);
  }
  const overlapping = db.reservations.filter(
    (r) =>
      r.roomId === room.id &&
      (r.status === 'confirmed' || r.status === 'checked_in') &&
      datesOverlap(r.checkIn, r.checkOut, checkIn, checkOut)
  ).length;
  return Math.max(0, effectiveTotal - overlapping);
}

export function calculateQuote(
  db: HotelDatabase,
  params: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    guestEmail?: string;
    redeemPoints?: number;
    promoCode?: string;
  }
): BookingQuote {
  const room = db.rooms.find((r) => r.id === params.roomId);
  if (!room) {
    throw new Error('Selected room category was not found.');
  }
  const nights = getNightsCount(params.checkIn, params.checkOut);
  if (nights <= 0 || nights > 60) {
    throw new Error('Check-out date must be after check-in date (max 60 nights).');
  }
  const availableUnits = getAvailableUnitsForDates(db, room, params.checkIn, params.checkOut);
  const subtotalNgn = room.nightlyRateNgn * nights;
  const serviceFeeNgn = Math.round(subtotalNgn * 0.075);

  let promoDiscountNgn = 0;
  let appliedPromoCode: string | undefined;
  const code = params.promoCode?.trim().toUpperCase();
  if (code) {
    const promo = db.promotions.find((p) => p.active && p.code.toUpperCase() === code);
    if (promo) {
      promoDiscountNgn = Math.round(subtotalNgn * (promo.discountPercent / 100));
      appliedPromoCode = promo.code;
    }
  }

  let pointsToRedeem = 0;
  let loyaltyDiscountNgn = 0;
  if (params.guestEmail && params.redeemPoints && params.redeemPoints > 0) {
    const account = db.loyaltyAccounts.find(
      (a) => a.guestEmail.toLowerCase() === params.guestEmail!.trim().toLowerCase()
    );
    if (account && account.points > 0) {
      // 1 point = NGN 15 discount, capped at 30% of subtotal
      const maxDiscount = Math.round(subtotalNgn * 0.3);
      const maxPointsByCap = Math.floor(maxDiscount / 15);
      pointsToRedeem = Math.min(Math.floor(params.redeemPoints), account.points, maxPointsByCap);
      loyaltyDiscountNgn = pointsToRedeem * 15;
    }
  }

  const totalNgn = Math.max(0, subtotalNgn + serviceFeeNgn - promoDiscountNgn - loyaltyDiscountNgn);
  // 10 points per ₦10,000 -> 1 point per ₦1,000
  const pointsToEarn = Math.max(10, Math.floor(totalNgn / 1000));

  return {
    roomId: room.id,
    roomName: room.name,
    nights,
    nightlyRateNgn: room.nightlyRateNgn,
    subtotalNgn,
    serviceFeeNgn,
    promoDiscountNgn,
    loyaltyDiscountNgn,
    pointsToRedeem,
    totalNgn,
    pointsToEarn,
    availableUnits,
    appliedPromoCode,
  };
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
