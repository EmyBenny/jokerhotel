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
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#14120F]/10 bg-[#F7F5F0] text-[#14120F] shadow-2xl dark:border-white/10 dark:bg-[#171512] dark:text-[#F5F2EB] sm:rounded-2xl">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#100F0D]">
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
            <p className="text-sm leading-relaxed text-[#4A453D] dark:text-[#CFC8BC]">
              {room.description}
            </p>

            <div className="grid grid-cols-3 gap-3 border-y border-[#14120F]/10 py-4 text-xs dark:border-white/10">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-[#B8860B]" />
                <span>{room.bedConfig}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#B8860B]" />
                <span>Up to {room.maxGuests} guests</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#B8860B]" />
                <span>24/7 Security</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#6E675C] dark:text-[#A9A195]">
                Included Privileges &amp; Amenities
              </h3>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {room.amenities.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-[#14120F] dark:text-[#EAE5DC]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#B8860B]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#1E1B17]">
              <div className="flex items-center justify-between border-b border-[#14120F]/10 pb-3 text-xs dark:border-white/10">
                <span className="flex items-center gap-1.5 text-[#6E675C] dark:text-[#A9A195]">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDateShort(checkIn)} → {formatDateShort(checkOut)}
                  </span>
                </span>
                <span className={`tabular-nums font-medium ${isBookable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {isBookable ? `${avail} available` : 'Unavailable'}
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6E675C] dark:text-[#A9A195]">
                    {formatMoney(room.nightlyRateNgn, currency, ngnPerUsd)} × {nights}{' '}
                    {nights === 1 ? 'night' : 'nights'}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(subtotal, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E675C] dark:text-[#A9A195]">Hospitality &amp; VAT (7.5%)</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(serviceFee, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-[#14120F]/10 pt-3 dark:border-white/10">
                  <span className="font-semibold">Estimated Stay Total</span>
                  <span className="tabular-nums text-xl font-bold text-[#9A6E08] dark:text-[#D4AF37]">
                    {formatMoney(total, currency, ngnPerUsd)}
                  </span>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-[#6E675C] dark:text-[#A9A195]">
                <Award className="h-3.5 w-3.5 text-[#B8860B]" />
                <span>Earns +{pointsEstimate} Joker Royal Club points</span>
              </p>

              <button
                type="button"
                disabled={!isBookable}
                onClick={() => onReserve(room)}
                className="mt-5 w-full rounded-lg bg-[#14120F] py-3 text-xs font-semibold text-white hover:bg-[#2C2822] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C]"
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
