import React, { useEffect, useState } from 'react';
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  BookingQuote,
  EmailLog,
  LoyaltyAccount,
  PaymentMethod,
  Reservation,
  RoomCategory,
  SeasonalPromotion,
} from '../types/hotel.ts';
import { formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';

interface BookingModalProps {
  room: RoomCategory | null;
  initialCheckIn: string;
  initialCheckOut: string;
  initialPromoCode?: string;
  initialGuestEmail?: string;
  promotions: SeasonalPromotion[];
  currency: CurrencyCode;
  ngnPerUsd: number;
  onClose: () => void;
  onBookingCompleted: (result: {
    reservation: Reservation;
    emailLog: EmailLog;
    loyalty: LoyaltyAccount;
  }) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  room,
  initialCheckIn,
  initialCheckOut,
  initialPromoCode = '',
  initialGuestEmail = '',
  promotions,
  currency,
  ngnPerUsd,
  onClose,
  onBookingCompleted,
}) => {
  const [step, setStep] = useState<'details' | 'payment' | 'confirmed'>('details');
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guestsCount, setGuestsCount] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState(initialGuestEmail);
  const [guestPhone, setGuestPhone] = useState('');
  const [airportPickup, setAirportPickup] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [promoCode, setPromoCode] = useState(initialPromoCode);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [memberBalance, setMemberBalance] = useState<LoyaltyAccount | null>(null);

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState('');

  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [processing, setProcessing] = useState(false);

  // Virtual account for bank transfer confirmation step
  const [pendingTransferIntent, setPendingTransferIntent] = useState<{
    intentId: string;
    paymentRef: string;
    amountNgn: number;
    virtualAccount: { bankName: string; accountNumber: string; accountName: string };
  } | null>(null);

  // Confirmed state
  const [confirmedData, setConfirmedData] = useState<{
    reservation: Reservation;
    emailLog: EmailLog;
    loyalty: LoyaltyAccount;
  } | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(true);

  useEffect(() => {
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
  }, [initialCheckIn, initialCheckOut]);

  // Lookup guest loyalty balance when email looks valid
  useEffect(() => {
    const trimmed = guestEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMemberBalance(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/guest/overview?email=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.loyalty) {
          setMemberBalance(data.loyalty);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [guestEmail]);

  // Fetch authoritative server quote
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    setQuoteLoading(true);
    setError('');
    const pointsToTry = useLoyaltyPoints && memberBalance ? memberBalance.points : 0;

    fetch('/api/bookings/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        checkIn,
        checkOut,
        guestEmail: guestEmail.trim() || undefined,
        redeemPoints: pointsToTry,
        promoCode: promoCode.trim() || undefined,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not calculate stay quote.');
        if (!cancelled) setQuote(data.quote);
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setError(err instanceof Error ? err.message : 'Invalid dates');
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [room, checkIn, checkOut, promoCode, useLoyaltyPoints, memberBalance, guestEmail]);

  if (!room) return null;

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!guestName.trim() || !guestPhone.trim()) {
      setError('Please enter your full name and phone number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setError('Please provide a valid email address for your automated booking confirmation.');
      return;
    }
    if (!quote || quote.availableUnits <= 0) {
      setError('This suite is unavailable for the selected dates. Please adjust dates.');
      return;
    }
    setStep('payment');
  };

  const finalizeBooking = async (intentId: string) => {
    const confirmRes = await fetch('/api/bookings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestsCount,
        specialRequests,
        airportPickup,
      }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok) {
      throw new Error(confirmData.error || 'Reservation confirmation failed.');
    }
    setConfirmedData(confirmData);
    setStep('confirmed');
    onBookingCompleted(confirmData);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    setError('');
    setProcessing(true);

    try {
      const intentRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          checkIn,
          checkOut,
          guestEmail: guestEmail.trim(),
          redeemPoints: useLoyaltyPoints && memberBalance ? memberBalance.points : 0,
          promoCode: promoCode.trim() || undefined,
          paymentMethod,
          cardNumber: paymentMethod === 'card' ? cardNumber : undefined,
          cardExpiry: paymentMethod === 'card' ? cardExpiry : undefined,
          cardCvc: paymentMethod === 'card' ? cardCvc : undefined,
        }),
      });
      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        throw new Error(intentData.error || 'Payment verification failed.');
      }

      if (paymentMethod === 'bank_transfer' && intentData.virtualAccount) {
        setPendingTransferIntent({
          intentId: intentData.intentId,
          paymentRef: intentData.paymentRef,
          amountNgn: intentData.amountNgn,
          virtualAccount: intentData.virtualAccount,
        });
        setProcessing(false);
        return;
      }

      await finalizeBooking(intentData.intentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process payment.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmTransferPaid = async () => {
    if (!pendingTransferIntent) return;
    setProcessing(true);
    setError('');
    try {
      await finalizeBooking(pendingTransferIntent.intentId);
      setPendingTransferIntent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify bank transfer.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!confirmedData) return;
    const blob = new Blob([confirmedData.emailLog.bodyText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${confirmedData.reservation.bookingRef}-confirmation.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCardInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiryInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reserve ${room.name}`}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#7A5908]/25 bg-[#F5E6B8] text-[#161106] shadow-2xl dark:border-[#D4AF37]/25 dark:bg-[#191409] dark:text-[#F8ECCB] sm:rounded-2xl">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D4AF37]/25 bg-[#141007] px-6 py-4 text-white">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#E5C158]">
              {step === 'confirmed' ? 'Reservation Confirmed' : `${room.tier} Tier · Benin City, Edo`}
            </p>
            <h2 className="truncate font-editorial text-2xl font-semibold">{room.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        {step !== 'confirmed' && (
          <div className="flex items-center gap-4 border-b border-[#7A5908]/20 bg-[#FCF4DB] px-6 py-3 text-xs font-medium dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
            <button
              type="button"
              onClick={() => step === 'payment' && !pendingTransferIntent && setStep('details')}
              className={step === 'details' ? 'font-semibold text-[#7D5604] dark:text-[#D4AF37]' : 'text-[#5F4A17] hover:text-[#161106] dark:text-[#CBB887] dark:hover:text-[#F8ECCB]'}
            >
              01. Guest &amp; Stay Details
            </button>
            <span className="text-[#7A5908]/35 dark:text-[#D4AF37]/30">/</span>
            <span className={step === 'payment' ? 'font-semibold text-[#7D5604] dark:text-[#D4AF37]' : 'text-[#5F4A17] dark:text-[#CBB887]'}>
              02. Secure Payment
            </span>
            <span className="text-[#7A5908]/35 dark:text-[#D4AF37]/30">/</span>
            <span className="text-[#5F4A17] dark:text-[#CBB887]">03. Email Confirmation</span>
          </div>
        )}

        <div className="p-6">
          {error && (
            <div className="mb-5 rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-950/45 dark:text-red-200">
              {error}
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleContinueToPayment} className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Check-In Date
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Check-Out Date
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Full Name
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Osahon Igbinedion"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Guests (Max {room.maxGuests})
                    <select
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    >
                      {Array.from({ length: room.maxGuests }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'Guest' : 'Guests'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Email (For Automated Confirmation)
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="guest@domain.com"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Phone / WhatsApp
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                    />
                  </label>
                </div>

                {/* Loyalty & Promo */}
                <div className="space-y-3 rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-4 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]" htmlFor="promo-input">
                      Seasonal Promo Code
                    </label>
                    {promotions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {promotions.slice(0, 2).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPromoCode(p.code)}
                            className="text-xs font-semibold text-[#7D5604] underline underline-offset-2 hover:text-[#161106] dark:text-[#D4AF37] dark:hover:text-[#F8ECCB]"
                          >
                            Use {p.code} ({p.discountPercent}% off)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    id="promo-input"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code e.g. BENIN15"
                    className="w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2 font-mono text-xs uppercase text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                  />

                  {memberBalance && memberBalance.points > 0 && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-[#7A5908]/15 pt-3 dark:border-[#D4AF37]/15">
                      <div className="flex items-center gap-2.5">
                        <Award className="h-4 w-4 shrink-0 text-[#9A6E08] dark:text-[#D4AF37]" />
                        <span className="text-xs text-[#161106] dark:text-[#F8ECCB]">
                          Redeem <strong>{memberBalance.points.toLocaleString()} pts</strong> ({memberBalance.tier})
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={useLoyaltyPoints}
                        onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                        className="h-4 w-4 accent-[#9A6E08]"
                      />
                    </label>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] px-4 py-3 text-sm text-[#161106] dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]">
                  <input
                    type="checkbox"
                    checked={airportPickup}
                    onChange={(e) => setAirportPickup(e.target.checked)}
                    className="h-4 w-4 accent-[#9A6E08]"
                  />
                  <span>Request Benin Airport chauffeur pickup (Experienced Hotel Driver)</span>
                </label>

                <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                  Special Requests (Dietary, Lounge Table, Arrival Time)
                  <textarea
                    rows={2}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="e.g. Table reservation at Gold Room Lounge for 20:00"
                    className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-3 py-2 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                  />
                </label>
              </div>

              {/* Right Summary Column */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                  <div className="flex items-center justify-between border-b border-[#7A5908]/15 pb-3 dark:border-[#D4AF37]/15">
                    <span className="text-xs font-medium text-[#5F4A17] dark:text-[#CBB887]">Real-Time Summary</span>
                    <span className="tabular-nums text-xs font-semibold text-[#161106] dark:text-[#F8ECCB]">
                      {quote ? `${quote.availableUnits} suites left` : 'Checking...'}
                    </span>
                  </div>

                  {quoteLoading ? (
                    <div className="py-8 text-center text-sm text-[#5F4A17] dark:text-[#CBB887]">Calculating live tariff...</div>
                  ) : quote ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">
                          {formatMoney(quote.nightlyRateNgn, currency, ngnPerUsd)} × {quote.nights}{' '}
                          {quote.nights === 1 ? 'night' : 'nights'}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatMoney(quote.subtotalNgn, currency, ngnPerUsd)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">Hospitality &amp; VAT (7.5%)</span>
                        <span className="tabular-nums font-medium">
                          {formatMoney(quote.serviceFeeNgn, currency, ngnPerUsd)}
                        </span>
                      </div>
                      {quote.promoDiscountNgn > 0 && (
                        <div className="flex justify-between text-emerald-800 dark:text-emerald-400">
                          <span>Promo ({quote.appliedPromoCode})</span>
                          <span className="tabular-nums font-medium">
                            -{formatMoney(quote.promoDiscountNgn, currency, ngnPerUsd)}
                          </span>
                        </div>
                      )}
                      {quote.loyaltyDiscountNgn > 0 && (
                        <div className="flex justify-between text-[#7D5604] dark:text-[#D4AF37]">
                          <span>Royal Club ({quote.pointsToRedeem} pts)</span>
                          <span className="tabular-nums font-medium">
                            -{formatMoney(quote.loyaltyDiscountNgn, currency, ngnPerUsd)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between border-t border-[#7A5908]/15 pt-3 dark:border-[#D4AF37]/15">
                        <span className="font-semibold">Total Payable</span>
                        <span className="tabular-nums text-xl font-bold text-[#161106] dark:text-[#F8ECCB]">
                          {formatMoney(quote.totalNgn, currency, ngnPerUsd)}
                        </span>
                      </div>
                      <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">
                        Earns <strong className="text-[#7D5604] dark:text-[#D4AF37]">+{quote.pointsToEarn} pts</strong> in Joker Royal Club
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!quote || quote.availableUnits <= 0 || quoteLoading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#161106] px-4 py-3 text-sm font-medium text-[#F9E7B2] transition-colors hover:bg-[#2A200B] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158]"
                  >
                    <Lock className="h-4 w-4 text-[#D4AF37] dark:text-[#141007]" />
                    <span>Proceed to Secure Payment</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'payment' && quote && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                {pendingTransferIntent ? (
                  <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-6 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#161106] dark:text-[#F8ECCB]">
                      <Building2 className="h-5 w-5 text-[#9A6E08] dark:text-[#D4AF37]" />
                      <span>Instant Bank Transfer Escrow</span>
                    </div>
                    <p className="mt-2 text-sm text-[#3E3010] dark:text-[#DECFA8]">
                      Transfer the exact amount below from your Nigerian banking app to confirm your suite immediately.
                    </p>
                    <div className="mt-5 space-y-3 rounded-xl bg-[#F4E4B4] p-4 text-sm dark:bg-[#171209]">
                      <div className="flex justify-between">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">Bank Name</span>
                        <span className="font-medium">{pendingTransferIntent.virtualAccount.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">Account Number</span>
                        <span className="font-mono text-base font-bold tracking-wider">
                          {pendingTransferIntent.virtualAccount.accountNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">Beneficiary</span>
                        <span className="font-medium">{pendingTransferIntent.virtualAccount.accountName}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#7A5908]/15 pt-2 dark:border-[#D4AF37]/15">
                        <span className="text-[#5F4A17] dark:text-[#CBB887]">Exact Amount</span>
                        <span className="tabular-nums font-bold text-[#7D5604] dark:text-[#D4AF37]">
                          ₦{pendingTransferIntent.amountNgn.toLocaleString('en-NG')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleConfirmTransferPaid}
                        disabled={processing}
                        className="flex-1 rounded-lg bg-[#161106] px-4 py-3 text-sm font-medium text-[#F9E7B2] hover:bg-[#2A200B] disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#141007]"
                      >
                        {processing ? 'Verifying Transfer...' : 'I Have Completed Transfer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingTransferIntent(null)}
                        className="rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-4 py-3 text-sm font-medium text-[#161106] dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                      >
                        Change Method
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleProcessPayment} className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-1.5 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                      {(
                        [
                          { id: 'card', label: 'Card Payment' },
                          { id: 'bank_transfer', label: 'Bank Transfer' },
                          { id: 'pay_at_hotel', label: 'Pay at Hotel' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                            paymentMethod === m.id
                              ? 'bg-[#161106] text-[#F9E7B2] dark:bg-[#D4AF37] dark:text-[#141007]'
                              : 'text-[#5F4A17] hover:text-[#161106] dark:text-[#CBB887] dark:hover:text-[#F8ECCB]'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'card' && (
                      <div className="space-y-4 rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Debit / Credit Card (Visa, Mastercard, Verve)</span>
                          <CreditCard className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                        </div>
                        <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                          Card Number
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
                            placeholder="4532 •••• •••• ••••"
                            required
                            className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 font-mono text-sm focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                            Expiry (MM/YY)
                            <input
                              type="text"
                              inputMode="numeric"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                              placeholder="08/28"
                              required
                              className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 font-mono text-sm focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                            />
                          </label>
                          <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                            Security CVC
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="•••"
                              required
                              className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 font-mono text-sm focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                            />
                          </label>
                        </div>
                        <p className="flex items-center gap-2 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                          <span>Tokenized server-verified checkout. Card numbers are never stored on disk.</span>
                        </p>
                      </div>
                    )}

                    {paymentMethod === 'bank_transfer' && (
                      <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 text-sm text-[#3E3010] dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#DECFA8]">
                        <p className="font-medium text-[#161106] dark:text-[#F8ECCB]">Instant Naira Virtual Account</p>
                        <p className="mt-1.5">
                          We will generate a dedicated one-time Providus Bank escrow account for{' '}
                          <strong className="tabular-nums">₦{quote.totalNgn.toLocaleString('en-NG')}</strong>.
                        </p>
                      </div>
                    )}

                    {paymentMethod === 'pay_at_hotel' && (
                      <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 text-sm text-[#3E3010] dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#DECFA8]">
                        <p className="font-medium text-[#161106] dark:text-[#F8ECCB]">Guaranteed Arrival Hold</p>
                        <p className="mt-1.5">
                          Your suite will be held under your email and phone until 18:00 WAT on check-in day. Settle via POS, cash, or transfer at the Benin City reception desk.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep('details')}
                        className="rounded-lg border border-[#7A5908]/25 bg-[#FCF4DB] px-4 py-3 text-sm font-medium text-[#161106] dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={processing}
                        className="flex-1 rounded-lg bg-[#161106] px-4 py-3 text-sm font-medium text-[#F9E7B2] hover:bg-[#2A200B] disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#141007]"
                      >
                        {processing
                          ? 'Authorizing Transaction...'
                          : paymentMethod === 'pay_at_hotel'
                          ? 'Confirm Guaranteed Reservation'
                          : paymentMethod === 'bank_transfer'
                          ? 'Generate Transfer Account'
                          : `Pay ${formatMoney(quote.totalNgn, currency, ngnPerUsd)} & Confirm`}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 text-sm dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                  <p className="text-xs font-medium text-[#5F4A17] dark:text-[#CBB887]">Guest &amp; Stay</p>
                  <p className="mt-1 font-semibold text-[#161106] dark:text-[#F8ECCB]">{guestName}</p>
                  <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">{guestEmail}</p>
                  <div className="mt-4 space-y-2 border-t border-[#7A5908]/15 pt-3 text-xs dark:border-[#D4AF37]/15">
                    <div className="flex justify-between">
                      <span className="text-[#5F4A17] dark:text-[#CBB887]">Dates</span>
                      <span className="font-medium">
                        {formatDateShort(checkIn)} – {formatDateShort(checkOut)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F4A17] dark:text-[#CBB887]">Suite</span>
                      <span className="font-medium">{room.name}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-bold text-[#161106] dark:text-[#F8ECCB]">
                      <span>Amount Due</span>
                      <span className="tabular-nums">{formatMoney(quote.totalNgn, currency, ngnPerUsd)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'confirmed' && confirmedData && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-800/25 bg-[#FCF4DB] p-6 dark:border-emerald-500/20 dark:bg-[#231C0E]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                        Transaction Verified &amp; Email Dispatched
                      </p>
                      <h3 className="font-editorial text-2xl font-semibold text-[#161106] dark:text-[#F8ECCB]">
                        Booking {confirmedData.reservation.bookingRef} Confirmed
                      </h3>
                      <p className="mt-1 text-sm text-[#3E3010] dark:text-[#DECFA8]">
                        An automated confirmation email has been sent to{' '}
                        <strong>{confirmedData.emailLog.toEmail}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3.5 py-2 text-xs font-medium text-[#161106] hover:bg-[#EBD594] dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Receipt</span>
                  </button>
                </div>

                <div className="mt-6 grid gap-4 border-t border-[#7A5908]/15 pt-5 sm:grid-cols-3 text-sm dark:border-[#D4AF37]/15">
                  <div>
                    <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">Stay Window</p>
                    <p className="mt-0.5 font-medium">
                      {formatDateShort(confirmedData.reservation.checkIn)} –{' '}
                      {formatDateShort(confirmedData.reservation.checkOut)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">Payment Reference</p>
                    <p className="mt-0.5 font-mono font-medium">{confirmedData.reservation.paymentRef}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5F4A17] dark:text-[#CBB887]">Royal Club Earned</p>
                    <p className="mt-0.5 font-semibold text-[#7D5604] dark:text-[#D4AF37]">
                      +{confirmedData.reservation.pointsEarned} pts ({confirmedData.loyalty.tier})
                    </p>
                  </div>
                </div>
              </div>

              {/* Automated Email Confirmation Inspector */}
              <div className="overflow-hidden rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
                <div className="flex items-center justify-between border-b border-[#7A5908]/15 px-5 py-3 dark:border-[#D4AF37]/15">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#161106] dark:text-[#F8ECCB]">
                    <Mail className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                    <span>Automated Email Confirmation · {confirmedData.emailLog.subject}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview((v) => !v)}
                    className="text-xs font-medium text-[#7D5604] dark:text-[#D4AF37] hover:underline"
                  >
                    {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                {showEmailPreview && (
                  <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap bg-[#F4E4B4] p-5 font-mono text-xs leading-relaxed text-[#2C2109] dark:bg-[#171209] dark:text-[#DECFA8]">
                    {confirmedData.emailLog.bodyText}
                  </pre>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                  <Calendar className="h-4 w-4" />
                  <span>Check-in reminder scheduled in your Push Alerts tab.</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#161106] px-6 py-2.5 text-sm font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
