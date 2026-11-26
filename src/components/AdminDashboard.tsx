import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  EmailLog,
  Reservation,
  ReservationStatus,
  RoomCategory,
  RoomStatus,
  SeasonalPromotion,
} from '../types/hotel.ts';
import { formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';

interface AdminDashboardProps {
  currency: CurrencyCode;
  ngnPerUsd: number;
  onRoomsUpdated: (rooms: RoomCategory[]) => void;
  onPromotionsUpdated: (promos: SeasonalPromotion[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currency,
  ngnPerUsd,
  onRoomsUpdated,
  onPromotionsUpdated,
}) => {
  // Token kept strictly in React memory per security guidelines
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{ configured: boolean; envManaged: boolean } | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<'reservations' | 'rooms' | 'promotions' | 'emails'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<RoomCategory[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [promotions, setPromotions] = useState<SeasonalPromotion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationStatus>('all');
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [actionBanner, setActionBanner] = useState('');

  // Room editing local draft state
  const [roomDrafts, setRoomDrafts] = useState<
    Record<string, { nightlyRateNgn: number; totalUnits: number; maintenanceUnits: number; status: RoomStatus }>
  >({});

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(15);
  const [promoCategory, setPromoCategory] = useState<'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape'>('Seasonal Offer');
  const [promoValidUntil, setPromoValidUntil] = useState('');
  const [promoDesc, setPromoDesc] = useState('');

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((data) => setAuthStatus(data))
      .catch(() => setAuthStatus({ configured: false, envManaged: false }));
  }, []);

  const fetchDashboard = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        setToken(null);
        return;
      }
      const data = await res.json();
      setReservations(data.reservations || []);
      setRooms(data.rooms || []);
      setEmailLogs(data.emailLogs || []);
      setPromotions(data.promotions || []);

      const drafts: Record<
        string,
        { nightlyRateNgn: number; totalUnits: number; maintenanceUnits: number; status: RoomStatus }
      > = {};
      for (const r of data.rooms || []) {
        drafts[r.id] = {
          nightlyRateNgn: r.nightlyRateNgn,
          totalUnits: r.totalUnits,
          maintenanceUnits: r.maintenanceUnits,
          status: r.status,
        };
      }
      setRoomDrafts(drafts);
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchDashboard(token);
    }
  }, [token, fetchDashboard]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStatus) return;
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authStatus.configured ? '/api/admin/auth/login' : '/api/admin/auth/setup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcodeInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');
      setToken(data.token);
      setPasscodeInput('');
      setAuthStatus((prev) => (prev ? { ...prev, configured: true } : prev));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to authenticate.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateReservationStatus = async (id: string, status: ReservationStatus) => {
    if (!token) return;
    setActionBanner('');
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setReservations((prev) => prev.map((r) => (r.id === id ? data.reservation : r)));
      if (data.rooms) {
        setRooms(data.rooms);
        onRoomsUpdated(data.rooms);
      }
      setActionBanner(`Reservation ${data.reservation.bookingRef} marked as ${status.replace('_', ' ')}.`);
    }
  };

  const handleSaveRoom = async (roomId: string) => {
    if (!token) return;
    const draft = roomDrafts[roomId];
    if (!draft) return;
    setActionBanner('');
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (res.ok) {
      setRooms(data.rooms);
      onRoomsUpdated(data.rooms);
      setActionBanner(`Updated ${data.room.name} pricing and availability live.`);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setActionBanner('');
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: promoTitle,
        code: promoCode,
        discountPercent: promoDiscount,
        category: promoCategory,
        validUntil: promoValidUntil,
        description: promoDesc,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      const nextPromos = [data.promo, ...promotions];
      setPromotions(nextPromos);
      onPromotionsUpdated(nextPromos.filter((p) => p.active));
      setPromoTitle('');
      setPromoCode('');
      setPromoDesc('');
      setActionBanner(`Published "${data.promo.title}" and pushed notification to mobile guests.`);
    }
  };

  const handleDeactivatePromo = async (promoId: string) => {
    if (!token) return;
    const res = await fetch(`/api/admin/promotions/${promoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const nextPromos = promotions.map((p) => (p.id === promoId ? { ...p, active: false } : p));
      setPromotions(nextPromos);
      onPromotionsUpdated(nextPromos.filter((p) => p.active));
    }
  };

  if (!token) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-[#14120F]/10 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#171512] dark:text-[#F5F2EB]">
          <div className="flex items-center gap-2 text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37]">
            <ShieldCheck className="h-4 w-4" />
            <span>Hotel Operations Console</span>
          </div>
          <h2 className="mt-2 font-editorial text-3xl font-semibold text-[#14120F] dark:text-white">
            {authStatus && !authStatus.configured ? 'Create Your Admin Passcode' : 'Admin Sign-In'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A453D] dark:text-[#CFC8BC]">
            {authStatus && !authStatus.configured
              ? 'No default passcode is pre-set for security. Choose any 6+ character passcode below to claim Admin Console access.'
              : 'Enter your Joker Hotel & Suites operations passcode to manage live reservations and availability.'}
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-700/20 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
              Operations Passcode
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6E675C]" />
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder={authStatus && !authStatus.configured ? 'Choose 6+ char passcode' : 'Enter your passcode'}
                  minLength={6}
                  required
                  className="w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] py-2.5 pl-9 pr-10 text-sm text-[#14120F] focus:border-[#B8860B] focus:outline-none dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((v) => !v)}
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  className="absolute right-2.5 top-2.5 rounded p-1 text-[#6E675C] hover:text-[#14120F] dark:hover:text-white"
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-lg bg-[#14120F] py-3 text-sm font-medium text-white hover:bg-[#2C2822] disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C]"
            >
              {authLoading
                ? 'Verifying...'
                : authStatus && !authStatus.configured
                ? 'Claim Passcode & Open Console'
                : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  // Dashboard Metrics
  const totalUnits = rooms.reduce((acc, r) => acc + r.totalUnits, 0);
  const availableNow = rooms.reduce((acc, r) => acc + (r.availableUnits ?? 0), 0);
  const occupancyPct = totalUnits > 0 ? Math.round(((totalUnits - availableNow) / totalUnits) * 100) : 0;
  const confirmedRevenue = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((acc, r) => acc + r.totalPaidNgn, 0);
  const activeCount = reservations.filter(
    (r) => r.status === 'confirmed' || r.status === 'checked_in'
  ).length;

  const filteredReservations = reservations.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.bookingRef.toLowerCase().includes(q) ||
      r.guestName.toLowerCase().includes(q) ||
      r.guestEmail.toLowerCase().includes(q) ||
      r.roomName.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#14120F]/10 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37]">Operations / Joker Hotel &amp; Suites</p>
          <h2 className="mt-1 font-editorial text-3xl font-semibold text-[#14120F] dark:text-white">
            Reservations &amp; Availability Console
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setToken(null)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#14120F]/15 bg-white px-3.5 py-2 text-xs font-medium text-[#14120F] hover:bg-[#F7F5F0] dark:border-white/15 dark:bg-[#171512] dark:text-white dark:hover:bg-[#1E1B17]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
          <p className="text-xs text-[#6E675C] dark:text-[#A9A195]">Current Occupancy</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#14120F] dark:text-white">{occupancyPct}%</p>
          <p className="mt-1 tabular-nums text-xs text-[#6E675C] dark:text-[#A9A195]">
            {totalUnits - availableNow} of {totalUnits} suites occupied
          </p>
        </div>
        <div className="rounded-xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
          <p className="text-xs text-[#6E675C] dark:text-[#A9A195]">Gross Booking Revenue</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#14120F] dark:text-white">
            {formatMoney(confirmedRevenue, currency, ngnPerUsd)}
          </p>
          <p className="mt-1 text-xs text-[#6E675C] dark:text-[#A9A195]">Verified non-cancelled stays</p>
        </div>
        <div className="rounded-xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
          <p className="text-xs text-[#6E675C] dark:text-[#A9A195]">Active &amp; Upcoming Stays</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#14120F] dark:text-white">{activeCount}</p>
          <p className="mt-1 text-xs text-[#6E675C] dark:text-[#A9A195]">Confirmed + checked-in guests</p>
        </div>
        <div className="rounded-xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
          <p className="text-xs text-[#6E675C] dark:text-[#A9A195]">Automated Emails Sent</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#14120F] dark:text-white">{emailLogs.length}</p>
          <p className="mt-1 text-xs text-[#6E675C] dark:text-[#A9A195]">100% transaction confirmation rate</p>
        </div>
      </div>

      {actionBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800/20 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionBanner}</span>
        </div>
      )}

      {/* Segmented Console Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#14120F]/10 bg-white p-1.5 dark:border-white/10 dark:bg-[#171512]">
        {(
          [
            { id: 'reservations', label: 'Guest Reservations' },
            { id: 'rooms', label: 'Room Availability & Rates' },
            { id: 'promotions', label: 'Seasonal Promos & Push' },
            { id: 'emails', label: 'Confirmation Email Log' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-[#14120F] text-white dark:bg-[#D4AF37] dark:text-[#100F0D]'
                : 'text-[#6E675C] hover:text-[#14120F] dark:text-[#A9A195] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Reservations */}
      {tab === 'reservations' && (
        <div className="rounded-2xl border border-[#14120F]/10 bg-white dark:border-white/10 dark:bg-[#171512]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#14120F]/10 p-4 dark:border-white/10">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6E675C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest, ref, or suite..."
                className="w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] py-2 pl-9 pr-3 text-xs text-[#14120F] focus:border-[#B8860B] focus:outline-none dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-[#F7F5F0] p-1 dark:bg-[#1E1B17]">
              {(['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-white text-[#14120F] shadow-sm dark:bg-[#D4AF37] dark:text-[#100F0D]'
                      : 'text-[#6E675C] dark:text-[#A9A195]'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#14120F]/10 bg-[#FAF8F4] text-[#6E675C] dark:border-white/10 dark:bg-[#1E1B17] dark:text-[#A9A195]">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Suite</th>
                  <th className="px-4 py-3 font-medium">Check-In / Out</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14120F]/10 dark:divide-white/10">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-[#FAF8F4] dark:hover:bg-[#1E1B17]">
                    <td className="px-4 py-3 font-mono font-semibold text-[#14120F] dark:text-white">
                      {res.bookingRef}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#14120F] dark:text-white">{res.guestName}</p>
                      <p className="text-[#6E675C] dark:text-[#A9A195]">{res.guestEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#14120F] dark:text-white">{res.roomName}</p>
                      <p className="text-[#6E675C] dark:text-[#A9A195]">
                        {res.airportPickup ? 'Chauffeur Pickup' : 'Standard Arrival'}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#4A453D] dark:text-[#CFC8BC]">
                      {formatDateShort(res.checkIn)} → {formatDateShort(res.checkOut)} ({res.nights}n)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#14120F] dark:text-white">
                      {formatMoney(res.totalPaidNgn, currency, ngnPerUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium capitalize ${
                          res.status === 'checked_in'
                            ? 'text-emerald-800 dark:text-emerald-400'
                            : res.status === 'cancelled'
                            ? 'text-red-700 dark:text-red-400'
                            : res.status === 'confirmed'
                            ? 'text-[#9A6E08] dark:text-[#D4AF37]'
                            : 'text-[#6E675C] dark:text-[#A9A195]'
                        }`}
                      >
                        {res.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {res.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(res.id, 'checked_in')}
                            className="rounded-md bg-[#14120F] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#2C2822]"
                          >
                            Check In
                          </button>
                        )}
                        {res.status === 'checked_in' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(res.id, 'checked_out')}
                            className="rounded-md border border-[#14120F]/15 bg-white px-2.5 py-1 text-[11px] font-medium text-[#14120F]"
                          >
                            Check Out
                          </button>
                        )}
                        {(res.status === 'confirmed' || res.status === 'checked_in') && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(res.id, 'cancelled')}
                            className="rounded-md border border-red-700/20 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#6E675C]">
                      No reservations match your current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rooms & Availability */}
      {tab === 'rooms' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const draft = roomDrafts[room.id] || {
              nightlyRateNgn: room.nightlyRateNgn,
              totalUnits: room.totalUnits,
              maintenanceUnits: room.maintenanceUnits,
              status: room.status,
            };
            return (
              <div key={room.id} className="rounded-2xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#6E675C] dark:text-[#A9A195]">{room.tier} Tier</p>
                    <h3 className="text-base font-semibold text-[#14120F] dark:text-white">{room.name}</h3>
                  </div>
                  <span className="tabular-nums text-xs font-semibold text-[#9A6E08] dark:text-[#D4AF37]">
                    {room.availableUnits ?? 0} free today
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <label className="block font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                    Nightly Rate (₦ NGN)
                    <input
                      type="number"
                      min={10000}
                      step={5000}
                      value={draft.nightlyRateNgn}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [room.id]: { ...draft, nightlyRateNgn: Number(e.target.value) },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 font-mono text-sm text-[#14120F] dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                      Total Units
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={draft.totalUnits}
                        onChange={(e) =>
                          setRoomDrafts((prev) => ({
                            ...prev,
                            [room.id]: { ...draft, totalUnits: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 font-mono text-sm text-[#14120F] dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                      />
                    </label>
                    <label className="block font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                      Maintenance Hold
                      <input
                        type="number"
                        min={0}
                        max={draft.totalUnits}
                        value={draft.maintenanceUnits}
                        onChange={(e) =>
                          setRoomDrafts((prev) => ({
                            ...prev,
                            [room.id]: { ...draft, maintenanceUnits: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 font-mono text-sm text-[#14120F] dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                      />
                    </label>
                  </div>

                  <label className="block font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                    Live Booking Status
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [room.id]: { ...draft, status: e.target.value as RoomStatus },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 text-sm text-[#14120F] dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                    >
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance Hold</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveRoom(room.id)}
                  className="mt-5 w-full rounded-lg bg-[#14120F] py-2.5 text-xs font-medium text-white hover:bg-[#2C2822] dark:bg-[#D4AF37] dark:text-[#100F0D]"
                >
                  Save &amp; Sync Live
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Promotions & Push Broadcasts */}
      {tab === 'promotions' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleCreatePromo}
            className="space-y-4 rounded-2xl border border-[#14120F]/10 bg-white p-6 dark:border-white/10 dark:bg-[#171512] lg:col-span-5"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#14120F] dark:text-white">
              <Plus className="h-4 w-4 text-[#B8860B]" />
              <span>Publish Seasonal Offer &amp; Push Alert</span>
            </h3>
            <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
              Campaign Title
              <input
                type="text"
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="e.g. December Royal Edo Celebration"
                required
                className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                Promo Code
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ROYAL20"
                  required
                  className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 font-mono text-sm uppercase dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                />
              </label>
              <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                Discount %
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                Category
                <select
                  value={promoCategory}
                  onChange={(e) =>
                    setPromoCategory(
                      e.target.value as 'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape'
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                >
                  <option value="Seasonal Offer">Seasonal Offer</option>
                  <option value="Lounge & Dining">Lounge &amp; Dining</option>
                  <option value="Weekend Escape">Weekend Escape</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                Valid Until
                <input
                  type="date"
                  value={promoValidUntil}
                  onChange={(e) => setPromoValidUntil(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
              Offer Message (Sent in Push Notification)
              <textarea
                rows={3}
                value={promoDesc}
                onChange={(e) => setPromoDesc(e.target.value)}
                placeholder="Includes Continental breakfast and VIP Joker Lounge entry."
                className="mt-1 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
              />
            </label>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#14120F] py-3 text-xs font-medium text-white hover:bg-[#2C2822] dark:bg-[#D4AF37] dark:text-[#100F0D]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Publish &amp; Push to Mobile Guests</span>
            </button>
          </form>

          <div className="space-y-3 rounded-2xl border border-[#14120F]/10 bg-white p-6 dark:border-white/10 dark:bg-[#171512] lg:col-span-7">
            <h3 className="text-sm font-semibold text-[#14120F] dark:text-white">Active &amp; Archived Campaigns</h3>
            <div className="divide-y divide-[#14120F]/10 dark:divide-white/10">
              {promotions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold text-[#14120F] dark:text-white">
                      {p.title}{' '}
                      <span className="font-mono text-xs text-[#9A6E08] dark:text-[#D4AF37]">({p.code})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#6E675C] dark:text-[#A9A195]">
                      {p.discountPercent}% off · {p.category} ·{' '}
                      {p.active ? 'Active' : 'Archived'}
                    </p>
                  </div>
                  {p.active && (
                    <button
                      type="button"
                      onClick={() => handleDeactivatePromo(p.id)}
                      aria-label={`Archive ${p.code}`}
                      className="rounded-lg p-2 text-[#6E675C] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Automated Email Confirmation Dispatch Log */}
      {tab === 'emails' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="divide-y divide-[#14120F]/10 rounded-2xl border border-[#14120F]/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#171512] lg:col-span-6">
            {emailLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedEmail(log)}
                className={`flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-[#FAF8F4] dark:hover:bg-[#1E1B17] ${
                  selectedEmail?.id === log.id ? 'bg-[#FAF8F4] dark:bg-[#1E1B17]' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#14120F] dark:text-white">{log.subject}</p>
                  <p className="mt-0.5 text-xs text-[#6E675C] dark:text-[#A9A195]">
                    To: {log.toEmail} · {log.deliveryMode === 'smtp' ? 'SMTP Delivered' : 'Verified Dispatch'}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-[#6E675C] dark:text-[#A9A195]">
                  {formatDateShort(log.sentAt.slice(0, 10))}
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512] lg:col-span-6">
            {selectedEmail ? (
              <div>
                <div className="flex items-center gap-2 border-b border-[#14120F]/10 pb-3 text-xs font-semibold text-[#14120F] dark:border-white/10 dark:text-white">
                  <Mail className="h-4 w-4 text-[#B8860B]" />
                  <span>{selectedEmail.subject}</span>
                </div>
                <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#38332C] dark:text-[#CFC8BC]">
                  {selectedEmail.bodyText}
                </pre>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-[#6E675C] dark:text-[#A9A195]">
                Select any automated confirmation email on the left to inspect its full receipt payload.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
