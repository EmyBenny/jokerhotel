import React from 'react';
import { Award, BedDouble, Calendar, CheckCircle2, ShieldCheck, Users, X } from 'lucide-react';
import type { RoomCategory } from '../types/hotel.ts';
import { diffNights, formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';

interface SuiteDetailModalProps {
  room: RoomCategory | null;
  checkIn: string;
  checkOut: string;
  currency: CurrencyCode;
  ngnPerUsd: number;
  onClose: () => void;
  onReserve: (room: RoomCategory) => void;
}

export const SuiteDetailModal: React.FC<SuiteDetailModalProps> = ({
  room,
  checkIn,
  checkOut,
  currency,
  ngnPerUsd,
  onClose,
  onReserve,
}) => {
  if (!room) return null;

  const nights = diffNights(checkIn, checkOut);
  const subtotal = room.nightlyRateNgn * nights;
  const serviceFee = Math.round(subtotal * 0.075);
  const total = subtotal + serviceFee;
  const pointsEstimate = Math.max(10, Math.floor(total / 1000));
  const avail = room.availableUnits ?? 0;
  const isBookable = room.status === 'available' && avail > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${room.name} suite inspection`}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#7A5908]/25 bg-[#F5E6B8] text-[#161106] shadow-2xl dark:border-[#D4AF37]/25 dark:bg-[#191409] dark:text-[#F8ECCB] sm:rounded-2xl">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#141007]">
          <img
            src={room.imageUrl}
            alt={room.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close suite details"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-5 left-6 right-6 text-white">
            <p className="text-xs font-medium text-[#D4AF37]">
              {room.tier} Collection · {room.sizeSqm} m² · {room.bedConfig}
            </p>
            <h2 className="mt-1 font-editorial text-3xl font-semibold sm:text-4xl">{room.name}</h2>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <p className="text-sm leading-relaxed text-[#3E3010] dark:text-[#DECFA8]">
              {room.description}
            </p>

            <div className="grid grid-cols-3 gap-3 border-y border-[#7A5908]/20 py-4 text-xs dark:border-[#D4AF37]/20">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                <span>{room.bedConfig}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                <span>Up to {room.maxGuests} guests</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                <span>24/7 Security</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#5F4A17] dark:text-[#CBB887]">
                Included Privileges &amp; Amenities
              </h3>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {room.amenities.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-[#161106] dark:text-[#F5E7BA]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#9A6E08] dark:text-[#D4AF37]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]">
              <div className="flex items-center justify-between border-b border-[#7A5908]/15 pb-3 text-xs dark:border-[#D4AF37]/15">
                <span className="flex items-center gap-1.5 text-[#5F4A17] dark:text-[#CBB887]">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDateShort(checkIn)} → {formatDateShort(checkOut)}
                  </span>
                </span>
                <span className={`tabular-nums font-medium ${isBookable ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                  {isBookable ? `${avail} available` : 'Unavailable'}
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5F4A17] dark:text-[#CBB887]">
                    {formatMoney(room.nightlyRateNgn, currency, ngnPerUsd)} × {nights}{' '}
                    {nights === 1 ? 'night' : 'nights'}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(subtotal, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F4A17] dark:text-[#CBB887]">Hospitality &amp; VAT (7.5%)</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(serviceFee, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-[#7A5908]/15 pt-3 dark:border-[#D4AF37]/15">
                  <span className="font-semibold">Estimated Stay Total</span>
                  <span className="tabular-nums text-xl font-bold text-[#7D5604] dark:text-[#D4AF37]">
                    {formatMoney(total, currency, ngnPerUsd)}
                  </span>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                <Award className="h-3.5 w-3.5 text-[#9A6E08] dark:text-[#D4AF37]" />
                <span>Earns +{pointsEstimate} Joker Royal Club points</span>
              </p>

              <button
                type="button"
                disabled={!isBookable}
                onClick={() => onReserve(room)}
                className="mt-5 w-full rounded-lg bg-[#161106] py-3 text-xs font-semibold text-[#F9E7B2] hover:bg-[#2A200B] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158]"
              >
                {isBookable ? 'Proceed to Reserve Suite' : 'Currently Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
