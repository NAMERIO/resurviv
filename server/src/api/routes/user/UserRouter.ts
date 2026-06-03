import { createHash } from "node:crypto";
import { and, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
    type AckSoldMarketListingsResponse,
    type AddFriendResponse,
    type AuctionBidActivity,
    type BuyFeaturedBundleResponse,
    type BuyMarketListingResponse,
    type CancelAuctionListingResponse,
    type CancelMarketListingResponse,
    type ClaimLootBoxAdResponse,
    type ClaimRewardedAdGpResponse,
    type ClaimSocialGpRewardResponse,
    type CreateAuctionListingResponse,
    type CreateMarketListingResponse,
    type FriendRequestActionResponse,
    type FriendSearchResponse,
    type FriendsListResponse,
    type FriendUser,
    type GetMarketResponse,
    type GpGift,
    type LoadoutResponse,
    type OpenLootBoxResponse,
    type PlaceAuctionBidResponse,
    type ProfileResponse,
    type RemoveFriendResponse,
    type SendFriendGpResponse,
    type SendFriendSkinGiftResponse,
    type SkinGift,
    type UsernameResponse,
    zAckSoldMarketListingsRequest,
    zAddFriendRequest,
    zBuyFeaturedBundleRequest,
    zBuyMarketListingRequest,
    zCancelAuctionListingRequest,
    zCancelMarketListingRequest,
    zClaimLootBoxAdRequest,
    zClaimRewardedAdGpRequest,
    zClaimSocialGpRewardRequest,
    zCreateAuctionListingRequest,
    zCreateMarketListingRequest,
    zFriendRequestActionRequest,
    zFriendSearchRequest,
    zFriendUserRequest,
    zLoadoutRequest,
    zOpenLootBoxRequest,
    zPlaceAuctionBidRequest,
    zSendFriendGpRequest,
    zSendFriendSkinGiftRequest,
    zSetItemStatusRequest,
    zUnlinkAuthRequest,
    zUsernameRequest,
} from "../../../../../shared/types/user";
import {
    getFeaturedBundleOffers,
    getFeaturedBundleSource,
} from "../../../../../shared/utils/featuredBundles";
import loadout, { ItemStatus } from "../../../../../shared/utils/loadout";
import {
    getLootBox,
    getLootBoxItems,
    lootBoxes,
    pickLootBoxReward,
} from "../../../../../shared/utils/lootBoxes";
import {
    getAuctionPriceBounds,
    getMarketPriceBounds,
} from "../../../../../shared/utils/marketPricing";
import { Config } from "../../../config";
import { getHonoIp, validateUserName } from "../../../utils/serverHelpers";
import {
    logGpGiftToDiscord,
    logItemGiftToDiscord,
    logMarketPurchaseToDiscord,
} from "../../../utils/shopLogging";
import { server } from "../../apiServer";
import {
    authMiddleware,
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import {
    auctionBidTable,
    auctionListingTable,
    gpGiftTable,
    itemsTable,
    marketListingTable,
    matchDataTable,
    rewardClaimsTable,
    skinGiftTable,
    userAuthIdentityTable,
    userFriendsTable,
    usersTable,
} from "../../db/schema";
import type { Context } from "../../index";
import {
    ensureUserAuthIdentities,
    getTimeUntilNextUsernameChange,
    logoutUser,
    sanitizeSlug,
} from "./auth/authUtils";
import { PassRouter } from "./PassRouter";

export const UserRouter = new Hono<Context>();

const MARKET_LISTING_EXPIRY_MS = 24 * 60 * 60 * 1000;
const AUCTION_LISTING_EXPIRY_MS = 24 * 60 * 60 * 1000;
const APRIL_THANKS_REWARD_KEY = "thanks_gift_april_2026";
const APRIL_THANKS_REWARD_GP = 500;
const APRIL_THANKS_REWARD_IP_LIMIT = 2;
const APRIL_THANKS_REWARD_MIN_PLAYTIME_SECONDS = 30;
const APRIL_THANKS_REWARD_END_AT = new Date("2026-04-26T00:00:00.000Z").getTime();
const SOCIAL_GP_REWARD_AMOUNT = 75;
const SOCIAL_GP_REWARDS = {
    github_star: { rewardKey: "social_github_star", gp: SOCIAL_GP_REWARD_AMOUNT },
    discord_join: { rewardKey: "social_discord_join", gp: SOCIAL_GP_REWARD_AMOUNT },
} as const;
const REWARDED_AD_GP_AMOUNT = 50;
const REWARDED_AD_GP_DAILY_LIMIT = 3;
const REWARDED_AD_GP_REWARD_KEY_PREFIX = "rewarded_ad_gp";
const LOOT_BOX_AD_REWARD_KEY_PREFIX = "loot_box_ad";
const LOOT_BOX_AD_OPEN_REWARD_KEY_PREFIX = "loot_box_ad_open";
const LOOT_BOX_AD_REQUIREMENTS: Record<string, number> = {
    loot_box_04: 5,
};

function getItemMakerName(
    user: Pick<typeof usersTable.$inferSelect, "username" | "slug">,
) {
    return user.username || user.slug || "Unknown";
}

function getShopLootBoxes() {
    return Object.values(lootBoxes).map((box) => ({
        id: box.id,
        name: box.name,
        price: box.price,
        chances: box.chances,
        itemTypes: getLootBoxItems(box.id),
        adRequirement: LOOT_BOX_AD_REQUIREMENTS[box.id],
    }));
}

function hashRewardIp(ip: string) {
    return createHash("sha256")
        .update(Config.secrets.SURVEV_IP_SECRET + ip)
        .digest("hex");
}

function tryClaimAprilThanksReward(c: any, userId: string) {
    if (Date.now() >= APRIL_THANKS_REWARD_END_AT) {
        return null;
    }

    const ip = getHonoIp(c, Config.apiServer.proxyIPHeader);
    if (!ip) {
        return null;
    }

    const encodedIp = hashRewardIp(ip);

    return db.transaction(async (tx) => {
        const existingClaim = await tx.query.rewardClaimsTable.findFirst({
            where: and(
                eq(rewardClaimsTable.rewardKey, APRIL_THANKS_REWARD_KEY),
                eq(rewardClaimsTable.userId, userId),
            ),
            columns: {
                id: true,
            },
        });

        if (existingClaim) {
            return null;
        }

        const playtimeRows = await tx
            .select({
                totalTimeAlive: sql<number>`COALESCE(SUM(${matchDataTable.timeAlive}), 0)::int`,
            })
            .from(matchDataTable)
            .where(eq(matchDataTable.userId, userId));

        const totalTimeAlive = playtimeRows[0]?.totalTimeAlive ?? 0;
        if (totalTimeAlive < APRIL_THANKS_REWARD_MIN_PLAYTIME_SECONDS) {
            return null;
        }

        const ipClaimRows = await tx
            .select({
                count: sql<number>`COUNT(*)::int`,
            })
            .from(rewardClaimsTable)
            .where(
                and(
                    eq(rewardClaimsTable.rewardKey, APRIL_THANKS_REWARD_KEY),
                    eq(rewardClaimsTable.encodedIp, encodedIp),
                ),
            );

        const ipClaimCount = ipClaimRows[0]?.count ?? 0;
        if (ipClaimCount >= APRIL_THANKS_REWARD_IP_LIMIT) {
            return null;
        }

        await tx.insert(rewardClaimsTable).values({
            rewardKey: APRIL_THANKS_REWARD_KEY,
            userId,
            encodedIp,
            grantedGp: APRIL_THANKS_REWARD_GP,
        });

        const [updatedUser] = await tx
            .update(usersTable)
            .set({
                gpBalance: sql`${usersTable.gpBalance} + ${APRIL_THANKS_REWARD_GP}`,
            })
            .where(eq(usersTable.id, userId))
            .returning({
                gpBalance: usersTable.gpBalance,
            });

        return updatedUser
            ? {
                  amount: APRIL_THANKS_REWARD_GP,
                  gpBalance: updatedUser.gpBalance,
              }
            : null;
    });
}

async function getSocialGpRewardClaims(userId: string) {
    const claimedRows = await db
        .select({
            rewardKey: rewardClaimsTable.rewardKey,
        })
        .from(rewardClaimsTable)
        .where(
            and(
                eq(rewardClaimsTable.userId, userId),
                inArray(
                    rewardClaimsTable.rewardKey,
                    Object.values(SOCIAL_GP_REWARDS).map((reward) => reward.rewardKey),
                ),
            ),
        );

    const claimedRewardKeys = new Set(claimedRows.map((row) => row.rewardKey));
    return {
        github_star: claimedRewardKeys.has(SOCIAL_GP_REWARDS.github_star.rewardKey),
        discord_join: claimedRewardKeys.has(SOCIAL_GP_REWARDS.discord_join.rewardKey),
    };
}

function getRewardedAdGpDay(now = Date.now()) {
    return new Date(now).toISOString().slice(0, 10);
}

function getRewardedAdGpResetAt(now = Date.now()) {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

function getRewardedAdGpRewardKeys(day = getRewardedAdGpDay()) {
    return Array.from(
        { length: REWARDED_AD_GP_DAILY_LIMIT },
        (_value, index) => `${REWARDED_AD_GP_REWARD_KEY_PREFIX}:${day}:${index}`,
    );
}

function getLootBoxAdRequirement(boxId: string) {
    return LOOT_BOX_AD_REQUIREMENTS[boxId] ?? 0;
}

function getLootBoxAdRewardKeys(boxId: string, day = getRewardedAdGpDay()) {
    const requirement = getLootBoxAdRequirement(boxId);
    return Array.from(
        { length: requirement },
        (_value, index) => `${LOOT_BOX_AD_REWARD_KEY_PREFIX}:${day}:${boxId}:${index}`,
    );
}

function getLootBoxAdOpenRewardKey(boxId: string, day = getRewardedAdGpDay()) {
    return `${LOOT_BOX_AD_OPEN_REWARD_KEY_PREFIX}:${day}:${boxId}`;
}

async function getLootBoxAdStates(userId: string) {
    const trackedBoxIds = Object.keys(LOOT_BOX_AD_REQUIREMENTS);
    const rewardKeys = trackedBoxIds.flatMap((boxId) => [
        ...getLootBoxAdRewardKeys(boxId),
        getLootBoxAdOpenRewardKey(boxId),
    ]);
    const rows =
        rewardKeys.length > 0
            ? await db
                  .select({
                      rewardKey: rewardClaimsTable.rewardKey,
                  })
                  .from(rewardClaimsTable)
                  .where(
                      and(
                          eq(rewardClaimsTable.userId, userId),
                          inArray(rewardClaimsTable.rewardKey, rewardKeys),
                      ),
                  )
            : [];
    const claimedKeys = new Set(rows.map((row) => row.rewardKey));

    return Object.fromEntries(
        trackedBoxIds.map((boxId) => {
            const adKeys = getLootBoxAdRewardKeys(boxId);
            const watched = adKeys.filter((key) => claimedKeys.has(key)).length;
            const required = getLootBoxAdRequirement(boxId);
            return [
                boxId,
                {
                    required,
                    watched,
                    remaining: Math.max(0, required - watched),
                    opened: claimedKeys.has(getLootBoxAdOpenRewardKey(boxId)),
                    resetAt: getRewardedAdGpResetAt(),
                },
            ];
        }),
    );
}

async function getRewardedAdGpState(userId: string) {
    const rewardKeys = getRewardedAdGpRewardKeys();
    const rows = await db
        .select({
            rewardKey: rewardClaimsTable.rewardKey,
        })
        .from(rewardClaimsTable)
        .where(
            and(
                eq(rewardClaimsTable.userId, userId),
                inArray(rewardClaimsTable.rewardKey, rewardKeys),
            ),
        );
    const claimed = rows.length;

    return {
        amount: REWARDED_AD_GP_AMOUNT,
        limit: REWARDED_AD_GP_DAILY_LIMIT,
        claimed,
        remaining: Math.max(0, REWARDED_AD_GP_DAILY_LIMIT - claimed),
        resetAt: getRewardedAdGpResetAt(),
    };
}

function canUseDeveloper(slug: string) {
    return Config.debug.developerSlugs.includes(slug);
}

function isSupportedMarketItem(itemType: string) {
    return getMarketPriceBounds(itemType) !== null;
}

function toClientFriendUser(
    user: Pick<typeof usersTable.$inferSelect, "id" | "slug" | "username" | "loadout">,
    relationStatus: FriendUser["relationStatus"],
): FriendUser {
    return {
        userId: user.id,
        slug: user.slug,
        username: user.username || user.slug,
        playerIcon: user.loadout?.player_icon || "emote_surviv",
        relationStatus,
    };
}

async function getFriendRelations(userId: string) {
    const rows = await db
        .select({
            requesterUserId: userFriendsTable.requesterUserId,
            addresseeUserId: userFriendsTable.addresseeUserId,
            status: userFriendsTable.status,
        })
        .from(userFriendsTable)
        .where(
            or(
                eq(userFriendsTable.requesterUserId, userId),
                eq(userFriendsTable.addresseeUserId, userId),
            ),
        );

    const relationByUserId = new Map<string, FriendUser["relationStatus"]>();
    const friendIds: string[] = [];
    const incomingIds: string[] = [];
    const outgoingIds: string[] = [];

    for (const row of rows) {
        const otherUserId =
            row.requesterUserId === userId ? row.addresseeUserId : row.requesterUserId;

        if (row.status === "accepted") {
            relationByUserId.set(otherUserId, "friends");
            friendIds.push(otherUserId);
        } else if (row.requesterUserId === userId) {
            relationByUserId.set(otherUserId, "outgoing");
            outgoingIds.push(otherUserId);
        } else {
            relationByUserId.set(otherUserId, "incoming");
            incomingIds.push(otherUserId);
        }
    }

    return {
        relationByUserId,
        friendIds,
        incomingIds,
        outgoingIds,
    };
}

async function getUsersByIds(userIds: string[]) {
    if (userIds.length === 0) {
        return [];
    }

    return await db
        .select({
            id: usersTable.id,
            slug: usersTable.slug,
            username: usersTable.username,
            loadout: usersTable.loadout,
        })
        .from(usersTable)
        .where(and(inArray(usersTable.id, userIds), eq(usersTable.banned, false)))
        .orderBy(usersTable.slug);
}

async function areFriends(userId: string, friendUserId: string) {
    const existing = await db
        .select({
            id: userFriendsTable.id,
        })
        .from(userFriendsTable)
        .where(
            and(
                eq(userFriendsTable.status, "accepted"),
                or(
                    and(
                        eq(userFriendsTable.requesterUserId, userId),
                        eq(userFriendsTable.addresseeUserId, friendUserId),
                    ),
                    and(
                        eq(userFriendsTable.requesterUserId, friendUserId),
                        eq(userFriendsTable.addresseeUserId, userId),
                    ),
                ),
            ),
        )
        .limit(1);

    return !!existing[0];
}

async function claimGpGifts(userId: string) {
    const gifts = await db
        .select({
            id: gpGiftTable.id,
            amount: gpGiftTable.amount,
            senderSlug: usersTable.slug,
            senderUsername: usersTable.username,
        })
        .from(gpGiftTable)
        .innerJoin(usersTable, eq(usersTable.id, gpGiftTable.senderUserId))
        .where(
            and(
                eq(gpGiftTable.recipientUserId, userId),
                sql`${gpGiftTable.seenAt} IS NULL`,
            ),
        )
        .orderBy(gpGiftTable.createdAt)
        .limit(10);

    if (gifts.length > 0) {
        await db
            .update(gpGiftTable)
            .set({ seenAt: new Date() })
            .where(
                inArray(
                    gpGiftTable.id,
                    gifts.map((gift) => gift.id),
                ),
            );
    }

    return gifts satisfies GpGift[];
}

async function claimSkinGifts(userId: string) {
    const gifts = await db
        .select({
            id: skinGiftTable.id,
            itemTypes: skinGiftTable.itemTypes,
            senderSlug: usersTable.slug,
            senderUsername: usersTable.username,
        })
        .from(skinGiftTable)
        .innerJoin(usersTable, eq(usersTable.id, skinGiftTable.senderUserId))
        .where(
            and(
                eq(skinGiftTable.recipientUserId, userId),
                sql`${skinGiftTable.seenAt} IS NULL`,
            ),
        )
        .orderBy(skinGiftTable.createdAt)
        .limit(10);

    if (gifts.length > 0) {
        await db
            .update(skinGiftTable)
            .set({ seenAt: new Date() })
            .where(
                inArray(
                    skinGiftTable.id,
                    gifts.map((gift) => gift.id),
                ),
            );
    }

    return gifts satisfies SkinGift[];
}

async function getUserItems(userId: string) {
    await db
        .update(itemsTable)
        .set({
            maker: sql`COALESCE(
                (SELECT ${usersTable.username} FROM ${usersTable} WHERE ${usersTable.id} = ${userId}),
                'Unknown'
            )`,
        })
        .where(and(eq(itemsTable.userId, userId), eq(itemsTable.maker, "Unknown")));

    return db
        .select({
            id: itemsTable.id,
            type: itemsTable.type,
            timeAcquired: itemsTable.timeAcquired,
            source: itemsTable.source,
            maker: itemsTable.maker,
            kills: itemsTable.kills,
            wins: itemsTable.wins,
            status: itemsTable.status,
        })
        .from(itemsTable)
        .where(eq(itemsTable.userId, userId));
}

async function expireMarketListings(tx: any, targetUserId?: string) {
    const cutoff = new Date(Date.now() - MARKET_LISTING_EXPIRY_MS);
    const expiredNow = await tx
        .update(marketListingTable)
        .set({
            status: "expired",
            canceledAt: new Date(),
        })
        .where(
            and(
                eq(marketListingTable.status, "active"),
                sql`${marketListingTable.createdAt} <= ${cutoff}`,
            ),
        )
        .returning({
            sellerUserId: marketListingTable.sellerUserId,
            itemId: marketListingTable.itemId,
            itemType: marketListingTable.itemType,
            itemMaker: marketListingTable.itemMaker,
            itemKills: marketListingTable.itemKills,
            itemWins: marketListingTable.itemWins,
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
                }) => ({
                    id: listing.itemId,
                    userId: listing.sellerUserId,
                    type: listing.itemType,
                    maker: listing.itemMaker,
                    kills: listing.itemKills,
                    wins: listing.itemWins,
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

async function expireAuctionListings(tx: any) {
    const cutoff = new Date(Date.now() - AUCTION_LISTING_EXPIRY_MS);
    const expiredAuctions = await tx.query.auctionListingTable.findMany({
        where: and(
            eq(auctionListingTable.status, "active"),
            sql`${auctionListingTable.createdAt} <= ${cutoff}`,
        ),
    });

    for (const auction of expiredAuctions) {
        await tx
            .update(auctionListingTable)
            .set({
                status: auction.highestBidUserId ? "sold" : "expired",
                soldAt: auction.highestBidUserId ? new Date() : auction.soldAt,
                canceledAt: !auction.highestBidUserId ? new Date() : auction.canceledAt,
            })
            .where(eq(auctionListingTable.id, auction.id));

        if (auction.highestBidUserId && auction.highestBid > 0) {
            await tx.insert(itemsTable).values({
                id: auction.itemId,
                userId: auction.highestBidUserId,
                type: auction.itemType,
                maker: auction.itemMaker,
                kills: auction.itemKills,
                wins: auction.itemWins,
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
            await tx.insert(itemsTable).values({
                id: auction.itemId,
                userId: auction.sellerUserId,
                type: auction.itemType,
                maker: auction.itemMaker,
                kills: auction.itemKills,
                wins: auction.itemWins,
                source: "auction_expired",
                timeAcquired: Date.now(),
            });
        }
    }
}

async function buildMarketState(userId: string) {
    const expiredItemTypes = await expireMarketListings(db, userId);
    await expireAuctionListings(db);
    const [
        { offers },
        publicListings,
        userListings,
        publicAuctions,
        userAuctions,
        auctionBids,
        soldListings,
        sellers,
        purchasedBundles,
    ] = await Promise.all([
        Promise.resolve(getFeaturedBundleOffers()),
        db.query.marketListingTable.findMany({
            where: eq(marketListingTable.status, "active"),
            orderBy: (table, { asc }) => [asc(table.price), asc(table.createdAt)],
        }),
        db.query.marketListingTable.findMany({
            where: and(
                eq(marketListingTable.sellerUserId, userId),
                eq(marketListingTable.status, "active"),
            ),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        }),
        db.query.auctionListingTable.findMany({
            where: eq(auctionListingTable.status, "active"),
            orderBy: (table, { desc }) => [desc(table.highestBid), desc(table.createdAt)],
        }),
        db.query.auctionListingTable.findMany({
            where: and(
                eq(auctionListingTable.sellerUserId, userId),
                eq(auctionListingTable.status, "active"),
            ),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        }),
        db.query.auctionBidTable.findMany({
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        }),
        db.query.marketListingTable.findMany({
            where: and(
                eq(marketListingTable.sellerUserId, userId),
                eq(marketListingTable.status, "sold"),
                sql`${marketListingTable.sellerNotifiedAt} IS NULL`,
            ),
            orderBy: (table, { asc }) => [asc(table.soldAt)],
        }),
        db.query.usersTable.findMany({
            columns: {
                id: true,
                slug: true,
            },
        }),
        db
            .select({
                source: itemsTable.source,
            })
            .from(itemsTable)
            .where(eq(itemsTable.userId, userId)),
    ]);

    const slugByUserId = new Map(sellers.map((seller) => [seller.id, seller.slug]));
    const purchasedBundleSources = new Set(
        purchasedBundles
            .map((item) => item.source)
            .filter((source) => source.startsWith("featured_bundle:")),
    );
    const toClientListing = (listing: (typeof publicListings)[number]) => ({
        id: listing.id,
        itemId: listing.itemId,
        itemType: listing.itemType,
        maker: listing.itemMaker,
        kills: listing.itemKills,
        wins: listing.itemWins,
        price: listing.price,
        sellerSlug: slugByUserId.get(listing.sellerUserId) || "unknown",
        createdAt: new Date(listing.createdAt).getTime(),
    });
    const buildAuctionActivities = (auctionId: string): AuctionBidActivity[] =>
        auctionBids
            .filter((bid) => bid.auctionId === auctionId)
            .slice(0, 12)
            .map((bid) => ({
                bidderSlug: slugByUserId.get(bid.bidderUserId) || "unknown",
                amount: bid.amount,
                createdAt: new Date(bid.createdAt).getTime(),
            }));
    const toClientAuction = (auction: (typeof publicAuctions)[number]) => ({
        id: auction.id,
        itemId: auction.itemId,
        itemType: auction.itemType,
        maker: auction.itemMaker,
        kills: auction.itemKills,
        wins: auction.itemWins,
        sellerSlug: slugByUserId.get(auction.sellerUserId) || "unknown",
        startPrice: auction.startPrice,
        highestBid: auction.highestBid,
        bidCount: auctionBids.filter((bid) => bid.auctionId === auction.id).length,
        highestBidderSlug: auction.highestBidUserId
            ? (slugByUserId.get(auction.highestBidUserId) ?? "unknown")
            : undefined,
        createdAt: new Date(auction.createdAt).getTime(),
        activities: buildAuctionActivities(auction.id),
    });

    return {
        listings: publicListings.map(toClientListing),
        userListings: userListings.map(toClientListing),
        auctions: publicAuctions.map(toClientAuction),
        userAuctions: userAuctions.map(toClientAuction),
        soldListings: soldListings.map((listing) => ({
            id: listing.id,
            itemId: listing.itemId,
            itemType: listing.itemType,
            price: listing.price,
            soldAt: listing.soldAt ? new Date(listing.soldAt).getTime() : Date.now(),
        })),
        expiredItemTypes,
        featuredBundles: offers.map((offer) => ({
            ...offer,
            purchased: purchasedBundleSources.has(getFeaturedBundleSource(offer.id)),
        })),
    };
}

UserRouter.use(databaseEnabledMiddleware);
UserRouter.use(rateLimitMiddleware(40, 60 * 1000));
UserRouter.use(authMiddleware);
UserRouter.route("/", PassRouter);

UserRouter.post("/profile", async (c) => {
    const user = c.get("user")!;

    const {
        loadout,
        slug,
        username,
        usernameSet,
        lastUsernameChangeTime,
        banned,
        banReason,
    } = user;

    if (banned) {
        const session = c.get("session")!;
        await logoutUser(c, session.id);

        return c.json<ProfileResponse>({
            banned: true,
            reason: banReason,
        });
    }

    const timeUntilNextChange = getTimeUntilNextUsernameChange(lastUsernameChangeTime);
    const authState = await ensureUserAuthIdentities(user);
    const claimedThanksReward = await tryClaimAprilThanksReward(c, user.id);
    const gpGifts = await claimGpGifts(user.id);
    const skinGifts = await claimSkinGifts(user.id);

    const items = await getUserItems(user.id);

    return c.json<ProfileResponse>(
        {
            success: true,
            profile: {
                slug,
                linked: authState.linked,
                linkedDiscord: authState.linkedDiscord,
                linkedGoogle: authState.linkedGoogle,
                username,
                usernameSet,
                usernameChangeTime: timeUntilNextChange,
                canUseDeveloper: canUseDeveloper(slug),
            },
            gpBalance: claimedThanksReward?.gpBalance ?? user.gpBalance,
            rewardedAdGp: await getRewardedAdGpState(user.id),
            thankYouGift: claimedThanksReward
                ? {
                      amount: claimedThanksReward.amount,
                  }
                : undefined,
            gpGifts,
            skinGifts,
            loadout,
            items: items,
        },
        200,
    );
});

UserRouter.post("/friends", async (c) => {
    const user = c.get("user")!;
    const relations = await getFriendRelations(user.id);
    const [friends, incomingRequests, outgoingRequests] = await Promise.all([
        getUsersByIds(relations.friendIds),
        getUsersByIds(relations.incomingIds),
        getUsersByIds(relations.outgoingIds),
    ]);

    return c.json<FriendsListResponse>(
        {
            success: true,
            friends: friends.map((friend) => toClientFriendUser(friend, "friends")),
            incomingRequests: incomingRequests.map((request) =>
                toClientFriendUser(request, "incoming"),
            ),
            outgoingRequests: outgoingRequests.map((request) =>
                toClientFriendUser(request, "outgoing"),
            ),
        },
        200,
    );
});

UserRouter.post("/friends/search", validateParams(zFriendSearchRequest), async (c) => {
    const user = c.get("user")!;
    const { query } = c.req.valid("json");
    const search = `${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const relations = await getFriendRelations(user.id);

    const users = await db
        .select({
            id: usersTable.id,
            slug: usersTable.slug,
            username: usersTable.username,
            loadout: usersTable.loadout,
        })
        .from(usersTable)
        .where(
            and(
                ne(usersTable.id, user.id),
                eq(usersTable.banned, false),
                eq(usersTable.usernameSet, true),
                or(ilike(usersTable.slug, search), ilike(usersTable.username, search)),
            ),
        )
        .orderBy(usersTable.slug)
        .limit(12);

    return c.json<FriendSearchResponse>(
        {
            success: true,
            results: users.map((result) =>
                toClientFriendUser(
                    result,
                    relations.relationByUserId.get(result.id) || "none",
                ),
            ),
        },
        200,
    );
});

UserRouter.post("/friends/add", validateParams(zAddFriendRequest), async (c) => {
    const user = c.get("user")!;
    const { userId } = c.req.valid("json");

    if (userId === user.id) {
        return c.json<AddFriendResponse>({ success: false, error: "self" }, 200);
    }

    const friend = await db.query.usersTable.findFirst({
        where: and(eq(usersTable.id, userId), eq(usersTable.banned, false)),
        columns: {
            id: true,
            slug: true,
            username: true,
            loadout: true,
        },
    });

    if (!friend) {
        return c.json<AddFriendResponse>({ success: false, error: "not_found" }, 200);
    }

    const existing = await db
        .select({
            status: userFriendsTable.status,
        })
        .from(userFriendsTable)
        .where(
            or(
                and(
                    eq(userFriendsTable.requesterUserId, user.id),
                    eq(userFriendsTable.addresseeUserId, userId),
                ),
                and(
                    eq(userFriendsTable.requesterUserId, userId),
                    eq(userFriendsTable.addresseeUserId, user.id),
                ),
            ),
        )
        .limit(1);

    if (existing[0]?.status === "accepted") {
        return c.json<AddFriendResponse>(
            { success: false, error: "already_friends" },
            200,
        );
    }

    if (existing[0]) {
        return c.json<AddFriendResponse>(
            { success: false, error: "already_requested" },
            200,
        );
    }

    try {
        await db.insert(userFriendsTable).values({
            requesterUserId: user.id,
            addresseeUserId: userId,
            status: "pending",
        });
    } catch (err) {
        server.logger.error("/api/user/friends/add error", err);
        return c.json<AddFriendResponse>({ success: false, error: "server_error" }, 500);
    }

    server.notifyUsersSocialEvent([user.id, userId], { type: "friends_changed" });

    return c.json<AddFriendResponse>(
        {
            success: true,
            request: toClientFriendUser(friend, "outgoing"),
        },
        200,
    );
});

UserRouter.post(
    "/friends/accept",
    validateParams(zFriendRequestActionRequest),
    async (c) => {
        const user = c.get("user")!;
        const { userId } = c.req.valid("json");

        const [updated] = await db
            .update(userFriendsTable)
            .set({
                status: "accepted",
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(userFriendsTable.requesterUserId, userId),
                    eq(userFriendsTable.addresseeUserId, user.id),
                    eq(userFriendsTable.status, "pending"),
                ),
            )
            .returning({
                requesterUserId: userFriendsTable.requesterUserId,
            });

        if (!updated) {
            return c.json<FriendRequestActionResponse>(
                { success: false, error: "not_found" },
                200,
            );
        }

        const friend = await db.query.usersTable.findFirst({
            where: and(eq(usersTable.id, userId), eq(usersTable.banned, false)),
            columns: {
                id: true,
                slug: true,
                username: true,
                loadout: true,
            },
        });

        if (!friend) {
            return c.json<FriendRequestActionResponse>(
                { success: false, error: "not_found" },
                200,
            );
        }

        server.notifyUsersSocialEvent([user.id, updated.requesterUserId], {
            type: "friends_changed",
        });

        return c.json<FriendRequestActionResponse>(
            {
                success: true,
                friend: toClientFriendUser(friend, "friends"),
            },
            200,
        );
    },
);

UserRouter.post(
    "/friends/decline",
    validateParams(zFriendRequestActionRequest),
    async (c) => {
        const user = c.get("user")!;
        const { userId } = c.req.valid("json");

        await db
            .delete(userFriendsTable)
            .where(
                and(
                    eq(userFriendsTable.requesterUserId, userId),
                    eq(userFriendsTable.addresseeUserId, user.id),
                    eq(userFriendsTable.status, "pending"),
                ),
            );

        server.notifyUsersSocialEvent([user.id, userId], { type: "friends_changed" });

        return c.json<FriendRequestActionResponse>({ success: true }, 200);
    },
);

UserRouter.post(
    "/friends/cancel",
    validateParams(zFriendRequestActionRequest),
    async (c) => {
        const user = c.get("user")!;
        const { userId } = c.req.valid("json");

        await db
            .delete(userFriendsTable)
            .where(
                and(
                    eq(userFriendsTable.requesterUserId, user.id),
                    eq(userFriendsTable.addresseeUserId, userId),
                    eq(userFriendsTable.status, "pending"),
                ),
            );

        server.notifyUsersSocialEvent([user.id, userId], { type: "friends_changed" });

        return c.json<FriendRequestActionResponse>({ success: true }, 200);
    },
);

UserRouter.post("/friends/remove", validateParams(zFriendUserRequest), async (c) => {
    const user = c.get("user")!;
    const { userId } = c.req.valid("json");

    const deleted = await db
        .delete(userFriendsTable)
        .where(
            and(
                eq(userFriendsTable.status, "accepted"),
                or(
                    and(
                        eq(userFriendsTable.requesterUserId, user.id),
                        eq(userFriendsTable.addresseeUserId, userId),
                    ),
                    and(
                        eq(userFriendsTable.requesterUserId, userId),
                        eq(userFriendsTable.addresseeUserId, user.id),
                    ),
                ),
            ),
        )
        .returning({
            id: userFriendsTable.id,
        });

    if (deleted.length === 0) {
        return c.json<RemoveFriendResponse>({ success: false, error: "not_found" }, 200);
    }

    server.notifyUsersSocialEvent([user.id, userId], { type: "friends_changed" });

    return c.json<RemoveFriendResponse>({ success: true }, 200);
});

UserRouter.post("/friends/send_gp", validateParams(zSendFriendGpRequest), async (c) => {
    const user = c.get("user")!;
    const { userId, amount } = c.req.valid("json");

    if (!(await areFriends(user.id, userId))) {
        return c.json<SendFriendGpResponse>(
            { success: false, error: "not_friend", gpBalance: user.gpBalance },
            200,
        );
    }

    const recipient = await db.query.usersTable.findFirst({
        where: and(eq(usersTable.id, userId), eq(usersTable.banned, false)),
        columns: {
            id: true,
            slug: true,
        },
    });

    if (!recipient) {
        return c.json<SendFriendGpResponse>(
            { success: false, error: "not_found", gpBalance: user.gpBalance },
            200,
        );
    }

    try {
        const result = await db.transaction(async (tx) => {
            const [updatedSender] = await tx
                .update(usersTable)
                .set({
                    gpBalance: sql`${usersTable.gpBalance} - ${amount}`,
                })
                .where(and(eq(usersTable.id, user.id), gte(usersTable.gpBalance, amount)))
                .returning({
                    gpBalance: usersTable.gpBalance,
                });

            if (!updatedSender) {
                return { ok: false as const, error: "not_enough_gp" as const };
            }

            await tx
                .update(usersTable)
                .set({
                    gpBalance: sql`${usersTable.gpBalance} + ${amount}`,
                })
                .where(eq(usersTable.id, userId));

            await tx.insert(gpGiftTable).values({
                senderUserId: user.id,
                recipientUserId: userId,
                amount,
            });

            return { ok: true as const, gpBalance: updatedSender.gpBalance };
        });

        if (!result.ok) {
            return c.json<SendFriendGpResponse>(
                {
                    success: false,
                    error: result.error,
                    gpBalance: user.gpBalance,
                },
                200,
            );
        }

        void logGpGiftToDiscord({
            senderSlug: user.slug,
            recipientSlug: recipient.slug,
            amount,
        });

        return c.json<SendFriendGpResponse>(
            { success: true, gpBalance: result.gpBalance },
            200,
        );
    } catch (err) {
        server.logger.error("/api/user/friends/send_gp error", err);
        return c.json<SendFriendGpResponse>(
            { success: false, error: "server_error", gpBalance: user.gpBalance },
            500,
        );
    }
});

UserRouter.post(
    "/friends/send_skins",
    validateParams(zSendFriendSkinGiftRequest),
    async (c) => {
        const user = c.get("user")!;
        const { userId, itemIds } = c.req.valid("json");
        const uniqueItemIds = [...new Set(itemIds)];

        if (!(await areFriends(user.id, userId))) {
            return c.json<SendFriendSkinGiftResponse>(
                { success: false, error: "not_friend" },
                200,
            );
        }

        const recipient = await db.query.usersTable.findFirst({
            where: and(eq(usersTable.id, userId), eq(usersTable.banned, false)),
            columns: {
                id: true,
                slug: true,
            },
        });

        if (!recipient) {
            return c.json<SendFriendSkinGiftResponse>(
                { success: false, error: "not_found" },
                200,
            );
        }

        try {
            const result = await db.transaction(async (tx) => {
                const ownedItems = await tx
                    .select({
                        id: itemsTable.id,
                        type: itemsTable.type,
                    })
                    .from(itemsTable)
                    .where(
                        and(
                            eq(itemsTable.userId, user.id),
                            inArray(itemsTable.id, uniqueItemIds),
                        ),
                    );

                if (ownedItems.length !== uniqueItemIds.length) {
                    return { ok: false as const, error: "item_not_owned" as const };
                }

                if (ownedItems.some((item) => !isSupportedMarketItem(item.type))) {
                    return { ok: false as const, error: "invalid_item" as const };
                }

                const itemTypes = ownedItems.map((item) => item.type);

                await tx
                    .update(itemsTable)
                    .set({
                        userId,
                        source: `gift_from:${user.slug}`,
                        status: ItemStatus.New,
                        timeAcquired: Date.now(),
                    })
                    .where(
                        and(
                            eq(itemsTable.userId, user.id),
                            inArray(itemsTable.id, uniqueItemIds),
                        ),
                    );

                await tx.insert(skinGiftTable).values({
                    senderUserId: user.id,
                    recipientUserId: userId,
                    itemTypes,
                });

                const items = await tx
                    .select({
                        id: itemsTable.id,
                        type: itemsTable.type,
                        timeAcquired: itemsTable.timeAcquired,
                        source: itemsTable.source,
                        maker: itemsTable.maker,
                        kills: itemsTable.kills,
                        wins: itemsTable.wins,
                        status: itemsTable.status,
                    })
                    .from(itemsTable)
                    .where(eq(itemsTable.userId, user.id));
                const nextLoadout = loadout.validateWithAvailableItems(
                    user.loadout,
                    items,
                );

                await tx
                    .update(usersTable)
                    .set({ loadout: nextLoadout })
                    .where(eq(usersTable.id, user.id));

                return { ok: true as const, itemTypes, items, loadout: nextLoadout };
            });

            if (!result.ok) {
                return c.json<SendFriendSkinGiftResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }

            void logItemGiftToDiscord({
                senderSlug: user.slug,
                recipientSlug: recipient.slug,
                itemTypes: result.itemTypes,
            });

            return c.json<SendFriendSkinGiftResponse>(
                {
                    success: true,
                    items: result.items,
                    loadout: result.loadout,
                },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/friends/send_skins error", err);
            return c.json<SendFriendSkinGiftResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/username",
    validateParams(zUsernameRequest, { result: "invalid" } satisfies UsernameResponse),
    async (c) => {
        const user = c.get("user")!;
        const { username } = c.req.valid("json");
        const timeUntilNextChange = getTimeUntilNextUsernameChange(
            user.lastUsernameChangeTime,
        );

        if (timeUntilNextChange > 0) {
            return c.json<UsernameResponse>({ result: "change_time_not_expired" }, 200);
        }

        const { validName, originalWasInvalid } = validateUserName(username);

        if (originalWasInvalid) {
            return c.json<UsernameResponse>({ result: "invalid" }, 200);
        }

        const slug = sanitizeSlug(validName);

        const slugTaken = await db.query.usersTable.findFirst({
            where: and(eq(usersTable.slug, slug), ne(usersTable.id, user.id)),
            columns: {
                id: true,
            },
        });

        if (slugTaken) {
            return c.json<UsernameResponse>({ result: "taken" }, 200);
        }

        try {
            await db
                .update(usersTable)
                .set({
                    username: validName,
                    slug: slug,
                    usernameSet: true,
                    lastUsernameChangeTime: new Date(),
                })
                .where(eq(usersTable.id, user.id));
        } catch (err) {
            server.logger.error("/api/username: Error updating username", err);
            return c.json<UsernameResponse>({ result: "failed" }, 500);
        }

        return c.json<UsernameResponse>({ result: "success" }, 200);
    },
);

UserRouter.post("/loadout", validateParams(zLoadoutRequest), async (c) => {
    const user = c.get("user")!;
    const { loadout: userLoadout } = c.req.valid("json");

    const items = await db
        .select({
            id: itemsTable.id,
            type: itemsTable.type,
            timeAcquired: itemsTable.timeAcquired,
            source: itemsTable.source,
            status: itemsTable.status,
        })
        .from(itemsTable)
        .where(eq(itemsTable.userId, user.id));

    const validatedLoadout = loadout.validateWithAvailableItems(userLoadout, items);

    await db
        .update(usersTable)
        .set({ loadout: validatedLoadout })
        .where(eq(usersTable.id, user.id));

    return c.json<LoadoutResponse>(
        {
            loadout: validatedLoadout,
        },
        200,
    );
});

UserRouter.post("/logout", async (c) => {
    const session = c.get("session")!;

    await logoutUser(c, session.id);

    return c.json({}, 200);
});

UserRouter.post("/unlink_auth", validateParams(zUnlinkAuthRequest), async (c) => {
    const user = c.get("user")!;
    const { provider } = c.req.valid("json");
    const authState = await ensureUserAuthIdentities(user);

    if (!authState.identities.some((identity) => identity.provider === provider)) {
        return c.json({ success: false, error: "not_linked" } as const, 200);
    }

    if (authState.identities.length <= 1) {
        return c.json({ success: false, error: "last_login_method" } as const, 200);
    }

    await db.transaction(async (tx) => {
        await tx
            .delete(userAuthIdentityTable)
            .where(
                and(
                    eq(userAuthIdentityTable.userId, user.id),
                    eq(userAuthIdentityTable.provider, provider),
                ),
            );

        await tx
            .update(usersTable)
            .set(
                provider === "discord"
                    ? { linkedDiscord: false }
                    : { linkedGoogle: false },
            )
            .where(eq(usersTable.id, user.id));
    });

    return c.json({ success: true } as const, 200);
});

UserRouter.post("/delete", async (c) => {
    const user = c.get("user")!;
    const session = c.get("session")!;

    // logout out the user
    await logoutUser(c, session.id);

    // delete the account
    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    // remove reference to the user from match data
    await db
        .update(matchDataTable)
        .set({ userId: null })
        .where(eq(matchDataTable.userId, user.id));

    return c.json({}, 200);
});

UserRouter.post("/set_item_status", validateParams(zSetItemStatusRequest), async (c) => {
    const user = c.get("user")!;
    const { itemTypes, status } = c.req.valid("json");

    await db
        .update(itemsTable)
        .set({
            status: status,
        })
        .where(and(eq(itemsTable.userId, user.id), inArray(itemsTable.type, itemTypes)));

    return c.json({}, 200);
});

UserRouter.post("/get_market", async (c) => {
    const user = c.get("user")!;
    const market = await buildMarketState(user.id);
    const socialGpRewardClaims = await getSocialGpRewardClaims(user.id);

    return c.json<GetMarketResponse>(
        {
            success: true,
            gpBalance: user.gpBalance,
            listings: market.listings,
            userListings: market.userListings,
            auctions: market.auctions,
            userAuctions: market.userAuctions,
            soldListings: market.soldListings,
            expiredItemTypes: market.expiredItemTypes,
            featuredBundles: market.featuredBundles,
            lootBoxes: getShopLootBoxes(),
            lootBoxAdStates: await getLootBoxAdStates(user.id),
            socialGpRewardClaims,
        },
        200,
    );
});

UserRouter.post(
    "/claim_social_gp_reward",
    validateParams(zClaimSocialGpRewardRequest),
    async (c) => {
        const user = c.get("user")!;
        const { rewardKey } = c.req.valid("json");
        const reward = SOCIAL_GP_REWARDS[rewardKey];

        if (!reward) {
            return c.json<ClaimSocialGpRewardResponse>(
                { success: false, error: "reward_not_found" },
                200,
            );
        }

        const ip = getHonoIp(c, Config.apiServer.proxyIPHeader);
        const encodedIp = ip ? hashRewardIp(ip) : "";

        try {
            const result = await db.transaction(async (tx) => {
                const existingClaim = await tx.query.rewardClaimsTable.findFirst({
                    where: and(
                        eq(rewardClaimsTable.userId, user.id),
                        eq(rewardClaimsTable.rewardKey, reward.rewardKey),
                    ),
                    columns: {
                        id: true,
                    },
                });

                if (existingClaim) {
                    return { ok: false as const, error: "already_claimed" as const };
                }

                await tx.insert(rewardClaimsTable).values({
                    rewardKey: reward.rewardKey,
                    userId: user.id,
                    encodedIp,
                    grantedGp: reward.gp,
                });

                const [updatedUser] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${reward.gp}`,
                    })
                    .where(eq(usersTable.id, user.id))
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                return updatedUser
                    ? {
                          ok: true as const,
                          gpBalance: updatedUser.gpBalance,
                      }
                    : { ok: false as const, error: "server_error" as const };
            });

            if (!result.ok) {
                return c.json<ClaimSocialGpRewardResponse>(
                    {
                        success: false,
                        error: result.error,
                        gpBalance: user.gpBalance,
                        socialGpRewardClaims: await getSocialGpRewardClaims(user.id),
                    },
                    200,
                );
            }

            return c.json<ClaimSocialGpRewardResponse>(
                {
                    success: true,
                    gpBalance: result.gpBalance,
                    socialGpRewardClaims: await getSocialGpRewardClaims(user.id),
                },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/claim_social_gp_reward error", err);
            return c.json<ClaimSocialGpRewardResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/claim_rewarded_ad_gp",
    validateParams(zClaimRewardedAdGpRequest),
    async (c) => {
        const user = c.get("user")!;
        if (!Config.h5GamesAds.enabled) {
            return c.json<ClaimRewardedAdGpResponse>(
                {
                    success: false,
                    error: "ads_disabled",
                    gpBalance: user.gpBalance,
                    rewardedAdGp: await getRewardedAdGpState(user.id),
                },
                200,
            );
        }

        const rewardKeys = getRewardedAdGpRewardKeys();
        const ip = getHonoIp(c, Config.apiServer.proxyIPHeader);
        const encodedIp = ip ? hashRewardIp(ip) : "";

        try {
            const result = await db.transaction(async (tx) => {
                const claimedRows = await tx
                    .select({
                        rewardKey: rewardClaimsTable.rewardKey,
                    })
                    .from(rewardClaimsTable)
                    .where(
                        and(
                            eq(rewardClaimsTable.userId, user.id),
                            inArray(rewardClaimsTable.rewardKey, rewardKeys),
                        ),
                    );
                const claimedKeys = new Set(claimedRows.map((row) => row.rewardKey));
                const nextRewardKey = rewardKeys.find((key) => !claimedKeys.has(key));

                if (!nextRewardKey) {
                    return { ok: false as const, error: "daily_limit" as const };
                }

                const inserted = await tx
                    .insert(rewardClaimsTable)
                    .values({
                        rewardKey: nextRewardKey,
                        userId: user.id,
                        encodedIp,
                        grantedGp: REWARDED_AD_GP_AMOUNT,
                    })
                    .onConflictDoNothing({
                        target: [rewardClaimsTable.rewardKey, rewardClaimsTable.userId],
                    })
                    .returning({
                        id: rewardClaimsTable.id,
                    });

                if (inserted.length === 0) {
                    return { ok: false as const, error: "daily_limit" as const };
                }

                const [updatedUser] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${REWARDED_AD_GP_AMOUNT}`,
                    })
                    .where(eq(usersTable.id, user.id))
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                return updatedUser
                    ? { ok: true as const, gpBalance: updatedUser.gpBalance }
                    : { ok: false as const, error: "server_error" as const };
            });

            if (!result.ok) {
                return c.json<ClaimRewardedAdGpResponse>(
                    {
                        success: false,
                        error: result.error,
                        gpBalance: user.gpBalance,
                        rewardedAdGp: await getRewardedAdGpState(user.id),
                    },
                    200,
                );
            }

            return c.json<ClaimRewardedAdGpResponse>(
                {
                    success: true,
                    gpBalance: result.gpBalance,
                    rewardedAdGp: await getRewardedAdGpState(user.id),
                },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/claim_rewarded_ad_gp error", err);
            return c.json<ClaimRewardedAdGpResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/claim_loot_box_ad",
    validateParams(zClaimLootBoxAdRequest),
    async (c) => {
        const user = c.get("user")!;
        const { boxId } = c.req.valid("json");
        const box = getLootBox(boxId);
        const rewardKeys = getLootBoxAdRewardKeys(boxId);

        if (!box || rewardKeys.length === 0) {
            return c.json<ClaimLootBoxAdResponse>(
                {
                    success: false,
                    error: "box_not_found",
                    lootBoxAdStates: await getLootBoxAdStates(user.id),
                },
                200,
            );
        }

        if (!Config.h5GamesAds.enabled) {
            return c.json<ClaimLootBoxAdResponse>(
                {
                    success: false,
                    error: "ads_disabled",
                    lootBoxAdStates: await getLootBoxAdStates(user.id),
                },
                200,
            );
        }

        const openRewardKey = getLootBoxAdOpenRewardKey(boxId);
        const ip = getHonoIp(c, Config.apiServer.proxyIPHeader);
        const encodedIp = ip ? hashRewardIp(ip) : "";

        try {
            const result = await db.transaction(async (tx) => {
                const claimedRows = await tx
                    .select({
                        rewardKey: rewardClaimsTable.rewardKey,
                    })
                    .from(rewardClaimsTable)
                    .where(
                        and(
                            eq(rewardClaimsTable.userId, user.id),
                            inArray(rewardClaimsTable.rewardKey, [
                                ...rewardKeys,
                                openRewardKey,
                            ]),
                        ),
                    );
                const claimedKeys = new Set(claimedRows.map((row) => row.rewardKey));

                if (claimedKeys.has(openRewardKey)) {
                    return { ok: false as const, error: "already_opened" as const };
                }

                const nextRewardKey = rewardKeys.find((key) => !claimedKeys.has(key));
                if (!nextRewardKey) {
                    return { ok: false as const, error: "daily_limit" as const };
                }

                const inserted = await tx
                    .insert(rewardClaimsTable)
                    .values({
                        rewardKey: nextRewardKey,
                        userId: user.id,
                        encodedIp,
                    })
                    .onConflictDoNothing({
                        target: [rewardClaimsTable.rewardKey, rewardClaimsTable.userId],
                    })
                    .returning({
                        id: rewardClaimsTable.id,
                    });

                return inserted.length > 0
                    ? { ok: true as const }
                    : { ok: false as const, error: "daily_limit" as const };
            });

            if (!result.ok) {
                return c.json<ClaimLootBoxAdResponse>(
                    {
                        success: false,
                        error: result.error,
                        lootBoxAdStates: await getLootBoxAdStates(user.id),
                    },
                    200,
                );
            }

            return c.json<ClaimLootBoxAdResponse>(
                {
                    success: true,
                    lootBoxAdStates: await getLootBoxAdStates(user.id),
                },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/claim_loot_box_ad error", err);
            return c.json<ClaimLootBoxAdResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/create_market_listing",
    validateParams(zCreateMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { itemId, price } = c.req.valid("json");
        if (!Number.isInteger(price)) {
            return c.json<CreateMarketListingResponse>(
                { success: false, error: "invalid_price" },
                200,
            );
        }
        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const ownedItem = await tx.query.itemsTable.findFirst({
                    where: and(eq(itemsTable.userId, user.id), eq(itemsTable.id, itemId)),
                });

                if (!ownedItem) {
                    return { ok: false as const, error: "item_not_owned" as const };
                }

                const itemType = ownedItem.type;
                const priceBounds = getMarketPriceBounds(itemType);

                if (!isSupportedMarketItem(itemType) || !priceBounds) {
                    return { ok: false as const, error: "invalid_item" as const };
                }
                if (price < priceBounds.min) {
                    return { ok: false as const, error: "price_too_low" as const };
                }
                if (price > priceBounds.max) {
                    return { ok: false as const, error: "price_too_high" as const };
                }

                const existingListing = await tx.query.marketListingTable.findFirst({
                    where: and(
                        eq(marketListingTable.sellerUserId, user.id),
                        eq(marketListingTable.itemId, itemId),
                        eq(marketListingTable.status, "active"),
                    ),
                    columns: { id: true },
                });

                if (existingListing) {
                    return { ok: false as const, error: "already_listed" as const };
                }

                await tx.delete(itemsTable).where(eq(itemsTable.id, itemId));

                const remainingItems = await tx
                    .select({
                        id: itemsTable.id,
                        type: itemsTable.type,
                        timeAcquired: itemsTable.timeAcquired,
                        source: itemsTable.source,
                        status: itemsTable.status,
                    })
                    .from(itemsTable)
                    .where(eq(itemsTable.userId, user.id));

                await tx
                    .update(usersTable)
                    .set({
                        loadout: loadout.validateWithAvailableItems(
                            user.loadout,
                            remainingItems,
                        ),
                    })
                    .where(eq(usersTable.id, user.id));

                await tx.insert(marketListingTable).values({
                    sellerUserId: user.id,
                    itemId,
                    itemType,
                    itemMaker:
                        ownedItem.maker === "Unknown"
                            ? getItemMakerName(user)
                            : ownedItem.maker,
                    itemKills: ownedItem.kills,
                    itemWins: ownedItem.wins,
                    price,
                    status: "active",
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CreateMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/create_market_listing error", err);
            return c.json<CreateMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CreateMarketListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post(
    "/buy_market_listing",
    validateParams(zBuyMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const listing = await tx.query.marketListingTable.findFirst({
                    where: and(
                        eq(marketListingTable.id, listingId),
                        eq(marketListingTable.status, "active"),
                    ),
                });

                if (!listing) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }
                if (listing.sellerUserId === user.id) {
                    return {
                        ok: false as const,
                        error: "cannot_buy_own_listing" as const,
                    };
                }

                const buyer = await tx.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                });
                if (!buyer || buyer.gpBalance < listing.price) {
                    return { ok: false as const, error: "not_enough_gp" as const };
                }

                const claimedListing = await tx
                    .update(marketListingTable)
                    .set({
                        status: "sold",
                        buyerUserId: user.id,
                        soldAt: new Date(),
                        sellerNotifiedAt: null,
                    })
                    .where(
                        and(
                            eq(marketListingTable.id, listingId),
                            eq(marketListingTable.status, "active"),
                        ),
                    )
                    .returning({ id: marketListingTable.id });

                if (claimedListing.length === 0) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }

                await tx.insert(itemsTable).values({
                    id: listing.itemId,
                    userId: user.id,
                    type: listing.itemType,
                    maker: listing.itemMaker,
                    kills: listing.itemKills,
                    wins: listing.itemWins,
                    source: "market_buy",
                    timeAcquired: Date.now(),
                });

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: buyer.gpBalance - listing.price,
                    })
                    .where(eq(usersTable.id, user.id));

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${listing.price}`,
                    })
                    .where(eq(usersTable.id, listing.sellerUserId));

                return {
                    ok: true as const,
                    gpBalance: buyer.gpBalance - listing.price,
                    price: listing.price,
                    itemType: listing.itemType,
                    sellerUserId: listing.sellerUserId,
                };
            });

            if (!result.ok) {
                return c.json<BuyMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }

            const [buyerInfo, sellerInfo] = await Promise.all([
                db.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                    columns: {
                        slug: true,
                    },
                }),
                db.query.usersTable.findFirst({
                    where: eq(usersTable.id, result.sellerUserId),
                    columns: {
                        slug: true,
                    },
                }),
            ]);

            void logMarketPurchaseToDiscord({
                buyerSlug: buyerInfo?.slug || "unknown",
                sellerSlug: sellerInfo?.slug || "unknown",
                itemType: result.itemType,
                price: result.price,
            });

            return c.json<BuyMarketListingResponse>(
                { success: true, gpBalance: result.gpBalance },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/buy_market_listing error", err);
            return c.json<BuyMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/create_auction_listing",
    validateParams(zCreateAuctionListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { itemId, startPrice } = c.req.valid("json");
        if (!Number.isInteger(startPrice)) {
            return c.json<CreateAuctionListingResponse>(
                { success: false, error: "invalid_price" },
                200,
            );
        }

        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);
                await expireAuctionListings(tx);

                const ownedItem = await tx.query.itemsTable.findFirst({
                    where: and(eq(itemsTable.userId, user.id), eq(itemsTable.id, itemId)),
                });
                if (!ownedItem) {
                    return { ok: false as const, error: "item_not_owned" as const };
                }

                const priceBounds = getAuctionPriceBounds(ownedItem.type);
                if (!isSupportedMarketItem(ownedItem.type) || !priceBounds) {
                    return { ok: false as const, error: "invalid_item" as const };
                }
                if (startPrice < priceBounds.min) {
                    return { ok: false as const, error: "price_too_low" as const };
                }
                if (startPrice > priceBounds.max) {
                    return { ok: false as const, error: "price_too_high" as const };
                }

                const existingAuction = await tx.query.auctionListingTable.findFirst({
                    where: and(
                        eq(auctionListingTable.sellerUserId, user.id),
                        eq(auctionListingTable.itemId, itemId),
                        eq(auctionListingTable.status, "active"),
                    ),
                    columns: { id: true },
                });
                if (existingAuction) {
                    return { ok: false as const, error: "already_listed" as const };
                }

                await tx.delete(itemsTable).where(eq(itemsTable.id, itemId));

                const remainingItems = await tx
                    .select({
                        id: itemsTable.id,
                        type: itemsTable.type,
                        timeAcquired: itemsTable.timeAcquired,
                        source: itemsTable.source,
                        status: itemsTable.status,
                    })
                    .from(itemsTable)
                    .where(eq(itemsTable.userId, user.id));

                await tx
                    .update(usersTable)
                    .set({
                        loadout: loadout.validateWithAvailableItems(
                            user.loadout,
                            remainingItems,
                        ),
                    })
                    .where(eq(usersTable.id, user.id));

                await tx.insert(auctionListingTable).values({
                    sellerUserId: user.id,
                    itemId,
                    itemType: ownedItem.type,
                    itemMaker:
                        ownedItem.maker === "Unknown"
                            ? getItemMakerName(user)
                            : ownedItem.maker,
                    itemKills: ownedItem.kills,
                    itemWins: ownedItem.wins,
                    startPrice,
                    highestBid: 0,
                    status: "active",
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CreateAuctionListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/create_auction_listing error", err);
            return c.json<CreateAuctionListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CreateAuctionListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post(
    "/place_auction_bid",
    validateParams(zPlaceAuctionBidRequest),
    async (c) => {
        const user = c.get("user")!;
        const { auctionId, amount } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireAuctionListings(tx);

                const auction = await tx.query.auctionListingTable.findFirst({
                    where: and(
                        eq(auctionListingTable.id, auctionId),
                        eq(auctionListingTable.status, "active"),
                    ),
                });
                if (!auction) {
                    return { ok: false as const, error: "auction_not_found" as const };
                }
                if (auction.sellerUserId === user.id) {
                    return {
                        ok: false as const,
                        error: "cannot_bid_own_auction" as const,
                    };
                }

                const minimumBid = Math.max(auction.startPrice, auction.highestBid + 1);
                if (amount < minimumBid) {
                    return { ok: false as const, error: "bid_too_low" as const };
                }

                const bidder = await tx.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                });
                const isCurrentTopBidder = auction.highestBidUserId === user.id;
                const additionalAmount = isCurrentTopBidder
                    ? amount - auction.highestBid
                    : amount;
                if (
                    !bidder ||
                    additionalAmount < 1 ||
                    bidder.gpBalance < additionalAmount
                ) {
                    return { ok: false as const, error: "not_enough_gp" as const };
                }

                if (
                    auction.highestBidUserId &&
                    auction.highestBid > 0 &&
                    auction.highestBidUserId !== user.id
                ) {
                    await tx
                        .update(usersTable)
                        .set({
                            gpBalance: sql`${usersTable.gpBalance} + ${auction.highestBid}`,
                        })
                        .where(eq(usersTable.id, auction.highestBidUserId));
                }

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: bidder.gpBalance - additionalAmount,
                    })
                    .where(eq(usersTable.id, user.id));

                await tx
                    .update(auctionListingTable)
                    .set({
                        highestBidUserId: user.id,
                        highestBid: amount,
                    })
                    .where(eq(auctionListingTable.id, auction.id));

                await tx.insert(auctionBidTable).values({
                    auctionId: auction.id,
                    bidderUserId: user.id,
                    amount,
                });

                return {
                    ok: true as const,
                    gpBalance: bidder.gpBalance - additionalAmount,
                };
            });

            if (!result.ok) {
                return c.json<PlaceAuctionBidResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }

            return c.json<PlaceAuctionBidResponse>(
                { success: true, gpBalance: result.gpBalance },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/place_auction_bid error", err);
            return c.json<PlaceAuctionBidResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/buy_featured_bundle",
    validateParams(zBuyFeaturedBundleRequest),
    async (c) => {
        const user = c.get("user")!;
        const { bundleId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                const { offers } = getFeaturedBundleOffers();
                const offer = offers.find((entry) => entry.id === bundleId);

                if (!offer) {
                    return { ok: false as const, error: "bundle_not_found" as const };
                }

                const bundleSource = getFeaturedBundleSource(offer.id);
                const buyer = await tx.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                });

                if (!buyer) {
                    return { ok: false as const, error: "server_error" as const };
                }

                const existingBundleItem = await tx.query.itemsTable.findFirst({
                    where: and(
                        eq(itemsTable.userId, user.id),
                        eq(itemsTable.source, bundleSource),
                    ),
                    columns: { id: true },
                });

                if (existingBundleItem) {
                    return { ok: false as const, error: "already_purchased" as const };
                }

                if (buyer.gpBalance < offer.price) {
                    return { ok: false as const, error: "not_enough_gp" as const };
                }

                await tx.insert(itemsTable).values(
                    offer.itemTypes.map((itemType) => ({
                        userId: user.id,
                        type: itemType,
                        maker: getItemMakerName(user),
                        source: bundleSource,
                        timeAcquired: Date.now(),
                    })),
                );

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: buyer.gpBalance - offer.price,
                    })
                    .where(eq(usersTable.id, user.id));

                return {
                    ok: true as const,
                    gpBalance: buyer.gpBalance - offer.price,
                };
            });

            if (!result.ok) {
                return c.json<BuyFeaturedBundleResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }

            return c.json<BuyFeaturedBundleResponse>(
                { success: true, gpBalance: result.gpBalance },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/buy_featured_bundle error", err);
            return c.json<BuyFeaturedBundleResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post("/open_loot_box", validateParams(zOpenLootBoxRequest), async (c) => {
    const user = c.get("user")!;
    const { boxId, payment } = c.req.valid("json");

    try {
        const result = await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
            const box = getLootBox(boxId);
            if (!box) {
                return { ok: false as const, error: "box_not_found" as const };
            }

            const buyer = await tx.query.usersTable.findFirst({
                where: eq(usersTable.id, user.id),
            });

            if (!buyer) {
                return { ok: false as const, error: "server_error" as const };
            }

            const adRequirement = getLootBoxAdRequirement(boxId);
            if (adRequirement > 0 && payment !== "ads") {
                return {
                    ok: false as const,
                    error: "ad_requirement_not_met" as const,
                };
            }

            if (payment === "ads") {
                if (!Config.h5GamesAds.enabled) {
                    return { ok: false as const, error: "ads_disabled" as const };
                }

                const rewardKeys = getLootBoxAdRewardKeys(boxId);
                const openRewardKey = getLootBoxAdOpenRewardKey(boxId);
                if (rewardKeys.length === 0) {
                    return { ok: false as const, error: "box_not_found" as const };
                }

                const claimedRows = await tx
                    .select({
                        rewardKey: rewardClaimsTable.rewardKey,
                    })
                    .from(rewardClaimsTable)
                    .where(
                        and(
                            eq(rewardClaimsTable.userId, user.id),
                            inArray(rewardClaimsTable.rewardKey, [
                                ...rewardKeys,
                                openRewardKey,
                            ]),
                        ),
                    );
                const claimedKeys = new Set(claimedRows.map((row) => row.rewardKey));

                if (claimedKeys.has(openRewardKey)) {
                    return { ok: false as const, error: "daily_limit" as const };
                }

                if (!rewardKeys.every((key) => claimedKeys.has(key))) {
                    return {
                        ok: false as const,
                        error: "ad_requirement_not_met" as const,
                    };
                }

                await tx.insert(rewardClaimsTable).values({
                    rewardKey: openRewardKey,
                    userId: user.id,
                    encodedIp: "",
                });
            } else if (buyer.gpBalance < box.price) {
                return { ok: false as const, error: "not_enough_gp" as const };
            }

            const reward = pickLootBoxReward(boxId);
            if (!reward) {
                return { ok: false as const, error: "server_error" as const };
            }

            await tx.insert(itemsTable).values({
                userId: user.id,
                type: reward.itemType,
                source: box.source,
                maker: getItemMakerName(user),
                timeAcquired: Date.now(),
            });

            const gpBalance =
                payment === "ads" ? buyer.gpBalance : buyer.gpBalance - box.price;

            if (payment !== "ads") {
                await tx
                    .update(usersTable)
                    .set({
                        gpBalance,
                    })
                    .where(eq(usersTable.id, user.id));
            }

            return {
                ok: true as const,
                gpBalance,
                itemType: reward.itemType,
            };
        });

        if (!result.ok) {
            return c.json<OpenLootBoxResponse>(
                {
                    success: false,
                    error: result.error,
                    lootBoxAdStates: await getLootBoxAdStates(user.id),
                },
                200,
            );
        }

        return c.json<OpenLootBoxResponse>(
            {
                success: true,
                gpBalance: result.gpBalance,
                itemType: result.itemType,
                lootBoxAdStates: await getLootBoxAdStates(user.id),
            },
            200,
        );
    } catch (err) {
        server.logger.error("/api/user/open_loot_box error", err);
        return c.json<OpenLootBoxResponse>(
            { success: false, error: "server_error" },
            500,
        );
    }
});

UserRouter.post(
    "/ack_sold_market_listings",
    validateParams(zAckSoldMarketListingsRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingIds } = c.req.valid("json");

        if (listingIds.length > 0) {
            await db
                .update(marketListingTable)
                .set({
                    sellerNotifiedAt: new Date(),
                })
                .where(
                    and(
                        eq(marketListingTable.sellerUserId, user.id),
                        eq(marketListingTable.status, "sold"),
                        inArray(marketListingTable.id, listingIds),
                    ),
                );
        }

        return c.json<AckSoldMarketListingsResponse>({ success: true }, 200);
    },
);

UserRouter.post(
    "/cancel_market_listing",
    validateParams(zCancelMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const canceled = await tx
                    .update(marketListingTable)
                    .set({
                        status: "cancelled",
                        canceledAt: new Date(),
                    })
                    .where(
                        and(
                            eq(marketListingTable.id, listingId),
                            eq(marketListingTable.sellerUserId, user.id),
                            eq(marketListingTable.status, "active"),
                        ),
                    )
                    .returning({
                        itemId: marketListingTable.itemId,
                        itemType: marketListingTable.itemType,
                        itemMaker: marketListingTable.itemMaker,
                        itemKills: marketListingTable.itemKills,
                        itemWins: marketListingTable.itemWins,
                    });

                if (canceled.length === 0) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }

                await tx.insert(itemsTable).values({
                    id: canceled[0]!.itemId,
                    userId: user.id,
                    type: canceled[0]!.itemType,
                    maker: canceled[0]!.itemMaker,
                    kills: canceled[0]!.itemKills,
                    wins: canceled[0]!.itemWins,
                    source: "market_cancel",
                    timeAcquired: Date.now(),
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CancelMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/cancel_market_listing error", err);
            return c.json<CancelMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CancelMarketListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post(
    "/cancel_auction_listing",
    validateParams(zCancelAuctionListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { auctionId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireAuctionListings(tx);

                const canceled = await tx
                    .update(auctionListingTable)
                    .set({
                        status: "cancelled",
                        canceledAt: new Date(),
                    })
                    .where(
                        and(
                            eq(auctionListingTable.id, auctionId),
                            eq(auctionListingTable.sellerUserId, user.id),
                            eq(auctionListingTable.status, "active"),
                        ),
                    )
                    .returning({
                        itemId: auctionListingTable.itemId,
                        itemType: auctionListingTable.itemType,
                        itemMaker: auctionListingTable.itemMaker,
                        itemKills: auctionListingTable.itemKills,
                        itemWins: auctionListingTable.itemWins,
                        highestBid: auctionListingTable.highestBid,
                        highestBidUserId: auctionListingTable.highestBidUserId,
                    });

                if (canceled.length === 0) {
                    return { ok: false as const, error: "auction_not_found" as const };
                }

                const auction = canceled[0]!;
                if (auction.highestBidUserId && auction.highestBid > 0) {
                    await tx
                        .update(usersTable)
                        .set({
                            gpBalance: sql`${usersTable.gpBalance} + ${auction.highestBid}`,
                        })
                        .where(eq(usersTable.id, auction.highestBidUserId));
                }

                await tx.insert(itemsTable).values({
                    id: auction.itemId,
                    userId: user.id,
                    type: auction.itemType,
                    maker: auction.itemMaker,
                    kills: auction.itemKills,
                    wins: auction.itemWins,
                    source: "auction_cancel",
                    timeAcquired: Date.now(),
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CancelAuctionListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/cancel_auction_listing error", err);
            return c.json<CancelAuctionListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CancelAuctionListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post("/reset_stats", async (c) => {
    const user = c.get("user")!;

    await db
        .update(matchDataTable)
        .set({ userId: null })
        .where(eq(matchDataTable.userId, user.id));

    return c.json({}, 200);
});
