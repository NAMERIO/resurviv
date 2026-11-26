const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const FreeFallTicket = {
    name: "Free Fall Ticket",
    expiresAt: Date.UTC(2027, 0, 1),
    maxFreeCratesPer24h: 5,
} as const;

export const FreeFallTicketGuard = {
    minListingAgeMs: HOUR_MS,
    minSellerAccountAgeMs: 14 * DAY_MS,
    minSellerMatches: 10,
    maxRedemptionsPerSeller: 2,
    maxSellerPayoutPer24h: 30_000,
} as const;

export function isFreeFallTicketLive(now = Date.now()) {
    return now < FreeFallTicket.expiresAt;
}
