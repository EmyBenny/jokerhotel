import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BedDouble,
  Bell,
  Calendar,
  Car,
  CheckCircle2,
  Compass,
  FileImage,
  LayoutDashboard,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  Utensils,
  WifiOff,
  Wine,
  X,
} from 'lucide-react';
import type {
  DailyAvailabilityItem,
  HotelAmenity,
  HotelProfile,
  PushNotificationItem,
  RoomCategory,
  RoomTier,
  SeasonalPromotion,
} from './types/hotel.ts';
import { BookingModal } from './components/BookingModal.tsx';
import { SuiteDetailModal } from './components/SuiteDetailModal.tsx';
import { LoyaltyMobileView } from './components/LoyaltyMobileView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { useOnlineStatus, usePushPermission } from './hooks/usePWAInstall.ts';
import {
  addDays,
  diffNights,
  formatMoney,
  formatWeekdayDay,
  getBeninCityGreeting,
  todayIso,
  type CurrencyCode,
} from './utils/currency.ts';

type ActiveView = 'stay' | 'rewards' | 'admin';

const HERO_IMAGE = '/src/assets/images/hero_joker_hotel_1795697384371.jpg';
const DEFAULT_FLYER = '/assets/aistudio/WhatsApp_Image_2026-11-26_at_4.34.50_AM_a7eab22c.jpeg';

export default function App() {
  const [view, setView] = useState<ActiveView>('stay');
  const [profile, setProfile] = useState<HotelProfile | null>(null);
  const [rooms, setRooms] = useState<RoomCategory[]>([]);
  const [amenities, setAmenities] = useState<HotelAmenity[]>([]);
  const [promotions, setPromotions] = useState<SeasonalPromotion[]>([]);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [dailyAvailability, setDailyAvailability] = useState<DailyAvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Adaptive Lighting (Daylight Ivory vs Evening Lounge)
  const beninTime = useMemo(() => getBeninCityGreeting(), []);
  const [isDark, setIsDark] = useState<boolean>(() => beninTime.isEvening);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Search & Filter state
  const [checkIn, setCheckIn] = useState(() => addDays(todayIso(), 1));
  const [checkOut, setCheckOut] = useState(() => addDays(todayIso(), 3));
  const [guestsFilter, setGuestsFilter] = useState(1);
  const [tierFilter, setTierFilter] = useState<'All' | RoomTier>('All');
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  // Booking & Modal state
  const [inspectRoom, setInspectRoom] = useState<RoomCategory | null>(null);
  const [bookingRoom, setBookingRoom] = useState<RoomCategory | null>(null);
  const [pendingPromoCode, setPendingPromoCode] = useState('');
  const [activeGuestEmail, setActiveGuestEmail] = useState('uzorbenny51@gmail.com');
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  // Real-time Toast
  const [liveToast, setLiveToast] = useState<PushNotificationItem | null>(null);

  const isOnline = useOnlineStatus();
  const { showDeviceNotification } = usePushPermission();
  const showDeviceNotifRef = useRef(showDeviceNotification);
  showDeviceNotifRef.current = showDeviceNotification;

  const fetchBootstrap = useCallback(async (inDate: string, outDate: string) => {
    try {
      const res = await fetch(
        `/api/hotel/bootstrap?checkIn=${encodeURIComponent(inDate)}&checkOut=${encodeURIComponent(outDate)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setProfile(data.profile);
      setRooms(data.rooms || []);
      setAmenities(data.amenities || []);
      setPromotions(data.promotions || []);
      setNotifications(data.notifications || []);
      setDailyAvailability(data.dailyAvailability || []);
    } catch {
      // keep cached view
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap(checkIn, checkOut);
  }, [fetchBootstrap, checkIn, checkOut]);

  // Real-time WebSocket synchronization
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; payload?: unknown };
          if (msg.type === 'availability:updated') {
            const payload = msg.payload as { rooms?: RoomCategory[] };
            if (payload?.rooms) {
              setRooms(payload.rooms);
            }
          } else if (msg.type === 'promotion:published') {
            const payload = msg.payload as { promotions?: SeasonalPromotion[] };
            if (payload?.promotions) {
              setPromotions(payload.promotions);
            }
          } else if (msg.type === 'notification:push') {
            const notif = msg.payload as PushNotificationItem;
            if (notif?.id) {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === notif.id)) return prev;
                return [notif, ...prev];
              });
              setLiveToast(notif);
              showDeviceNotifRef.current(notif.title, notif.body, notif.id);
              window.setTimeout(() => {
                setLiveToast((curr) => (curr?.id === notif.id ? null : curr));
              }, 7000);
            }
          }
        } catch {
          // ignore malformed event
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const handleAvailabilitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBootstrap(checkIn, checkOut);
    document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePresetStay = (startOffsetDays: number, nights: number) => {
    const nextIn = addDays(todayIso(), startOffsetDays);
    const nextOut = addDays(nextIn, nights);
    setCheckIn(nextIn);
    setCheckOut(nextOut);
  };

  const handleNavClick = (targetView: ActiveView, anchor?: string) => {
    setView(targetView);
    if (anchor) {
      window.setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleApplyPromoAndBook = (code: string) => {
    setPendingPromoCode(code);
    setView('stay');
    const candidate = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0];
    if (candidate) {
      setBookingRoom(candidate);
    }
  };

  const stayNights = diffNights(checkIn, checkOut);
  const totalOpenUnits = rooms.reduce((sum, r) => sum + (r.availableUnits ?? 0), 0);
  const totalCapacityUnits = rooms.reduce((sum, r) => sum + r.totalUnits, 0);

  // Smart suite matchmaker: picks best available suite matching guest count
  const recommendedRoomId = useMemo(() => {
    const eligible = rooms.filter((r) => r.status === 'available' && (r.availableUnits ?? 0) > 0 && r.maxGuests >= guestsFilter);
    if (eligible.length === 0) return null;
    if (guestsFilter >= 3) {
      return eligible.find((r) => r.tier === 'Suite' || r.tier === 'Presidential')?.id || eligible[0].id;
    }
    if (stayNights >= 3) {
      return eligible.find((r) => r.tier === 'Signature' || r.tier === 'Executive')?.id || eligible[0].id;
    }
    return eligible.find((r) => r.tier === 'Executive')?.id || eligible[0].id;
  }, [rooms, guestsFilter, stayNights]);

  const filteredRooms = rooms.filter((room) => {
    const matchesTier = tierFilter === 'All' || room.tier === tierFilter;
    const matchesGuests = room.maxGuests >= guestsFilter;
    return matchesTier && matchesGuests;
  });

  const ngnPerUsd = profile?.ngnPerUsd || 1580;

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#14120F] transition-colors duration-200 dark:bg-[#0E0D0B] dark:text-[#F5F2EB] pb-20 md:pb-0">
      {/* Desktop Top Navigation — Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-[#14120F]/10 bg-[#F7F5F0]/95 backdrop-blur-md dark:border-white/10 dark:bg-[#0E0D0B]/95">
        <div className="mx-auto hidden max-w-7xl items-center justify-between gap-8 px-6 py-4 md:flex lg:px-8">
          <button
            type="button"
            onClick={() => handleNavClick('stay')}
            className="font-editorial text-2xl font-semibold tracking-tight text-[#14120F] dark:text-white whitespace-nowrap shrink-0"
          >
            Joker Hotel &amp; Suites
          </button>

          <nav className="flex items-center gap-7 text-sm font-medium text-[#4A453D] dark:text-[#CFC8BC]">
            <button
              type="button"
              onClick={() => handleNavClick('stay', 'suites')}
              className={`hover:text-[#14120F] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'stay' ? 'text-[#14120F] dark:text-white' : ''
              }`}
            >
              Suites
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('stay', 'amenities')}
              className="hover:text-[#14120F] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Amenities
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('rewards')}
              className={`hover:text-[#14120F] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'rewards' ? 'text-[#9A6E08] dark:text-[#D4AF37] underline' : ''
              }`}
            >
              Rewards &amp; Alerts
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`hover:text-[#14120F] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'admin' ? 'text-[#9A6E08] dark:text-[#D4AF37] underline' : ''
              }`}
            >
              Admin
            </button>
          </nav>

          <button
            type="button"
            onClick={() => {
              const firstAvailable = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0] || null;
              setPendingPromoCode('');
              setBookingRoom(firstAvailable);
            }}
            className="rounded-lg bg-[#14120F] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#2C2822] dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C] transition-colors whitespace-nowrap shrink-0"
          >
            Book a Stay
          </button>
        </div>

        {/* Mobile Compact Header (48px height, well within 15% cap with bottom tab bar) */}
        <div className="flex h-12 items-center justify-between px-4 md:hidden">
          <button
            type="button"
            onClick={() => handleNavClick('stay')}
            className="font-editorial text-xl font-semibold text-[#14120F] dark:text-white whitespace-nowrap shrink-0"
          >
            Joker Hotel &amp; Suites
          </button>
          <button
            type="button"
            onClick={() => {
              const firstAvailable = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0] || null;
              setBookingRoom(firstAvailable);
            }}
            className="rounded-lg bg-[#14120F] px-3.5 py-1.5 text-xs font-medium text-white dark:bg-[#D4AF37] dark:text-[#100F0D] whitespace-nowrap shrink-0"
          >
            Book Now
          </button>
        </div>
      </header>

      {/* Main Content */}
      {view === 'stay' && (
        <main>
          {/* Hero Section — 2-Column Balanced Architectural Split */}
          <section className="mx-auto max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-10">
            <div className="grid items-stretch gap-8 lg:grid-cols-12">
              <div className="flex flex-col justify-between rounded-2xl bg-[#100F0D] p-7 text-white sm:p-10 lg:col-span-6 dark:border dark:border-white/10">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium tracking-wide text-[#D4AF37]">
                      {beninTime.greeting} · {beninTime.watClock}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDark((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 hover:border-[#D4AF37] hover:text-white transition-colors whitespace-nowrap"
                    >
                      {isDark ? <Sun className="h-3.5 w-3.5 text-[#D4AF37]" /> : <Moon className="h-3.5 w-3.5 text-[#D4AF37]" />}
                      <span>{isDark ? 'Daylight Ivory' : 'Evening Lounge'}</span>
                    </button>
                  </div>

                  <h1 className="mt-4 font-editorial text-4xl font-semibold leading-[1.08] text-white sm:text-5xl [text-wrap:balance]">
                    Signature hospitality &amp; evening lounge elegance in Benin City.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
                    Reserve across five distinct room and suite tiers with real-time availability,
                    verified checkout, Continental fine dining, private chauffeur transfers, and 24/7
                    uniformed security.
                  </p>
                  <p className="mt-4 tabular-nums text-xs text-white/60">
                    {totalOpenUnits} of {totalCapacityUnits} suites open for your selected dates · WhatsApp 0905 048 3401
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-lg bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-[#100F0D] hover:bg-[#E0BE4C] transition-colors whitespace-nowrap"
                  >
                    Explore 5 Suites
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFlyerModal(true)}
                    className="inline-flex items-center gap-2 text-xs font-medium text-white/80 hover:text-[#D4AF37] underline underline-offset-4 whitespace-nowrap"
                  >
                    <FileImage className="h-4 w-4" />
                    <span>View Hotel Flyer</span>
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-[#1C1A16] lg:col-span-6 min-h-[280px]">
                <img
                  src={HERO_IMAGE}
                  alt="Joker Hotel & Suites evening lobby and cocktail lounge in Benin City"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover lg:h-full"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-2 text-white">
                  <div>
                    <p className="text-xs text-[#D4AF37]">Joker Lounge &amp; Continental Kitchen</p>
                    <p className="font-editorial text-xl font-medium">
                      GRA Executive Boulevard, Benin City
                    </p>
                  </div>
                  <span className="font-mono text-xs text-white/80">Check-in 14:00 WAT</span>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Live Booking Availability Bar + Quick Presets */}
            <div className="mt-6 rounded-2xl border border-[#14120F]/10 bg-white p-5 dark:border-white/10 dark:bg-[#171512]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#14120F]/10 pb-3 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-[#6E675C] dark:text-[#A9A195]">Quick Stay Presets:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(0, 1)}
                    className="rounded-md bg-[#F7F5F0] px-2.5 py-1 font-medium text-[#14120F] hover:bg-[#EAE5DC] dark:bg-[#23201B] dark:text-[#EAE5DC]"
                  >
                    Tonight (1n)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(1, 2)}
                    className="rounded-md bg-[#F7F5F0] px-2.5 py-1 font-medium text-[#14120F] hover:bg-[#EAE5DC] dark:bg-[#23201B] dark:text-[#EAE5DC]"
                  >
                    Weekend (2n)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(2, 3)}
                    className="rounded-md bg-[#F7F5F0] px-2.5 py-1 font-medium text-[#14120F] hover:bg-[#EAE5DC] dark:bg-[#23201B] dark:text-[#EAE5DC]"
                  >
                    Executive (3n)
                  </button>
                </div>
                <span className="tabular-nums text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37]">
                  {stayNights} {stayNights === 1 ? 'Night' : 'Nights'} Selected
                </span>
              </div>

              <form onSubmit={handleAvailabilitySearch} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                  Check-In Date
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      const nextIn = e.target.value;
                      setCheckIn(nextIn);
                      if (nextIn >= checkOut) {
                        setCheckOut(addDays(nextIn, 1));
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2.5 text-sm text-[#14120F] focus:border-[#B8860B] focus:outline-none dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                  />
                </label>

                <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                  Check-Out Date
                  <input
                    type="date"
                    value={checkOut}
                    min={addDays(checkIn, 1)}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2.5 text-sm text-[#14120F] focus:border-[#B8860B] focus:outline-none dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                  />
                </label>

                <label className="block text-xs font-medium text-[#4A453D] dark:text-[#CFC8BC]">
                  Guests per Suite
                  <select
                    value={guestsFilter}
                    onChange={(e) => setGuestsFilter(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-[#14120F]/15 bg-[#F7F5F0] px-3 py-2.5 text-sm text-[#14120F] focus:border-[#B8860B] focus:outline-none dark:border-white/15 dark:bg-[#1E1B17] dark:text-white"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#14120F] px-4 text-xs font-medium text-white hover:bg-[#2C2822] dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C] transition-colors whitespace-nowrap"
                  >
                    <Calendar className="h-4 w-4 text-[#D4AF37] dark:text-[#100F0D]" />
                    <span>Check Live Availability</span>
                  </button>
                </div>
              </form>

              {/* 7-Day Interactive Live Availability Strip */}
              {dailyAvailability.length > 0 && (
                <div className="mt-4 border-t border-[#14120F]/10 pt-4 dark:border-white/10">
                  <p className="mb-2.5 text-xs font-medium text-[#6E675C] dark:text-[#A9A195]">
                    7-Day Live Check-In Forecast (tap a date to update availability)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {dailyAvailability.map((day) => {
                      const fmt = formatWeekdayDay(day.date);
                      const isSelected = day.date === checkIn;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => {
                            setCheckIn(day.date);
                            setCheckOut(addDays(day.date, stayNights));
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'border-[#B8860B] bg-[#100F0D] text-white dark:bg-[#D4AF37] dark:text-[#100F0D]'
                              : 'border-[#14120F]/10 bg-[#F7F5F0] text-[#14120F] hover:border-[#B8860B]/60 dark:border-white/10 dark:bg-[#1E1B17] dark:text-[#F5F2EB]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={isSelected ? 'text-[#D4AF37] dark:text-[#100F0D]' : 'text-[#6E675C] dark:text-[#A9A195]'}>
                              {fmt.weekday} {fmt.day} {fmt.month}
                            </span>
                            <span className="tabular-nums font-semibold">
                              {day.availableSuites} free
                            </span>
                          </div>
                          <p className="mt-1 tabular-nums text-xs font-medium">
                            From {formatMoney(day.lowestRateNgn, currency, ngnPerUsd)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 5 Room Categories Showcase */}
          <section id="suites" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 border-b border-[#14120F]/10 pb-6 dark:border-white/10 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37]">Accommodation Collection</p>
                <h2 className="mt-1 font-editorial text-3xl font-semibold text-[#14120F] dark:text-white sm:text-4xl [text-wrap:balance]">
                  Five Distinct Room &amp; Suite Categories
                </h2>
              </div>

              {/* Section Toolbar: Tier Filter Tabs + Currency Switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl border border-[#14120F]/10 bg-white p-1 dark:border-white/10 dark:bg-[#171512]">
                  {(['All', 'Classic', 'Executive', 'Suite', 'Signature', 'Presidential'] as const).map(
                    (tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setTierFilter(tier)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          tierFilter === tier
                            ? 'bg-[#14120F] text-white dark:bg-[#D4AF37] dark:text-[#100F0D]'
                            : 'text-[#6E675C] hover:text-[#14120F] dark:text-[#A9A195] dark:hover:text-white'
                        }`}
                      >
                        {tier}
                      </button>
                    )
                  )}
                </div>

                <div className="flex rounded-xl border border-[#14120F]/10 bg-white p-1 dark:border-white/10 dark:bg-[#171512]">
                  {(['NGN', 'USD'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                        currency === code
                          ? 'bg-[#14120F] text-white dark:bg-[#D4AF37] dark:text-[#100F0D]'
                          : 'text-[#6E675C] hover:text-[#14120F] dark:text-[#A9A195] dark:hover:text-white'
                      }`}
                    >
                      {code === 'NGN' ? '₦ NGN' : '$ USD'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-96 animate-pulse rounded-2xl border border-[#14120F]/10 bg-white dark:border-white/10 dark:bg-[#171512]"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredRooms.map((room) => {
                  const avail = room.availableUnits ?? 0;
                  const isBookable = room.status === 'available' && avail > 0;
                  const isRecommended = room.id === recommendedRoomId;
                  const estSubtotal = room.nightlyRateNgn * stayNights;
                  const estTotal = estSubtotal + Math.round(estSubtotal * 0.075);

                  return (
                    <article
                      key={room.id}
                      className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition-transform duration-200 hover:-translate-y-0.5 dark:bg-[#171512] ${
                        isRecommended
                          ? 'border-[#B8860B]/60 dark:border-[#D4AF37]/60'
                          : 'border-[#14120F]/10 dark:border-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setInspectRoom(room)}
                        className="relative aspect-[4/3] w-full overflow-hidden bg-[#1C1A16] text-left focus:outline-none"
                      >
                        <img
                          src={room.imageUrl}
                          alt={room.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </button>

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[#6E675C] dark:text-[#A9A195]">
                            <span>
                              {room.tier} · {room.sizeSqm} m² · {room.bedConfig}
                            </span>
                            <span
                              className={`tabular-nums font-medium shrink-0 ${
                                isBookable ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {isBookable
                                ? `${avail} left`
                                : room.status === 'maintenance'
                                ? 'Maintenance'
                                : 'Sold Out'}
                            </span>
                          </div>

                          {isRecommended && (
                            <p className="mt-2 text-xs font-semibold text-[#9A6E08] dark:text-[#D4AF37]">
                              Recommended Match for {guestsFilter} {guestsFilter === 1 ? 'Guest' : 'Guests'}
                            </p>
                          )}

                          <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#14120F] dark:text-white">
                            {room.name}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#4A453D] dark:text-[#CFC8BC]">
                            {room.description}
                          </p>

                          <ul className="mt-4 space-y-1.5 border-t border-[#14120F]/10 pt-4 text-xs text-[#4A453D] dark:border-white/10 dark:text-[#CFC8BC]">
                            {room.amenities.slice(0, 4).map((feat) => (
                              <li key={feat} className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#B8860B]" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-6 space-y-3 border-t border-[#14120F]/10 pt-4 dark:border-white/10">
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <p className="tabular-nums text-xl font-bold text-[#14120F] dark:text-white">
                                {formatMoney(room.nightlyRateNgn, currency, ngnPerUsd)}
                                <span className="text-xs font-normal text-[#6E675C] dark:text-[#A9A195]"> / night</span>
                              </p>
                              <p className="tabular-nums text-xs text-[#6E675C] dark:text-[#A9A195]">
                                {stayNights}n est: {formatMoney(estTotal, currency, ngnPerUsd)} incl. VAT
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectRoom(room)}
                              className="text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37] hover:underline whitespace-nowrap"
                            >
                              Inspect Suite
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={!isBookable}
                            onClick={() => {
                              setPendingPromoCode('');
                              setBookingRoom(room);
                            }}
                            className="min-h-[44px] w-full rounded-lg bg-[#14120F] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2C2822] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C] whitespace-nowrap"
                          >
                            {isBookable ? 'Reserve Suite' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Hotel Amenities Section */}
          <section
            id="amenities"
            className="border-t border-[#14120F]/10 bg-white py-14 dark:border-white/10 dark:bg-[#14120F]"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-medium text-[#9A6E08] dark:text-[#D4AF37]">
                    On-Site Operations &amp; Amenities
                  </p>
                  <h2 className="mt-1 font-editorial text-3xl font-semibold text-[#14120F] dark:text-white sm:text-4xl [text-wrap:balance]">
                    Dedicated hospitality teams across dining, lounge, transport &amp; security.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavClick('rewards')}
                  className="shrink-0 rounded-lg bg-[#14120F] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#2C2822] dark:bg-[#D4AF37] dark:text-[#100F0D] dark:hover:bg-[#E0BE4C] whitespace-nowrap"
                >
                  Royal Club Rewards
                </button>
              </div>

              <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {amenities.map((amen) => (
                  <div
                    key={amen.id}
                    className="border-t border-[#14120F]/10 pt-4 dark:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#6E675C] dark:text-[#A9A195]">
                      <span>{amen.category}</span>
                      <span>{amen.hours}</span>
                    </div>
                    <h3 className="mt-1.5 flex items-center gap-2 text-base font-semibold text-[#14120F] dark:text-white">
                      {amen.category === 'Culinary' && <Utensils className="h-4 w-4 text-[#B8860B]" />}
                      {amen.category === 'Lounge & F&B' && <Wine className="h-4 w-4 text-[#B8860B]" />}
                      {amen.category === 'Transport' && <Car className="h-4 w-4 text-[#B8860B]" />}
                      {amen.category === 'Safety' && <ShieldCheck className="h-4 w-4 text-[#B8860B]" />}
                      {amen.category === 'Guest Services' && <Phone className="h-4 w-4 text-[#B8860B]" />}
                      {amen.category === 'In-Room' && <BedDouble className="h-4 w-4 text-[#B8860B]" />}
                      <span>{amen.title}</span>
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#4A453D] dark:text-[#CFC8BC]">
                      {amen.description}
                    </p>
                    <p className="mt-2 text-xs text-[#9A6E08] dark:text-[#D4AF37]">
                      Operated by: {amen.flyerDepartment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {view === 'rewards' && (
        <LoyaltyMobileView
          activeGuestEmail={activeGuestEmail}
          onChangeGuestEmail={setActiveGuestEmail}
          notifications={notifications}
          promotions={promotions}
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onApplyPromoAndBook={handleApplyPromoAndBook}
          onNewNotification={(notif) =>
            setNotifications((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]))
          }
        />
      )}

      {view === 'admin' && (
        <AdminDashboard
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onRoomsUpdated={(nextRooms) => setRooms(nextRooms)}
          onPromotionsUpdated={(nextPromos) => setPromotions(nextPromos)}
        />
      )}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#14120F]/10 bg-[#100F0D] py-10 text-white dark:border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="font-editorial text-2xl font-semibold text-white">Joker Hotel &amp; Suites</p>
            <p className="mt-1 text-xs text-white/65">
              GRA Executive Boulevard, Benin City, Edo State · WhatsApp {profile?.whatsappPhone || '0905 048 3401'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <PWAInstallButton variant="dark" />
            <span className="text-xs text-white/50">
              © {new Date().getFullYear()} Joker Hotel &amp; Suites
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Tab Bar (56px height, <15% total sticky budget) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-4 border-t border-[#14120F]/10 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#14120F]/95 md:hidden pb-safe"
      >
        <button
          type="button"
          onClick={() => handleNavClick('stay', 'suites')}
          className={`flex flex-col items-center justify-center ${
            view === 'stay' ? 'text-[#9A6E08] dark:text-[#D4AF37]' : 'text-[#6E675C] dark:text-[#A9A195]'
          }`}
        >
          <Compass className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Suites</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('stay', 'amenities')}
          className="flex flex-col items-center justify-center text-[#6E675C] dark:text-[#A9A195]"
        >
          <Wine className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Lounge</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('rewards')}
          className={`relative flex flex-col items-center justify-center ${
            view === 'rewards' ? 'text-[#9A6E08] dark:text-[#D4AF37]' : 'text-[#6E675C] dark:text-[#A9A195]'
          }`}
        >
          <Award className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Rewards</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('admin')}
          className={`flex flex-col items-center justify-center ${
            view === 'admin' ? 'text-[#9A6E08] dark:text-[#D4AF37]' : 'text-[#6E675C] dark:text-[#A9A195]'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Admin</span>
        </button>
      </nav>

      {/* Suite Inspection Modal */}
      <SuiteDetailModal
        room={inspectRoom}
        checkIn={checkIn}
        checkOut={checkOut}
        currency={currency}
        ngnPerUsd={ngnPerUsd}
        onClose={() => setInspectRoom(null)}
        onReserve={(room) => {
          setInspectRoom(null);
          setPendingPromoCode('');
          setBookingRoom(room);
        }}
      />

      {/* Booking & Payment Modal */}
      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          initialCheckIn={checkIn}
          initialCheckOut={checkOut}
          initialPromoCode={pendingPromoCode}
          initialGuestEmail={activeGuestEmail}
          promotions={promotions}
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onClose={() => setBookingRoom(null)}
          onBookingCompleted={({ reservation, loyalty }) => {
            setActiveGuestEmail(reservation.guestEmail);
            fetchBootstrap(checkIn, checkOut);
            showDeviceNotifRef.current(
              `Booking Confirmed · ${reservation.bookingRef}`,
              `${reservation.roomName} confirmed. +${loyalty.points} pts in Joker Royal Club.`,
              reservation.bookingRef
            );
          }}
        />
      )}

      {/* Official Flyer Inspection Modal */}
      {showFlyerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Official Joker Hotel & Suites Flyer"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-[#100F0D] p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[#D4AF37]">
                Joker Hotel &amp; Suites · Benin City, Edo
              </span>
              <button
                type="button"
                onClick={() => setShowFlyerModal(false)}
                aria-label="Close flyer modal"
                className="rounded-lg p-1.5 text-white/75 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={profile?.flyerImageUrl || DEFAULT_FLYER}
              alt="Joker Hotel & Suites Official Flyer"
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Real-Time Push Notification Toast */}
      {liveToast && (
        <div className="fixed right-4 top-16 z-50 w-80 rounded-xl border border-[#D4AF37]/40 bg-[#100F0D] p-4 text-white shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#D4AF37]">
              <Bell className="h-3.5 w-3.5" />
              <span>Live Concierge Alert</span>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Dismiss notification"
              className="text-white/60 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-sm font-semibold">{liveToast.title}</p>
          <p className="mt-1 text-xs text-white/75">{liveToast.body}</p>
        </div>
      )}

      {/* Offline PWA Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#100F0D] px-3.5 py-2 text-xs font-medium text-[#D4AF37] shadow-lg md:bottom-4">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode · Viewing cached suite catalog</span>
        </div>
      )}
    </div>
  );
}
