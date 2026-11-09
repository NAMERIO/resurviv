import { describe, expect, test } from "vitest";
import {
    decideMarketRedemption,
    type MarketRedemptionFacts,
} from "../../server/src/api/freeFallTicket/altGuard";
import {
    FreeFallTicket,
    FreeFallTicketGuard,
    isFreeFallTicketLive,
} from "../../shared/defs/gameObjects/freeFallTicketDefs";
import { FreeFallTicketMsg } from "../../shared/net/freeFallTicketMsg";
import * as net from "../../shared/net/net";

const cleanSale: MarketRedemptionFacts = {
    price: 10_000,
    listingAgeMs: FreeFallTicketGuard.minListingAgeMs,
    sellerAccountAgeMs: FreeFallTicketGuard.minSellerAccountAgeMs,
    sellerMatches: FreeFallTicketGuard.minSellerMatches,
    sharedIp: false,
    friends: false,
    giftHistory: false,
    redemptionsFromSeller: 0,
    gpPaidOutLast24h: 0,
};

describe("Free Fall Ticket alt guard", () => {
    test("a 10k sale between unrelated accounts is allowed", () => {
        expect(decideMarketRedemption(cleanSale)).toBeNull();
    });

    test.each([
        [{ sharedIp: true }, "ticket_seller_linked"],
        [{ friends: true }, "ticket_seller_linked"],
        [{ giftHistory: true }, "ticket_seller_linked"],
        [{ listingAgeMs: 0 }, "ticket_listing_too_new"],
        [{ sellerAccountAgeMs: 0 }, "ticket_seller_new"],
        [{ sellerMatches: 0 }, "ticket_seller_new"],
        [
            { redemptionsFromSeller: FreeFallTicketGuard.maxRedemptionsPerSeller },
            "ticket_seller_limit",
        ],
        [
            { gpPaidOutLast24h: FreeFallTicketGuard.maxSellerPayoutPer24h },
            "ticket_daily_limit",
        ],
    ] as const)("%j is refused with %s", (override, reason) => {
        expect(decideMarketRedemption({ ...cleanSale, ...override })).toBe(reason);
    });
});

describe("Free Fall Ticket expiry", () => {
    test("stops at midnight UTC on Jan 1 2027", () => {
        expect(isFreeFallTicketLive(FreeFallTicket.expiresAt - 1)).toBe(true);
        expect(isFreeFallTicketLive(FreeFallTicket.expiresAt)).toBe(false);
    });
});

test("FreeFallTicketMsg survives serialization", () => {
    const stream = new net.MsgStream(new ArrayBuffer(64)).stream;
    const sent = new FreeFallTicketMsg();
    sent.finderId = 512;
    sent.recipientIds = [512, 7, 65000];
    sent.serialize(stream);

    stream.index = 0;
    const received = new FreeFallTicketMsg();
    received.deserialize(stream);
    expect(received.finderId).toBe(512);
    expect(received.recipientIds).toEqual([512, 7, 65000]);
});
