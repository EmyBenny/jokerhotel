import React, { useState } from 'react';
import {
  BedDouble,
  Calendar,
  Camera,
  CheckCircle2,
  Crown,
  Dumbbell,
  MapPin,
  PartyPopper,
  PhoneCall,
  Play,
  Send,
  ShoppingBag,
  UtensilsCrossed,
  Video,
  Waves,
} from 'lucide-react';
import type { HotelAmenity, HotelProfile, InquiryCategory, ServiceInquiry } from '../types/hotel.ts';
import { fetchJson } from '../utils/api.ts';

interface ExperienceShowcaseProps {
  amenities: HotelAmenity[];
  profile: HotelProfile | null;
  onExploreSuites: () => void;
  onOpenRewards: () => void;
}

interface VideoReelItem {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  videoUrl: string;
  posterUrl: string;
  inquiryCategory: InquiryCategory;
  ctaLabel: string;
}

const VIDEO_REELS: VideoReelItem[] = [
  {
    id: 'reel-gym-pool',
    label: '24/7 Gym & Swimming',
    subtitle: 'Wellness Deck & Memberships',
    description:
      'Floodlit resort swimming pool and 24-hour cardio & strength studio open round the clock to hotel guests and monthly Gym Membership subscribers.',
    videoUrl: '/videos/joker-gym-pool-tour.mp4',
    posterUrl: '/src/assets/images/facility_pool_gym_1795699580653.jpg',
    inquiryCategory: 'Gym Membership',
    ctaLabel: 'Join Gym Membership',
  },
  {
    id: 'reel-gold-lounge',
    label: 'Gold Room Lounge',
    subtitle: 'VIP Evening Lounge & Bar',
    description:
      'Signature brass and cognac leather VIP lounge pouring aged spirits, craft cocktails, and grilled platters deep into the Benin City evening.',
    videoUrl: '/videos/joker-gold-lounge.mp4',
    posterUrl: '/src/assets/images/facility_gold_lounge_1795699570355.jpg',
    inquiryCategory: 'Gold Room Lounge VIP',
    ctaLabel: 'Reserve Gold Room Table',
  },
  {
    id: 'reel-events',
    label: 'Event Halls & Dinners',
    subtitle: 'Banquets, Meetings & Celebrations',
    description:
      'Versatile executive conference suites, grand reception halls, and bespoke candlelit Celebration Dinner table staging.',
    videoUrl: '/videos/joker-events-celebrations.mp4',
    posterUrl: '/src/assets/images/facility_event_hall_1795699570632.jpg',
    inquiryCategory: 'Event & Meeting Hall',
    ctaLabel: 'Book Event or Dinner',
  },
  {
    id: 'reel-kitchen',
    label: 'Joker Kitchen (24/7)',
    subtitle: 'Takeout & Delivery · Local & Intercontinental',
    description:
      'Prepared fresh round the clock by our Continental Chef & culinary brigade — Edo delicacies, continental grills, pastries, and express takeout or delivery.',
    videoUrl: '/videos/joker-kitchen-24-7.mp4',
    posterUrl: '/src/assets/images/facility_joker_kitchen_1795699569853.jpg',
    inquiryCategory: 'Joker Kitchen (24/7) Takeout & Delivery',
    ctaLabel: 'Order Takeout / Delivery',
  },
];

interface DestinationHighlight {
  id: string;
  title: string;
  subtitle: string;
  hours: string;
  description: string;
  imageUrl: string;
  icon: React.ReactNode;
  actionLabel: string;
  inquiryCategory?: InquiryCategory;
  isSuiteLink?: boolean;
}

const DESTINATION_CARDS: DestinationHighlight[] = [
  {
    id: 'dest-rooms',
    title: 'Luxury Rooms + Free Breakfast',
    subtitle: '5 Suite Categories · Complimentary Breakfast',
    hours: 'Breakfast 06:30 – 10:30',
    description:
      'Classic, Executive, Ambassadorial, Signature Lounge, and Royal Presidential Suites with 24/7 uninterrupted power and daily complimentary breakfast.',
    imageUrl: '/src/assets/images/room_joker_lounge_suite_1795697386718.jpg',
    icon: <BedDouble className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'View Luxury Suites',
    isSuiteLink: true,
  },
  {
    id: 'dest-gym-pool',
    title: '24/7 Gym & Swimming · Gym Memberships',
    subtitle: 'Poolside Lounge & Fitness Studio',
    hours: 'Open 24/7 Daily',
    description:
      'Dive into our illuminated courtyard swimming pool or train in our equipped gym any hour. Flexible monthly and corporate Gym Memberships available.',
    imageUrl: '/src/assets/images/facility_pool_gym_1795699580653.jpg',
    icon: <Dumbbell className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Inquire Gym Membership',
    inquiryCategory: 'Gym Membership',
  },
  {
    id: 'dest-gold-lounge',
    title: 'Gold Room Lounge',
    subtitle: 'VIP Cocktails, Wines & Bottle Service',
    hours: '16:00 – 02:00 Daily',
    description:
      'An intimate brass-and-marble sanctuary tailored for private mixers, after-hours cocktails, and VIP table hospitality.',
    imageUrl: '/src/assets/images/facility_gold_lounge_1795699570355.jpg',
    icon: <Crown className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Book Gold Room Booth',
    inquiryCategory: 'Gold Room Lounge VIP',
  },
  {
    id: 'dest-events',
    title: 'Event & Meeting Halls · Celebration Dinners',
    subtitle: 'Corporate Conferences & Private Banquets',
    hours: '07:00 – 00:00 By Booking',
    description:
      'Host board meetings, receptions, birthdays, and multi-course Celebration Dinners with custom table styling and dedicated audio-visual support.',
    imageUrl: '/src/assets/images/facility_event_hall_1795699570632.jpg',
    icon: <PartyPopper className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Plan Event or Dinner',
    inquiryCategory: 'Event & Meeting Hall',
  },
  {
    id: 'dest-kitchen',
    title: 'Joker Kitchen (24/7) – Takeout & Delivery',
    subtitle: 'Local & Intercontinental Dishes',
    hours: '24/7 Kitchen & Dispatch',
    description:
      'Order authentic Nigerian soups, jollof platters, pasta, steaks, and continental dishes 24/7 for dine-in, quick pickup, or delivery across Benin City.',
    imageUrl: '/src/assets/images/facility_joker_kitchen_1795699569853.jpg',
    icon: <UtensilsCrossed className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Place Kitchen Order',
    inquiryCategory: 'Joker Kitchen (24/7) Takeout & Delivery',
  },
  {
    id: 'dest-supermarket',
    title: 'On-Site Supermarket',
    subtitle: 'Beverages, Snacks & Daily Essentials',
    hours: '07:00 – 23:30 Daily',
    description:
      'Step right inside for chilled drinks, imported groceries, wines, travel toiletries, and late-night snacks without leaving the property.',
    imageUrl: '/src/assets/images/facility_supermarket_mart_1795699569847.jpg',
    icon: <ShoppingBag className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Request Mart Delivery',
    inquiryCategory: 'Supermarket Concierge',
  },
  {
    id: 'dest-photoshoot',
    title: 'Photo Shoots & Studio Locations',
    subtitle: 'Bridal, Editorial & Brand Bookings',
    hours: '08:00 – 20:00 Daily',
    description:
      'Reserve our poolside cabanas, Gold Room Lounge interiors, and chandelier foyers for professional bridal, fashion, and commercial photo shoots.',
    imageUrl: '/src/assets/images/facility_photoshoot_studio_1795699571078.jpg',
    icon: <Camera className="h-4 w-4 text-[#B8860B]" />,
    actionLabel: 'Book Photo Shoot Slot',
    inquiryCategory: 'Photo Shoot Session',
  },
];

const INQUIRY_OPTIONS: InquiryCategory[] = [
  'Joker Kitchen (24/7) Takeout & Delivery',
  'Gym Membership',
  'Event & Meeting Hall',
  'Celebration Dinner',
  'Photo Shoot Session',
  'Gold Room Lounge VIP',
  'Supermarket Concierge',
];

export const ExperienceShowcase: React.FC<ExperienceShowcaseProps> = ({
  amenities,
  profile,
  onExploreSuites,
  onOpenRewards,
}) => {
  const [activeReelId, setActiveReelId] = useState<string>(VIDEO_REELS[0].id);
  const [selectedCategory, setSelectedCategory] = useState<InquiryCategory>(
    'Joker Kitchen (24/7) Takeout & Delivery'
  );
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedInquiry, setSubmittedInquiry] = useState<ServiceInquiry | null>(null);

  const activeReel = VIDEO_REELS.find((r) => r.id === activeReelId) || VIDEO_REELS[0];
  const replyPhone = profile?.replyPhone || '0905 048 3402';
  const whatsappPhone = profile?.whatsappPhone || '0905 048 3401';
  const address = profile?.address || 'Godwin Abbey Way (Limit Rd), Benin City, Edo State';

  const jumpToRequest = (category: InquiryCategory) => {
    setSelectedCategory(category);
    setSubmittedInquiry(null);
    document.getElementById('concierge-request')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const { data } = await fetchJson<{ inquiry: ServiceInquiry }>('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          guestName,
          guestPhone,
          preferredDate,
          details,
        }),
      });
      setSubmittedInquiry(data.inquiry);
      setDetails('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const secondaryOperations = amenities.filter((a) => a.id === 'amen-chauffeur-security');

  return (
    <section
      id="amenities"
      className="border-t border-[#7A5908]/20 bg-[#F3E2AC]/85 py-14 dark:border-[#D4AF37]/20 dark:bg-[#151108]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Welcome Editorial Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#7A5908]/20 pb-8 dark:border-[#D4AF37]/20 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold text-[#7D5604] dark:text-[#D4AF37]">
              Welcome to Joker Hotel &amp; Suites, Benin City
            </p>
            <h2 className="mt-1.5 font-editorial text-3xl font-semibold text-[#161106] dark:text-[#F8ECCB] sm:text-4xl [text-wrap:balance]">
              Your one-stop destination for comfort &amp; luxury.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#3E3010] dark:text-[#DECFA8]">
              From luxury rooms with complimentary breakfast to 24/7 swimming and gym access, the
              Gold Room Lounge, event halls, celebration dinners, photo shoot studios, an on-site
              supermarket, and Joker Kitchen 24/7 delivery — all at {address}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => jumpToRequest('Joker Kitchen (24/7) Takeout & Delivery')}
              className="rounded-lg border border-[#7A5908]/30 bg-[#FCF4DB] px-4 py-2.5 text-xs font-medium text-[#161106] hover:bg-[#F4E4B4] dark:border-[#D4AF37]/25 dark:bg-[#231C0E] dark:text-[#F8ECCB] dark:hover:bg-[#2D2412] whitespace-nowrap"
            >
              Order Joker Kitchen 24/7
            </button>
            <button
              type="button"
              onClick={onOpenRewards}
              className="rounded-lg bg-[#161106] px-4 py-2.5 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158] whitespace-nowrap"
            >
              Royal Club Rewards
            </button>
          </div>
        </div>

        {/* Interactive Video Tour Reel */}
        <div className="mt-10 grid items-stretch gap-6 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1B1508] to-[#120D05] p-5 text-white lg:grid-cols-12 lg:p-6 shadow-md">
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#E5C158]">
                <Video className="h-4 w-4" />
                <span>Property Video Showcase</span>
              </div>
              <h3 className="mt-2 font-editorial text-2xl font-semibold text-white">
                {activeReel.label}
              </h3>
              <p className="mt-1 text-xs font-medium text-[#E5C158]">{activeReel.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#F5E7BA]/80">
                {activeReel.description}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {VIDEO_REELS.map((reel) => {
                  const isActive = reel.id === activeReel.id;
                  return (
                    <button
                      key={reel.id}
                      type="button"
                      onClick={() => setActiveReelId(reel.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-[#141007]'
                          : 'border-[#D4AF37]/25 bg-white/5 text-[#F8ECCB] hover:border-[#D4AF37]/60'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{reel.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#D4AF37]/20 pt-4">
              <button
                type="button"
                onClick={() => jumpToRequest(activeReel.inquiryCategory)}
                className="rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold text-[#141007] hover:bg-[#E5C158] transition-colors whitespace-nowrap"
              >
                {activeReel.ctaLabel}
              </button>
              <span className="font-mono text-xs text-[#E5C158]/85">
                Direct Reply: {replyPhone}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-black lg:col-span-7">
            <video
              key={activeReel.videoUrl}
              src={activeReel.videoUrl}
              poster={activeReel.posterUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="aspect-video h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Photography Cards for All 9 Offerings */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATION_CARDS.map((card) => (
            <article
              key={card.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#7A5908]/20 bg-[#FCF4DB] shadow-sm dark:border-[#D4AF37]/20 dark:bg-[#1E180C]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#1C160B]">
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#5F4A17] dark:text-[#CBB887]">
                    <span className="truncate">{card.subtitle}</span>
                    <span className="shrink-0 font-semibold text-[#7D5604] dark:text-[#D4AF37]">
                      {card.hours}
                    </span>
                  </div>
                  <h3 className="mt-2 flex items-center gap-2 font-editorial text-xl font-semibold text-[#161106] dark:text-[#F8ECCB]">
                    {card.icon}
                    <span>{card.title}</span>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#3E3010] dark:text-[#DECFA8]">
                    {card.description}
                  </p>
                </div>

                <div className="mt-5 border-t border-[#7A5908]/15 pt-4 dark:border-[#D4AF37]/15">
                  <button
                    type="button"
                    onClick={() =>
                      card.isSuiteLink
                        ? onExploreSuites()
                        : card.inquiryCategory && jumpToRequest(card.inquiryCategory)
                    }
                    className="w-full rounded-lg bg-[#161106] px-4 py-2.5 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158] transition-colors"
                  >
                    {card.actionLabel}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {/* Quick Multi-Service Summary Card (Gym Memberships + Celebration Dinners + Transport & Security) */}
          <article className="flex flex-col justify-between rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1B1508] to-[#120D05] p-6 text-white lg:col-span-2 shadow-sm">
            <div>
              <p className="text-xs font-medium text-[#E5C158]">
                Complete On-Site Hospitality Directory
              </p>
              <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-white">
                Memberships, Celebration Dinners, Airport Chauffeur &amp; 24/7 Security
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="border-t border-[#D4AF37]/20 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Waves className="h-4 w-4 text-[#E5C158]" />
                    <span>Gym Memberships &amp; Pool Passes</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#F5E7BA]/75">
                    Monthly, quarterly, and corporate wellness plans with 24/7 fitness studio and
                    swimming pool access.
                  </p>
                </div>
                <div className="border-t border-[#D4AF37]/20 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <PartyPopper className="h-4 w-4 text-[#E5C158]" />
                    <span>Bespoke Celebration Dinners</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#F5E7BA]/75">
                    Anniversary, proposal, and birthday tables curated with multi-course menus and
                    custom floral styling.
                  </p>
                </div>
                <div className="border-t border-[#D4AF37]/20 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UtensilsCrossed className="h-4 w-4 text-[#E5C158]" />
                    <span>24/7 Takeout &amp; City Delivery</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#F5E7BA]/75">
                    Order local Benin &amp; Nigerian favourites or intercontinental platters anytime,
                    day or night.
                  </p>
                </div>
                {secondaryOperations.map((op) => (
                  <div key={op.id} className="border-t border-[#D4AF37]/20 pt-3">
                    <p className="text-sm font-semibold text-white">{op.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#F5E7BA]/75">{op.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#D4AF37]/20 pt-4 text-xs">
              <div className="flex items-center gap-2 text-[#F5E7BA]/85">
                <MapPin className="h-4 w-4 text-[#E5C158]" />
                <span>{address}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToRequest('Celebration Dinner')}
                  className="rounded-lg border border-[#D4AF37]/35 px-3.5 py-2 font-medium text-[#F8ECCB] hover:border-[#D4AF37] hover:text-[#E5C158]"
                >
                  Book Celebration Dinner
                </button>
                <button
                  type="button"
                  onClick={() => jumpToRequest('Gym Membership')}
                  className="rounded-lg bg-[#D4AF37] px-3.5 py-2 font-semibold text-[#141007] hover:bg-[#E5C158]"
                >
                  Apply for Gym Membership
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Direct Concierge & Service Request Desk */}
        <div
          id="concierge-request"
          className="mt-10 grid gap-8 rounded-2xl border border-[#7A5908]/25 bg-[#E8CD7E]/80 p-6 dark:border-[#D4AF37]/20 dark:bg-[#1B160B] lg:grid-cols-12 lg:p-8"
        >
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <p className="text-xs font-semibold text-[#7D5604] dark:text-[#D4AF37]">
                24/7 Hospitality Desk · Benin City
              </p>
              <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#161106] dark:text-[#F8ECCB] sm:text-3xl">
                Need Kitchen Takeout, a Hall, Photo Shoot, or Gym Membership?
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#3E3010] dark:text-[#DECFA8]">
                Send your request below and a team member will reply shortly. Prefer to speak with
                our front desk right away? Call or WhatsApp directly.
              </p>
            </div>

            <div className="mt-6 space-y-3 border-t border-[#7A5908]/20 pt-5 text-sm dark:border-[#D4AF37]/20">
              <a
                href={`tel:${replyPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] px-4 py-3 text-[#161106] hover:border-[#7A5908]/50 dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#F8ECCB]"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <PhoneCall className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                  <span>Immediate Reply Line</span>
                </span>
                <span className="font-mono text-sm font-bold text-[#7D5604] dark:text-[#D4AF37]">
                  {replyPhone}
                </span>
              </a>

              <div className="flex items-center justify-between rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] px-4 py-3 text-xs text-[#3E3010] dark:border-[#D4AF37]/20 dark:bg-[#231C0E] dark:text-[#DECFA8]">
                <span className="flex items-center gap-2.5 font-medium">
                  <MapPin className="h-4 w-4 text-[#9A6E08] dark:text-[#D4AF37]" />
                  <span>{address}</span>
                </span>
                <span className="font-mono text-[11px] text-[#5F4A17] dark:text-[#CBB887]">
                  WhatsApp {whatsappPhone}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {submittedInquiry ? (
              <div className="flex h-full flex-col justify-center rounded-xl border border-emerald-800/25 bg-[#FCF4DB] p-6 dark:border-emerald-500/20 dark:bg-[#231C0E]">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-semibold">Request Received · {submittedInquiry.reference}</span>
                </div>
                <h4 className="mt-2 font-editorial text-2xl font-semibold text-[#161106] dark:text-[#F8ECCB]">
                  A team member will reply shortly.
                </h4>
                <p className="mt-2 text-sm text-[#3E3010] dark:text-[#DECFA8]">
                  We have logged your <span className="font-medium">{submittedInquiry.category}</span>{' '}
                  request for <span className="font-medium">{submittedInquiry.preferredDate}</span>.
                  For an immediate reply, call <span className="font-mono font-semibold">{replyPhone}</span>.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setSubmittedInquiry(null)}
                    className="rounded-lg bg-[#161106] px-4 py-2 text-xs font-medium text-[#F9E7B2] dark:bg-[#D4AF37] dark:text-[#141007]"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleInquirySubmit}
                className="space-y-4 rounded-xl border border-[#7A5908]/20 bg-[#FCF4DB] p-5 dark:border-[#D4AF37]/20 dark:bg-[#231C0E]"
              >
                {submitError && (
                  <div className="rounded-lg border border-red-700/20 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {submitError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Service or Order Category
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as InquiryCategory)}
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                    >
                      {INQUIRY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Preferred Date
                    <div className="relative mt-1.5">
                      <Calendar className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#5F4A17]" />
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] py-2.5 pl-9 pr-3 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                      />
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Your Full Name
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Osaro Omoregie"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                    />
                  </label>

                  <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                    Phone / WhatsApp Number
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="e.g. 0803 123 4567"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                    />
                  </label>
                </div>

                <label className="block text-xs font-medium text-[#3E3010] dark:text-[#DECFA8]">
                  Order Details, Hall Guest Count, or Request Notes
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Tell us your meal order (delivery address in Benin City), event headcount, photo shoot slot, or membership preference..."
                    className="mt-1.5 w-full rounded-lg border border-[#7A5908]/25 bg-[#F4E4B4] px-3 py-2.5 text-sm text-[#161106] focus:border-[#9A6E08] focus:outline-none dark:border-[#D4AF37]/20 dark:bg-[#171209] dark:text-[#F8ECCB]"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-[#5F4A17] dark:text-[#CBB887]">
                    A team member will reply shortly · {replyPhone} for immediate reply
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#161106] px-5 py-2.5 text-xs font-medium text-[#F9E7B2] hover:bg-[#2A200B] disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#141007] dark:hover:bg-[#E5C158]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? 'Sending...' : 'Send to Front Desk'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
