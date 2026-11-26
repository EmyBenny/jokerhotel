export type RoomTier = 'Classic' | 'Executive' | 'Suite' | 'Signature' | 'Presidential';

export type RoomStatus = 'available' | 'maintenance' | 'sold_out';

export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export type PaymentMethod = 'card' | 'bank_transfer' | 'pay_at_hotel';

export type LoyaltyTier = 'Spade Silver' | 'Gold Crown' | 'Obsidian VIP';

export interface RoomCategory {
  id: string;
  slug: string;
  name: string;
  tier: RoomTier;
  tagline: string;
  description: string;
  nightlyRateNgn: number;
  maxGuests: number;
  bedConfig: string;
  sizeSqm: number;
  totalUnits: number;
  maintenanceUnits: number;
  availableUnits?: number;
  status: RoomStatus;
  imageUrl: string;
  amenities: string[];
  highlights: string[];
}

export interface HotelAmenity {
  id: string;
  title: string;
  category: string;
  description: string;
  hours: string;
  flyerDepartment: string;
}

export interface Reservation {
  id: string;
  bookingRef: string;
  roomId: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  specialRequests: string;
  airportPickup: boolean;
  promoCode?: string;
  subtotalNgn: number;
  serviceFeeNgn: number;
  promoDiscountNgn: number;
  loyaltyDiscountNgn: number;
  totalPaidNgn: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  cardLast4?: string;
  cardBrand?: string;
  paymentStatus: 'paid' | 'guaranteed_hold' | 'refunded';
  status: ReservationStatus;
  pointsEarned: number;
  pointsRedeemed: number;
  emailConfirmedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  bookingRef: string;
  toEmail: string;
  guestName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  deliveryMode: 'smtp' | 'dispatch_log';
  status: 'sent';
  sentAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  date: string;
  description: string;
  pointsDelta: number;
  bookingRef?: string;
}

export interface LoyaltyAccount {
  memberId: string;
  guestEmail: string;
  guestName: string;
  points: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  history: LoyaltyLedgerEntry[];
}

export interface SeasonalPromotion {
  id: string;
  title: string;
  code: string;
  discountPercent: number;
  validUntil: string;
  description: string;
  category: 'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape';
  active: boolean;
  createdAt: string;
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'booking_reminder' | 'promotion' | 'reservation';
  bookingRef?: string;
  promoCode?: string;
  createdAt: string;
}

export interface HotelProfile {
  name: string;
  location: string;
  address: string;
  whatsappPhone: string;
  email: string;
  flyerImageUrl: string;
  checkInTime: string;
  checkOutTime: string;
  ngnPerUsd: number;
}

export interface BookingQuote {
  roomId: string;
  roomName: string;
  nights: number;
  nightlyRateNgn: number;
  subtotalNgn: number;
  serviceFeeNgn: number;
  promoDiscountNgn: number;
  loyaltyDiscountNgn: number;
  pointsToRedeem: number;
  totalNgn: number;
  pointsToEarn: number;
  availableUnits: number;
  appliedPromoCode?: string;
}

export interface DailyAvailabilityItem {
  date: string;
  availableSuites: number;
  lowestRateNgn: number;
}

