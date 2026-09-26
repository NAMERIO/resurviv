import { and, eq, inArray, or, sql } from "drizzle-orm";
import { isSkinLocked, lockedSkins } from "../../../shared/defs/gameObjects/unlockDefs";
import { marketListingDurationMs } from "../../../shared/utils/marketPricing";
import {
    auctionListingTable,
    itemsTable,
    marketListingTable,
    usersTable,
} from "./db/schema";

export async function expireMarketListings(tx: any, targetUserId?: string) {
    const cutoff = new Date(Date.now() - marketListingDurationMs);
    const expiredNow = await tx
        .update(marketListingTable)
        .set({
            status: "expired",
            canceledAt: new Date(),
        })
        .where(
            and(
                eq(marketListingTable.status, "active"),
                or(
                    sql`${marketListingTable.createdAt} <= ${cutoff}`,
                    inArray(marketListingTable.itemType, [...lockedSkins]),
                ),
            ),
        )
        .returning({
            sellerUserId: marketListingTable.sellerUserId,
            itemId: marketListingTable.itemId,
            itemType: marketListingTable.itemType,
            itemMaker: marketListingTable.itemMaker,
            itemKills: marketListingTable.itemKills,
            itemWins: marketListingTable.itemWins,
            itemHolders: marketListingTable.itemHolders,
        });

    if (expiredNow.length === 0) {
        return [];
    }

    await tx
        .insert(itemsTable)
        .values(
            expiredNow.map(
                (listing: {
                    sellerUserId: string;
                    itemId: string;
                    itemType: string;
                    itemMaker: string;
                    itemKills: number;
                    itemWins: number;
                    itemHolders: number;
                }) => ({
                    id: listing.itemId,
                    userId: listing.sellerUserId,
                    type: listing.itemType,
                    maker: listing.itemMaker,
                    kills: listing.itemKills,
                    wins: listing.itemWins,
                    holders: listing.itemHolders,
                    source: "Item expired",
                    timeAcquired: Date.now(),
                }),
            ),
        )
        .onConflictDoNothing();

    if (!targetUserId) {
        return [];
    }

    return expiredNow
        .filter(
            (listing: { sellerUserId: string; itemType: string }) =>
                listing.sellerUserId === targetUserId,
        )
        .map((listing: { sellerUserId: string; itemType: string }) => listing.itemType);
}

export async function expireAuctionListings(tx: any) {
    const cutoff = new Date(Date.now() - marketListingDurationMs);
    const expiredAuctions = await tx
        .select()
        .from(auctionListingTable)
        .where(
            and(
                eq(auctionListingTable.status, "active"),
                or(
                    sql`${auctionListingTable.createdAt} <= ${cutoff}`,
                    inArray(auctionListingTable.itemType, [...lockedSkins]),
                ),
            ),
        )
        .for("update");

    for (const auction of expiredAuctions) {
        const locked = isSkinLocked(auction.itemType);
        const sold = !locked && !!auction.highestBidUserId && auction.highestBid > 0;
        await tx
            .update(auctionListingTable)
            .set({
                status: locked ? "cancelled" : sold ? "sold" : "expired",
                soldAt: sold ? new Date() : auction.soldAt,
                canceledAt: !sold ? new Date() : auction.canceledAt,
            })
            .where(eq(auctionListingTable.id, auction.id));

        if (sold) {
            await tx.insert(itemsTable).values({
                id: auction.itemId,
                userId: auction.highestBidUserId,
                type: auction.itemType,
                maker: auction.itemMaker,
                kills: auction.itemKills,
                wins: auction.itemWins,
                holders: auction.itemHolders,
                source: "auction_win",
                timeAcquired: Date.now(),
            });

            await tx
                .update(usersTable)
                .set({
                    gpBalance: sql`${usersTable.gpBalance} + ${auction.highestBid}`,
                })
                .where(eq(usersTable.id, auction.sellerUserId));
        } else {
            if (locked && auction.highestBidUserId && auction.highestBid > 0) {
                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${auction.highestBid}`,
                    })
                    .where(eq(usersTable.id, auction.highestBidUserId));
            }
            await tx.insert(itemsTable).values({
                id: auction.itemId,
                userId: auction.sellerUserId,
                type: auction.itemType,
                maker: auction.itemMaker,
                kills: auction.itemKills,
                wins: auction.itemWins,
                holders: auction.itemHolders,
                source: locked ? "auction_cancel" : "auction_expired",
                timeAcquired: Date.now(),
            });
        }
    }
}
