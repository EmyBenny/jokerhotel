import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Mail,
  Sparkles,
  Tag,
} from 'lucide-react';
import type {
  EmailLog,
  LoyaltyAccount,
  PushNotificationItem,
  Reservation,
  SeasonalPromotion,
} from '../types/hotel.ts';
import { usePushPermission } from '../hooks/usePWAInstall.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';

interface LoyaltyMobileViewProps {
  activeGuestEmail: string;
  onChangeGuestEmail: (email: string) => void;
  notifications: PushNotificationItem[];
  promotions: SeasonalPromotion[];
  currency: CurrencyCode;
  ngnPerUsd: number;
  onApplyPromoAndBook: (promoCode: string) => void;
  onNewNotification: (notif: PushNotificationItem) => void;
}

export const LoyaltyMobileView: React.FC<LoyaltyMobileViewProps> = ({
  activeGuestEmail,
  onChangeGuestEmail,
  notifications,
  promotions,
  currency,
  ngnPerUsd,
  onApplyPromoAndBook,
  onNewNotification,
}) => {
  const [emailInput, setEmailInput] = useState(activeGuestEmail);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [reminderStatus, setReminderStatus] = useState('');

  const { permission, requestPermission, showDeviceNotification } = usePushPermission();

  const fetchGuestOverview = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guest/overview?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setLoyalty(data.loyalty || null);
      setReservations(data.reservations || []);
      setEmailLogs(data.emailLogs || []);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setEmailInput(activeGuestEmail);
    fetchGuestOverview(activeGuestEmail);
  }, [activeGuestEmail, fetchGuestOverview]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    onChangeGuestEmail(emailInput.trim().toLowerCase());
  };

  const handleEnablePush = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      await showDeviceNotification(
        'Joker Hotel & Suites Alerts Active',
        'You will receive real-time check-in reminders and Benin City seasonal suite offers.',
        'jhs-welcome'
      );
    }
  };

  const handleTriggerCheckInReminder = async () => {
    setReminderStatus('');
    try {
      const res = await fetch('/api/guest/check-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeGuestEmail }),
      });
      const data = await res.json();
      if (data.reminder) {
        onNewNotification(data.reminder);
        await showDeviceNotification(data.reminder.title, data.reminder.body, data.reminder.id);
        setReminderStatus('Upcoming check-in alert dispatched.');
      } else {
        setReminderStatus('No confirmed upcoming stays found for this email yet.');
      }
    } catch {
      setReminderStatus('Unable to dispatch reminder right now.');
    }
  };

  const nextTierTarget =
    loyalty?.tier === 'Spade Silver' ? 1000 : loyalty?.tier === 'Gold Crown' ? 3000 : 3000;
  const progressRatio = loyalty
    ? Math.min(1, loyalty.lifetimePoints / nextTierTarget)
    : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Member Switcher */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#7A5908]/20 pb-6 dark:border-[#D4AF37]/20 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold text-[#7D5604] dark:text-[#D4AF37]">Mobile PWA &amp; Guest Loyalty</p>
          <h2 className="mt-1 font-editorial text-3xl font-semibold text-[#161106] dark:text-[#F8ECCB] sm:text-4xl">
            Joker Royal Club &amp; Alerts
          </h2>
          <p className="mt-1.5 text-sm text-[#3E3010] dark:text-[#DECFA8]">
            Earn 1 point per ₦1,000 spent, redeem directly at checkout, and receive instant push alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PWAInstallButton variant="light" />
          <form onSubmit={handleLookup} className="flex items-center gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Guest email lookup"
              aria-label="Guest email lookup"
              className="h-11 rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-[#161106] px-4 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158] whitespace-nowrap"
            >
              Load Profile
            </button>
          </form>
        </div>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Loyalty Membership Card & Tier Progress */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1B1508] to-[#120D05] p-6 text-white shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#E5C158]">Joker Royal Club</p>
                <h3 className="mt-1 font-editorial text-2xl font-semibold">
                  {loyalty?.tier || 'Spade Silver'}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-[#F5E7BA]/65">
                  {loyalty?.memberId || 'JHS-MEMBER'} · {activeGuestEmail}
                </p>
              </div>

              {/* SVG Progress Ring */}
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    fill="none"
                    stroke="rgba(212,175,55,0.2)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="tabular-nums text-sm font-bold text-white">
                    {Math.round(progressRatio * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#D4AF37]/20 pt-5">
              <div>
                <p className="text-xs text-[#F5E7BA]/65">Redeemable Points</p>
                <p className="mt-1 tabular-nums text-2xl font-bold text-[#E5C158]">
                  {(loyalty?.points || 0).toLocaleString()} pts
                </p>
                <p className="text-xs text-[#F5E7BA]/65">
                  Worth {formatMoney((loyalty?.points || 0) * 15, currency, ngnPerUsd)} at checkout
                </p>
              </div>
              <div>
                <p className="text-xs text-[#F5E7BA]/65">Lifetime Tier Points</p>
                <p className="mt-1 tabular-nums text-2xl font-bold text-white">
                  {(loyalty?.lifetimePoints || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#F5E7BA]/65">
                  {loyalty?.tier === 'Obsidian VIP'
                    ? 'Top VIP tier unlocked'
                    : `${Math.max(0, nextTierTarget - (loyalty?.lifetimePoints || 0)).toLocaleString()} pts to next tier`}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#D4AF37]/20 pt-4 text-xs text-[#F5E7BA]/80">
              <div>
                <p className="font-semibold text-white">Spade Silver</p>
                <p className="text-[#F5E7BA]/60">0+ pts · Priority desk</p>
              </div>
              <div>
                <p className="font-semibold text-[#E5C158]">Gold Crown</p>
                <p className="text-[#F5E7BA]/60">1,000+ · 10% dining</p>
              </div>
              <div>
                <p className="font-semibold text-white">Obsidian VIP</p>
                <p className="text-[#F5E7BA]/60">3,000+ · Chauffeur</p>
              </div>
            </div>
          </div>

          {/* Points Activity Ledger */}
          <div className="rounded-2xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#1B160B]">
            <div className="flex items-center justify-between border-b border-[#7A5908]/15 pb-3 dark:border-[#D4AF37]/15">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">
                <Award className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                <span>Points Activity</span>
              </h3>
              <span className="text-xs text-[#5F4A17] dark:text-[#CBB887]">1 pt = ₦15 credit</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-[#5F4A17] dark:text-[#CBB887]">Loading rewards ledger...</p>
            ) : !loyalty || loyalty.history.length === 0 ? (
              <p className="py-6 text-sm text-[#5F4A17] dark:text-[#CBB887]">
                Complete your first reservation with {activeGuestEmail} to earn Royal Club points.
              </p>
            ) : (
              <ul className="divide-y divide-[#7A5908]/15 dark:divide-[#D4AF37]/15">
                {loyalty.history.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#161106] dark:text-[#F8ECCB]">{entry.description}</p>
                      <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">
                        {formatDateShort(entry.date.slice(0, 10))}
                        {entry.bookingRef ? ` · ${entry.bookingRef}` : ''}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums shrink-0 font-semibold ${
                        entry.pointsDelta >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-[#7D5604] dark:text-[#D4AF37]'
                      }`}
                    >
                      {entry.pointsDelta >= 0 ? `+${entry.pointsDelta}` : entry.pointsDelta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Push Notifications & Seasonal Promotions */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#1B160B]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#7A5908]/15 pb-4 dark:border-[#D4AF37]/15">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">
                  <BellRing className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                  <span>Mobile Push Notifications</span>
                </h3>
                <p className="mt-0.5 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                  Status:{' '}
                  {permission === 'granted'
                    ? 'Device alerts enabled'
                    : permission === 'denied'
                    ? 'Blocked in browser settings'
                    : permission === 'unsupported'
                    ? 'In-app live alerts active'
                    : 'Tap Enable to receive OS notifications'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {permission !== 'granted' && permission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="min-h-[44px] rounded-lg bg-[#161106] px-3.5 py-2 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007]"
                  >
                    Enable Push Alerts
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTriggerCheckInReminder}
                  className="min-h-[44px] rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3.5 py-2 text-xs font-medium text-[#161106] hover:bg-[#EBD594] dark:border-[#D4AF37]/20 dark:bg-[#241D0E] dark:text-[#F8ECCB]"
                >
                  Send Check-In Alert
                </button>
              </div>
            </div>

            {reminderStatus && (
              <p className="mt-3 text-xs font-medium text-[#7D5604] dark:text-[#D4AF37]">{reminderStatus}</p>
            )}

            <div className="mt-4 space-y-3">
              {notifications.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-[#7A5908]/15 bg-[#F4E4B4] p-3.5 dark:border-[#D4AF37]/15 dark:bg-[#241D0E]"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#161106] text-[#D4AF37]">
                    {item.category === 'promotion' ? (
                      <Tag className="h-4 w-4" />
                    ) : item.category === 'booking_reminder' ? (
                      <CalendarClock className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-[#5F4A17] dark:text-[#CBB887]">
                        {formatDateShort(item.createdAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#3E3010] dark:text-[#DECFA8]">{item.body}</p>
                    {item.promoCode && (
                      <button
                        type="button"
                        onClick={() => onApplyPromoAndBook(item.promoCode!)}
                        className="mt-2 text-xs font-semibold text-[#7D5604] dark:text-[#D4AF37] underline underline-offset-2"
                      >
                        Apply {item.promoCode} &amp; Book Suite
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Promotions */}
          <div className="rounded-2xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#1B160B]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">
              <Sparkles className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
              <span>Special Seasonal Promotions</span>
            </h3>
            <div className="mt-4 space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#7A5908]/15 bg-[#F4E4B4]/70 p-4 dark:border-[#D4AF37]/15 dark:bg-[#241D0E] sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">
                      {promo.category} · Valid until {formatDateShort(promo.validUntil)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">{promo.title}</p>
                    <p className="mt-1 text-xs text-[#3E3010] dark:text-[#DECFA8]">{promo.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyPromoAndBook(promo.code)}
                    className="min-h-[44px] shrink-0 rounded-lg bg-[#161106] px-4 py-2 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007] whitespace-nowrap"
                  >
                    Book · {promo.code}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guest Bookings & Automated Confirmation Emails */}
      <div className="rounded-2xl border border-[#7A5908]/20 bg-[#FCF4DB] p-6 dark:border-[#D4AF37]/20 dark:bg-[#1B160B]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#7A5908]/15 pb-4 dark:border-[#D4AF37]/15">
          <h3 className="text-base font-semibold text-[#161106] dark:text-[#F8ECCB]">
            My Reservations &amp; Email Receipts ({reservations.length})
          </h3>
          <span className="text-xs text-[#5F4A17] dark:text-[#CBB887]">{activeGuestEmail}</span>
        </div>

        {reservations.length === 0 ? (
          <p className="py-6 text-sm text-[#5F4A17] dark:text-[#CBB887]">
            No bookings found for {activeGuestEmail} yet.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[#7A5908]/15 dark:divide-[#D4AF37]/15">
            {reservations.map((res) => {
              const mail = emailLogs.find((m) => m.bookingRef === res.bookingRef);
              return (
                <div
                  key={res.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                      <span className="font-mono font-semibold text-[#161106] dark:text-[#F8ECCB]">{res.bookingRef}</span>
                      <span>·</span>
                      <span className="capitalize">{res.status.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>
                        {formatDateShort(res.checkIn)} – {formatDateShort(res.checkOut)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">{res.roomName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="tabular-nums text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">
                      {formatMoney(res.totalPaidNgn, currency, ngnPerUsd)}
                    </span>
                    {mail && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <Mail className="h-3.5 w-3.5" />
                        <span>Email Confirmed</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
