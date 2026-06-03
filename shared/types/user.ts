import { z } from "zod";
import { Constants } from "../../shared/net/net";
import type { LootBoxDef } from "../defs/gameObjects/lootBoxDefs";
import type { FeaturedBundleOffer } from "../utils/featuredBundles";
import { type Item, ItemStatus, type Loadout, loadoutSchema } from "../utils/loadout";
import { marketMaxSellPrice } from "../utils/marketPricing";

export type ProfileResponse =
    | {
          readonly banned: true;
          reason: string;
          success?: false;
      }
    | {
          banned?: false;
          readonly success: true;
          profile: {
              slug: string;
              username: string;
              usernameSet: boolean;
              linked: boolean;
              linkedGoogle: boolean;
              linkedDiscord: boolean;
              usernameChangeTime: number;
              canUseDeveloper: boolean;
          };
          gpBalance: number;
          thankYouGift?: {
              amount: number;
          };
          gpGifts?: GpGift[];
          skinGifts?: SkinGift[];
          rewardedAdGp?: RewardedAdGpState;
          loadout: Loadout;
          items: Item[];
      };

export const zUnlinkAuthRequest = z.object({
    provider: z.enum(["google", "discord"]),
});
export type UnlinkAuthRequest = z.infer<typeof zUnlinkAuthRequest>;
export type UnlinkAuthResponse =
    | { success: true }
    | { success: false; error: "not_linked" | "last_login_method" };

export type MarketListing = {
    id: string;
    itemId: string;
    itemType: string;
    maker: string;
    kills: number;
    wins: number;
    price: number;
    sellerSlug: string;
    createdAt: number;
};

export type SoldMarketListing = {
    id: string;
    itemId: string;
    itemType: string;
    price: number;
    soldAt: number;
};

export type AuctionBidActivity = {
    bidderSlug: string;
    amount: number;
    createdAt: number;
};

export type AuctionListing = {
    id: string;
    itemId: string;
    itemType: string;
    maker: string;
    kills: number;
    wins: number;
    sellerSlug: string;
    startPrice: number;
    highestBid: number;
    bidCount: number;
    highestBidderSlug?: string;
    createdAt: number;
    activities: AuctionBidActivity[];
};

export const zUsernameRequest = z.object({
    username: z.string().trim().min(1).max(Constants.PlayerNameMaxLen),
});
export type UsernameRequest = z.infer<typeof zUsernameRequest>;
export type UsernameResponse =
    | {
          result: "success";
      }
    | {
          result: "failed" | "invalid" | "taken" | "change_time_not_expired";
      };

export type FriendUser = {
    userId: string;
    slug: string;
    username: string;
    playerIcon: string;
    relationStatus: "none" | "friends" | "outgoing" | "incoming";
};

export type FriendsListResponse = {
    success: boolean;
    friends: FriendUser[];
    incomingRequests: FriendUser[];
    outgoingRequests: FriendUser[];
};

export const zFriendSearchRequest = z.object({
    query: z.string().trim().min(2).max(32),
});
export type FriendSearchRequest = z.infer<typeof zFriendSearchRequest>;
export type FriendSearchResponse = {
    success: boolean;
    results: FriendUser[];
};

export const zAddFriendRequest = z.object({
    userId: z.string().trim().min(1),
});
export type AddFriendRequest = z.infer<typeof zAddFriendRequest>;
export type AddFriendResponse = {
    success: boolean;
    error?:
        | "not_found"
        | "self"
        | "already_friends"
        | "already_requested"
        | "server_error";
    request?: FriendUser;
};

export type GpGift = {
    id: string;
    amount: number;
    senderSlug: string;
    senderUsername: string;
};

export const zFriendUserRequest = z.object({
    userId: z.string().trim().min(1),
});
export type FriendUserRequest = z.infer<typeof zFriendUserRequest>;
export type RemoveFriendResponse = {
    success: boolean;
    error?: "not_found" | "server_error";
};

export const zSendFriendGpRequest = z.object({
    userId: z.string().trim().min(1),
    amount: z.number().int().min(1).max(999_999_999),
});
export type SendFriendGpRequest = z.infer<typeof zSendFriendGpRequest>;
export type SendFriendGpResponse = {
    success: boolean;
    error?: "not_friend" | "not_found" | "not_enough_gp" | "server_error";
    gpBalance?: number;
};

export type SkinGift = {
    id: string;
    itemTypes: string[];
    senderSlug: string;
    senderUsername: string;
};

export const zSendFriendSkinGiftRequest = z.object({
    userId: z.string().trim().min(1),
    itemIds: z.array(z.string().uuid()).min(1).max(20),
});
export type SendFriendSkinGiftRequest = z.infer<typeof zSendFriendSkinGiftRequest>;
export type SendFriendSkinGiftResponse = {
    success: boolean;
    error?:
        | "not_friend"
        | "not_found"
        | "item_not_owned"
        | "invalid_item"
        | "server_error";
    items?: Item[];
    loadout?: Loadout;
};

export const zFriendRequestActionRequest = z.object({
    userId: z.string().trim().min(1),
});
export type FriendRequestActionRequest = z.infer<typeof zFriendRequestActionRequest>;
export type FriendRequestActionResponse = {
    success: boolean;
    error?: "not_found" | "server_error";
    friend?: FriendUser;
};

export const zLoadoutRequest = z.object({ loadout: loadoutSchema });

export type LoadoutRequest = z.infer<typeof zLoadoutRequest>;
export type LoadoutResponse = {
    loadout: Loadout;
};

export const zSetItemStatusRequest = z.object({
    status: z.nativeEnum(ItemStatus),
    itemTypes: z.array(z.string()).max(50),
});

export type SetItemStatusRequest = z.infer<typeof zSetItemStatusRequest>;
export type SetItemStatusResponse = {};

//
// PASS
//

export const zSetQuestRequest = z.object({
    questType: z.string(),
    idx: z.number(),
});
export type SetQuestRequest = z.infer<typeof zSetQuestRequest>;
export type SetQuestResponse = {};

export const zSetPassUnlockRequest = z.object({
    unlockType: z.string(),
});
export type SetPassUnlockRequest = z.infer<typeof zSetPassUnlockRequest>;
export type SetPassUnlockResponse = { success: boolean };

export const zBuyPremiumPassRequest = z.object({});
export type BuyPremiumPassRequest = z.infer<typeof zBuyPremiumPassRequest>;
export type BuyPremiumPassResponse = {
    success: boolean;
    error?: "already_purchased" | "not_enough_gp" | "server_error";
    gpBalance?: number;
};

export const zBuyFullPassRequest = z.object({});
export type BuyFullPassRequest = z.infer<typeof zBuyFullPassRequest>;
export type BuyFullPassResponse = BuyPremiumPassResponse;

export const zGetPassRequest = z.object({
    tryRefreshQuests: z.boolean(),
});
export type GetPassRequest = z.infer<typeof zGetPassRequest>;
export type PassState = {
    type: string;
    level: number;
    xp: number;
    unlocks: Record<string, boolean>;
    newItems: boolean;
};

export type QuestState = {
    idx: number;
    type: string;
    progress: number;
    target: number;
    complete: boolean;
    rerolled: boolean;
    timeToRefresh: number;
};

export type SideQuestState = QuestState & {
    gpReward: number;
    title: string;
};

export type GetPassResponse = {
    success: true;
    pass: PassState;
    quests: QuestState[];
    sideQuests: SideQuestState[];
};

export const zOpenLootBoxRequest = z.object({
    boxId: z.string().trim().min(1),
    payment: z.enum(["gp", "ads"]).optional().default("gp"),
});

export type OpenLootBoxRequest = z.infer<typeof zOpenLootBoxRequest>;
export type OpenLootBoxResponse =
    | {
          success: true;
          gpBalance: number;
          itemType: string;
          lootBoxAdStates?: Record<string, LootBoxAdState>;
      }
    | {
          success: false;
          error:
              | "box_not_found"
              | "not_enough_gp"
              | "ads_disabled"
              | "ad_requirement_not_met"
              | "daily_limit"
              | "server_error";
          lootBoxAdStates?: Record<string, LootBoxAdState>;
      };

export type ShopLootBox = Pick<LootBoxDef, "id" | "name" | "price" | "chances"> & {
    itemTypes: string[];
    adRequirement?: number;
};

export const zRefreshQuestRequest = z.object({
    idx: z.number(),
});
export type RefreshQuestRequest = z.infer<typeof zRefreshQuestRequest>;
export type RefreshQuestResponse = { success: boolean };

export type GetMarketResponse = {
    success: true;
    gpBalance: number;
    listings: MarketListing[];
    userListings: MarketListing[];
    auctions: AuctionListing[];
    userAuctions: AuctionListing[];
    soldListings: SoldMarketListing[];
    expiredItemTypes: string[];
    featuredBundles: FeaturedBundleOffer[];
    lootBoxes: ShopLootBox[];
    lootBoxAdStates: Record<string, LootBoxAdState>;
    socialGpRewardClaims: Partial<Record<SocialGpRewardKey, boolean>>;
};

export const socialGpRewardKeys = ["github_star", "discord_join"] as const;
export type SocialGpRewardKey = (typeof socialGpRewardKeys)[number];
export const zClaimSocialGpRewardRequest = z.object({
    rewardKey: z.enum(socialGpRewardKeys),
});
export type ClaimSocialGpRewardRequest = z.infer<typeof zClaimSocialGpRewardRequest>;
export type ClaimSocialGpRewardResponse = {
    success: boolean;
    error?: "already_claimed" | "reward_not_found" | "server_error";
    gpBalance?: number;
    socialGpRewardClaims?: Partial<Record<SocialGpRewardKey, boolean>>;
};

export type RewardedAdGpState = {
    amount: number;
    limit: number;
    claimed: number;
    remaining: number;
    resetAt: number;
};

export type LootBoxAdState = {
    required: number;
    watched: number;
    remaining: number;
    opened: boolean;
    resetAt: number;
};

export const zClaimLootBoxAdRequest = z.object({
    boxId: z.string().trim().min(1),
});
export type ClaimLootBoxAdRequest = z.infer<typeof zClaimLootBoxAdRequest>;
export type ClaimLootBoxAdResponse = {
    success: boolean;
    error?:
        | "box_not_found"
        | "ads_disabled"
        | "daily_limit"
        | "already_opened"
        | "server_error";
    lootBoxAdStates?: Record<string, LootBoxAdState>;
};

export const zClaimRewardedAdGpRequest = z.object({});
export type ClaimRewardedAdGpRequest = z.infer<typeof zClaimRewardedAdGpRequest>;
export type ClaimRewardedAdGpResponse = {
    success: boolean;
    error?: "ads_disabled" | "daily_limit" | "server_error";
    gpBalance?: number;
    rewardedAdGp?: RewardedAdGpState;
};

export const zCreateMarketListingRequest = z.object({
    itemId: z.string().uuid(),
    price: z.number().int().max(marketMaxSellPrice),
});
export type CreateMarketListingRequest = z.infer<typeof zCreateMarketListingRequest>;
export type CreateMarketListingResponse = {
    success: boolean;
    error?:
        | "item_not_owned"
        | "invalid_item"
        | "already_listed"
        | "invalid_price"
        | "price_too_low"
        | "price_too_high"
        | "server_error";
    gpBalance?: number;
};

export const zCreateAuctionListingRequest = z.object({
    itemId: z.string().uuid(),
    startPrice: z
        .number()
        .int()
        .refine((value) => value <= marketMaxSellPrice),
});
export type CreateAuctionListingRequest = z.infer<typeof zCreateAuctionListingRequest>;
export type CreateAuctionListingResponse = {
    success: boolean;
    error?:
        | "item_not_owned"
        | "invalid_item"
        | "already_listed"
        | "invalid_price"
        | "price_too_low"
        | "price_too_high"
        | "server_error";
    gpBalance?: number;
};

export const zPlaceAuctionBidRequest = z.object({
    auctionId: z.string().uuid(),
    amount: z.number().int().min(1).max(999_999_999),
});
export type PlaceAuctionBidRequest = z.infer<typeof zPlaceAuctionBidRequest>;
export type PlaceAuctionBidResponse = {
    success: boolean;
    error?:
        | "auction_not_found"
        | "cannot_bid_own_auction"
        | "bid_too_low"
        | "not_enough_gp"
        | "server_error";
    gpBalance?: number;
};

export const zBuyMarketListingRequest = z.object({
    listingId: z.string().uuid(),
});
export type BuyMarketListingRequest = z.infer<typeof zBuyMarketListingRequest>;
export type BuyMarketListingResponse = {
    success: boolean;
    error?:
        | "listing_not_found"
        | "cannot_buy_own_listing"
        | "already_owned"
        | "not_enough_gp"
        | "server_error";
    gpBalance?: number;
};

export const zBuyFeaturedBundleRequest = z.object({
    bundleId: z.string().min(1).max(64),
});
export type BuyFeaturedBundleRequest = z.infer<typeof zBuyFeaturedBundleRequest>;
export type BuyFeaturedBundleResponse = {
    success: boolean;
    error?: "bundle_not_found" | "already_purchased" | "not_enough_gp" | "server_error";
    gpBalance?: number;
};

export const zCancelAuctionListingRequest = z.object({
    auctionId: z.string().uuid(),
});
export type CancelAuctionListingRequest = z.infer<typeof zCancelAuctionListingRequest>;
export type CancelAuctionListingResponse = {
    success: boolean;
    error?: "auction_not_found" | "server_error";
    gpBalance?: number;
};

export const zCancelMarketListingRequest = z.object({
    listingId: z.string().uuid(),
});
export type CancelMarketListingRequest = z.infer<typeof zCancelMarketListingRequest>;
export type CancelMarketListingResponse = {
    success: boolean;
    error?: "listing_not_found" | "server_error";
    gpBalance?: number;
};

export const zAckSoldMarketListingsRequest = z.object({
    listingIds: z.array(z.string().uuid()).max(50),
});
export type AckSoldMarketListingsRequest = z.infer<typeof zAckSoldMarketListingsRequest>;
export type AckSoldMarketListingsResponse = {
    success: boolean;
};
