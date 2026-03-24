import { z } from "zod";
import { Constants } from "../../shared/net/net";
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
              usernameChangeTime: number;
              canUseDeveloper: boolean;
          };
          gpBalance: number;
          thankYouGift?: {
              amount: number;
          };
          loadout: Loadout;
          items: Item[];
      };

export type MarketListing = {
    id: string;
    itemId: string;
    itemType: string;
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

export type GetPassResponse = {
    success: true;
    pass: PassState;
    quests: QuestState[];
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
    soldListings: SoldMarketListing[];
    expiredItemTypes: string[];
    featuredBundles: FeaturedBundleOffer[];
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
