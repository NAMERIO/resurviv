import $ from "jquery";
import type {
    AckSoldMarketListingsRequest,
    AckSoldMarketListingsResponse,
    AddFriendRequest,
    AddFriendResponse,
    AuctionListing,
    BuyFeaturedBundleRequest,
    BuyFeaturedBundleResponse,
    BuyFullPassResponse,
    BuyMarketListingRequest,
    BuyMarketListingResponse,
    BuyPremiumPassResponse,
    CancelAuctionListingRequest,
    CancelAuctionListingResponse,
    CancelMarketListingRequest,
    CancelMarketListingResponse,
    ClaimSocialGpRewardRequest,
    ClaimSocialGpRewardResponse,
    CreateAuctionListingRequest,
    CreateAuctionListingResponse,
    CreateMarketListingRequest,
    CreateMarketListingResponse,
    FriendRequestActionRequest,
    FriendRequestActionResponse,
    FriendSearchRequest,
    FriendSearchResponse,
    FriendsListResponse,
    FriendUser,
    FriendUserRequest,
    GetMarketResponse,
    GetPassRequest,
    GpGift,
    LoadoutRequest,
    LoadoutResponse,
    MarketListing,
    OpenLootBoxRequest,
    OpenLootBoxResponse,
    PlaceAuctionBidRequest,
    PlaceAuctionBidResponse,
    ProfileResponse,
    RefreshQuestRequest,
    RefreshQuestResponse,
    RemoveFriendResponse,
    SendFriendGpRequest,
    SendFriendGpResponse,
    SendFriendSkinGiftRequest,
    SendFriendSkinGiftResponse,
    SetItemStatusRequest,
    SetPassUnlockRequest,
    SetPassUnlockResponse,
    SetQuestRequest,
    ShopLootBox,
    SideQuestState,
    SkinGift,
    SocialGpRewardKey,
    SoldMarketListing,
    UnlinkAuthRequest,
    UnlinkAuthResponse,
    UsernameRequest,
    UsernameResponse,
} from "../../shared/types/user";
import type { FeaturedBundleOffer } from "../../shared/utils/featuredBundles";
import type { ItemStatus } from "../../shared/utils/loadout";
import { type Loadout, loadout as loadouts } from "../../shared/utils/loadout";
import { util } from "../../shared/utils/util";
import { api } from "./api";
import type { ConfigManager } from "./config";
import { errorLogManager } from "./errorLogs";
import { helpers } from "./helpers";
import { proxy } from "./proxy";
import type { Item } from "./ui/loadoutMenu";

type DataOrCallback =
    | Record<string, unknown>
    | ((err: null | JQuery.jqXHR<any>, res?: any) => void)
    | null;

function ajaxRequest(
    url: string,
    data: DataOrCallback,
    cb: (err: null | JQuery.jqXHR<any>, res?: any) => void,
) {
    if (typeof data === "function") {
        cb = data;
        data = null;
    }
    const opts: JQueryAjaxSettings = {
        url: api.resolveUrl(url),
        type: "POST",
        timeout: 10 * 1000,
        xhrFields: {
            withCredentials: proxy.anyLoginSupported(),
        },
        headers: {
            // Set a header to guard against CSRF attacks.
            //
            // JQuery does this automatically, however we'll add it here explicitly
            // so the intent is clear incase of refactoring in the future.
            "X-Requested-With": "XMLHttpRequest",
        },
    };
    if (data) {
        opts.contentType = "application/json; charset=utf-8";
        opts.data = JSON.stringify(data);
    }
    $.ajax(opts)
        .done((res) => {
            cb(null, res);
        })
        .fail((e) => {
            cb(e);
        });
}

export type Quest = {
    idx: number;
    type: string;
    timeAcquired: number;
    progress: number;
    target: number;
    complete: boolean;
    rerolled: boolean;
    timeToRefresh: number;
};
export type PassType = {
    type: string;
    level: number;
    xp: number;
    newItems: unknown;
};

export class Account {
    events: Record<string, Array<(...args: any[]) => void>> = {};
    requestsInFlight = 0;
    loggingIn = false;
    loggedIn = false;
    gpBalance = 0;
    socialGpRewardClaims: Partial<Record<SocialGpRewardKey, boolean>> = {};
    socialGpRewardClaimsLoaded = false;
    pendingThankYouGift: { amount: number } | null = null;
    pendingGpGifts: GpGift[] = [];
    pendingSkinGifts: SkinGift[] = [];
    profile = {
        linked: false,
        linkedGoogle: false,
        linkedDiscord: false,
        usernameSet: false,
        username: "",
        slug: "",
        canUseDeveloper: false,
        usernameChangeTime: 0,
    };

    loadout = loadouts.defaultLoadout();
    items: Item[] = [];
    featuredBundles: FeaturedBundleOffer[] = [];
    lootBoxes: ShopLootBox[] = [];
    marketListings: MarketListing[] = [];
    userMarketListings: MarketListing[] = [];
    auctionListings: AuctionListing[] = [];
    userAuctionListings: AuctionListing[] = [];
    soldMarketListings: SoldMarketListing[] = [];
    quests: Quest[] = [];
    sideQuests: SideQuestState[] = [];
    questPriv = "";
    pass: Record<string, PassType> = {};
    friends: FriendUser[] = [];
    incomingFriendRequests: FriendUser[] = [];
    outgoingFriendRequests: FriendUser[] = [];

    constructor(public config: ConfigManager) {}

    ajaxRequest(url: string, data: DataOrCallback, cb?: (err: any, res?: any) => void) {
        if (typeof data === "function") {
            cb = data;
            data = null;
        }
        this.requestsInFlight++;
        this.emit("request", this);

        ajaxRequest(url, data, (err, res) => {
            cb!(err, res);
            this.requestsInFlight--;
            this.emit("request", this);
            if (this.requestsInFlight == 0) {
                this.emit("requestsComplete");
            }
        });
    }

    addEventListener(event: string, callback: (...args: any[]) => void) {
        this.events[event] = this.events[event] || [];
        this.events[event].push(callback);
    }

    removeEventListener(event: string, callback: () => void) {
        const listeners = this.events[event] || [];
        for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i] == callback) {
                listeners.splice(i, 1);
            }
        }
    }

    emit(event: string, ...args: any[]) {
        const listenersCopy = (this.events[event] || []).slice(0);
        // const len = arguments.length;
        // const data = Array(len > 1 ? len - 1 : 0);
        // for (let i = 1; i < len; i++) {
        //     data[i - 1] = arguments[i];
        // }
        for (let i = 0; i < listenersCopy.length; i++) {
            // listenersCopy[i].apply(listenersCopy, args);
            listenersCopy[i](...args);
        }
    }

    init() {
        if (this.config.get("sessionCookie")) {
            this.setSessionCookies();
        }

        if (helpers.getCookie("app-data")) {
            this.login();
            return;
        }

        this.emit("request", this);
        this.emit("items", []);

        const storedLoadout = this.config.get("loadout");
        this.loadout = util.mergeDeep({}, loadouts.defaultLoadout(), storedLoadout);
        this.emit("loadout", this.loadout);
    }

    setSessionCookies() {
        this.clearSessionCookies();
        document.cookie = this.config.get("sessionCookie")!;
        document.cookie = `app-data=${Date.now()}`;
    }

    clearSessionCookies() {
        document.cookie = "app-sid=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "app-data=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    }

    login() {
        if (helpers.getCookie("app-data")) {
            this.loadProfile();
            this.getPass(true);
        }
    }

    logout() {
        this.config.set("profile", null);
        this.config.set("sessionCookie", null);
        this.config.set("loadout", loadouts.defaultLoadout());
        this.ajaxRequest("/api/user/logout", () => {
            window.location.reload();
        });
    }

    unlinkAuth(
        provider: UnlinkAuthRequest["provider"],
        callback: (
            error?: UnlinkAuthResponse extends { error: infer E } ? E : string,
        ) => void,
    ) {
        this.ajaxRequest(
            "/api/user/unlink_auth",
            { provider } satisfies UnlinkAuthRequest,
            (err, response: UnlinkAuthResponse) => {
                if (err) {
                    callback("server_error");
                    return;
                }
                if (!response.success) {
                    callback(response.error);
                    return;
                }
                this.loadProfile();
                callback();
            },
        );
    }

    loadProfile() {
        this.loggingIn = !this.loggedIn;
        this.ajaxRequest("/api/user/profile", (err, data: ProfileResponse) => {
            const a = this.loggingIn;
            this.loggingIn = false;
            this.loggedIn = false;
            this.profile = {} as this["profile"];
            this.gpBalance = 0;
            this.pendingThankYouGift = null;
            this.pendingGpGifts = [];
            this.pendingSkinGifts = [];
            this.items = [];
            if (err) {
                errorLogManager.storeGeneric("account", "load_profile_error");
            } else if (data.banned) {
                this.emit("error", "account_banned", data.reason);
            } else if (data.success) {
                this.loggedIn = true;
                this.profile = data.profile;
                this.gpBalance = data.gpBalance;
                this.pendingThankYouGift = data.thankYouGift || null;
                this.pendingGpGifts = data.gpGifts || [];
                this.pendingSkinGifts = data.skinGifts || [];
                this.items = data.items;
                this.loadout = data.loadout;
                const profile = this.config.get("profile") || {
                    slug: "",
                    canUseDeveloper: false,
                };
                profile.slug = data.profile.slug;
                profile.canUseDeveloper = data.profile.canUseDeveloper;
                this.config.set("profile", profile);
            }
            if (!this.loggedIn) {
                this.config.set("sessionCookie", null);
            }
            if (a && this.loggedIn) {
                this.emit("login", this);
            }
            this.emit("items", this.items);
            this.emit("loadout", this.loadout);
            this.emit("gpBalance", this.gpBalance);
            if (this.pendingThankYouGift) {
                this.emit("thankYouGift", this.pendingThankYouGift);
                this.pendingThankYouGift = null;
            }
            for (const gift of this.pendingGpGifts) {
                this.emit("gpGift", gift);
            }
            this.pendingGpGifts = [];
            for (const gift of this.pendingSkinGifts) {
                this.emit("skinGift", gift);
            }
            this.pendingSkinGifts = [];
        });
    }

    resetStats() {
        this.ajaxRequest("/api/user/reset_stats", (err) => {
            if (err) {
                errorLogManager.storeGeneric("account", "reset_stats_error");
                this.emit("error", "server_error");
            }
        });
    }

    deleteAccount() {
        this.ajaxRequest("/api/user/delete", (err) => {
            if (err) {
                errorLogManager.storeGeneric("account", "delete_error");
                this.emit("error", "server_error");
                return;
            }
            this.config.set("profile", null);
            this.config.set("sessionCookie", null);
            window.location.reload();
        });
    }

    setUsername(username: string, callback: (err?: string) => void) {
        const args: UsernameRequest = {
            username,
        };
        this.ajaxRequest("/api/user/username", args, (err, res: UsernameResponse) => {
            if (err) {
                errorLogManager.storeGeneric("account", "set_username_error");
                callback(err);
                return;
            }
            if (res.result == "success") {
                this.loadProfile();
                callback();
            } else {
                callback(res.result);
            }
        });
    }

    private applyFriendsResponse(res: FriendsListResponse) {
        this.friends = res.friends || [];
        this.incomingFriendRequests = res.incomingRequests || [];
        this.outgoingFriendRequests = res.outgoingRequests || [];
        this.emit(
            "friends",
            this.friends,
            this.incomingFriendRequests,
            this.outgoingFriendRequests,
        );
    }

    loadFriends(callback?: (success: boolean) => void, silent = false) {
        const onResponse = (err: any, res: FriendsListResponse) => {
            if (err || !res.success) {
                errorLogManager.storeGeneric("account", "load_friends_error");
                callback?.(false);
                return;
            }

            this.applyFriendsResponse(res);
            callback?.(true);
        };

        if (silent) {
            ajaxRequest("/api/user/friends", null, onResponse);
            return;
        }

        this.ajaxRequest("/api/user/friends", onResponse);
    }

    searchFriends(
        query: string,
        callback: (success: boolean, results: FriendUser[]) => void,
    ) {
        const args: FriendSearchRequest = { query };
        this.ajaxRequest(
            "/api/user/friends/search",
            args,
            (err, res: FriendSearchResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "search_friends_error");
                    callback(false, []);
                    return;
                }

                callback(true, res.results || []);
            },
        );
    }

    addFriend(
        userId: string,
        callback?: (error?: AddFriendResponse["error"], request?: FriendUser) => void,
    ) {
        const args: AddFriendRequest = { userId };
        this.ajaxRequest("/api/user/friends/add", args, (err, res: AddFriendResponse) => {
            if (err || !res.success) {
                errorLogManager.storeGeneric("account", "add_friend_error");
                callback?.(res?.error || "server_error");
                return;
            }

            if (
                res.request &&
                !this.outgoingFriendRequests.some((request) => request.userId === userId)
            ) {
                this.outgoingFriendRequests = [
                    ...this.outgoingFriendRequests,
                    res.request,
                ].sort((a, b) => a.slug.localeCompare(b.slug));
                this.emit(
                    "friends",
                    this.friends,
                    this.incomingFriendRequests,
                    this.outgoingFriendRequests,
                );
            }
            callback?.(undefined, res.request);
        });
    }

    acceptFriendRequest(
        userId: string,
        callback?: (error?: FriendRequestActionResponse["error"]) => void,
    ) {
        const args: FriendRequestActionRequest = { userId };
        this.ajaxRequest(
            "/api/user/friends/accept",
            args,
            (err, res: FriendRequestActionResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "accept_friend_error");
                    callback?.(res?.error || "server_error");
                    return;
                }
                this.loadFriends();
                callback?.();
            },
        );
    }

    declineFriendRequest(
        userId: string,
        callback?: (error?: FriendRequestActionResponse["error"]) => void,
    ) {
        this.resolveFriendRequest("/api/user/friends/decline", userId, callback);
    }

    cancelFriendRequest(
        userId: string,
        callback?: (error?: FriendRequestActionResponse["error"]) => void,
    ) {
        this.resolveFriendRequest("/api/user/friends/cancel", userId, callback);
    }

    removeFriend(
        userId: string,
        callback?: (error?: RemoveFriendResponse["error"]) => void,
    ) {
        const args: FriendUserRequest = { userId };
        this.ajaxRequest(
            "/api/user/friends/remove",
            args,
            (err, res: RemoveFriendResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "remove_friend_error");
                    callback?.(res?.error || "server_error");
                    return;
                }
                this.loadFriends();
                callback?.();
            },
        );
    }

    sendFriendGp(
        userId: string,
        amount: number,
        callback?: (error?: SendFriendGpResponse["error"]) => void,
    ) {
        const args: SendFriendGpRequest = { userId, amount };
        this.ajaxRequest(
            "/api/user/friends/send_gp",
            args,
            (err, res: SendFriendGpResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "send_friend_gp_error");
                    if (typeof res?.gpBalance === "number") {
                        this.gpBalance = res.gpBalance;
                        this.emit("gpBalance", this.gpBalance);
                    }
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                callback?.();
            },
        );
    }

    sendFriendSkins(
        userId: string,
        itemIds: string[],
        callback?: (error?: SendFriendSkinGiftResponse["error"]) => void,
    ) {
        const args: SendFriendSkinGiftRequest = { userId, itemIds };
        this.ajaxRequest(
            "/api/user/friends/send_skins",
            args,
            (err, res: SendFriendSkinGiftResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "send_friend_skins_error");
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (res.items) {
                    this.items = res.items;
                    this.emit("items", this.items);
                }
                if (res.loadout) {
                    this.loadout = res.loadout;
                    this.config.set("loadout", this.loadout);
                    this.emit("loadout", this.loadout);
                }
                callback?.();
            },
        );
    }

    private resolveFriendRequest(
        url: string,
        userId: string,
        callback?: (error?: FriendRequestActionResponse["error"]) => void,
    ) {
        const args: FriendRequestActionRequest = { userId };
        this.ajaxRequest(url, args, (err, res: FriendRequestActionResponse) => {
            if (err || !res.success) {
                errorLogManager.storeGeneric("account", "resolve_friend_request_error");
                callback?.(res?.error || "server_error");
                return;
            }
            this.loadFriends();
            callback?.();
        });
    }

    setLoadout(loadout: Loadout) {
        // Preemptively set the new loadout and revert if the call fail
        const loadoutPrev = this.loadout;
        this.loadout = loadout;
        this.emit("loadout", this.loadout);
        this.config.set("loadout", loadout);

        if (!helpers.getCookie("app-data")) return;
        const args: LoadoutRequest = {
            loadout: loadout,
        };
        this.ajaxRequest("/api/user/loadout", args, (err, res: LoadoutResponse) => {
            if (err) {
                errorLogManager.storeGeneric("account", "set_loadout_error");
                this.emit("error", "server_error");
            }
            if (err || !res.loadout) {
                this.loadout = loadoutPrev;
            } else {
                this.loadout = res.loadout;
            }
            this.emit("loadout", this.loadout);
        });
    }

    setItemStatus(status: ItemStatus, itemTypes: string[]) {
        if (itemTypes.length != 0) {
            const itemTypeSet = new Set(itemTypes);
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (itemTypeSet.has(item.type)) {
                    item.status = Math.max(item.status!, status);
                }
            }

            const args: SetItemStatusRequest = {
                status,
                itemTypes,
            };
            this.emit("items", this.items);
            this.ajaxRequest("/api/user/set_item_status", args, (err) => {
                if (err) {
                    errorLogManager.storeGeneric("account", "set_item_status_error");
                }
            });
        }
    }

    setQuest(args: SetQuestRequest) {
        this.ajaxRequest("/api/user/set_quest", args, () => {
            this.getPass(false);
        });
    }

    getPass(tryRefreshQuests: boolean) {
        const args: GetPassRequest = {
            tryRefreshQuests,
        };
        this.ajaxRequest("/api/user/get_pass", args, (err, res) => {
            this.pass = {};
            this.quests = [];
            this.sideQuests = [];
            this.questPriv = "";
            if (err || !res.success) {
                errorLogManager.storeGeneric("account", "get_pass_error");
            } else {
                this.pass = res.pass || {};
                this.quests = res.quests || [];
                this.sideQuests = res.sideQuests || [];
                this.questPriv = res.questPriv || "";
                this.quests.sort((a, b) => {
                    return a.idx - b.idx;
                });
                this.sideQuests.sort((a, b) => {
                    return a.idx - b.idx;
                });
                this.emit("pass", this.pass, this.quests, true);
                if (this.pass.newItems) {
                    this.emit("newItemsAwarded");
                    this.loadProfile();
                }
            }
        });
    }

    setPassUnlock(unlockType: string) {
        const args: SetPassUnlockRequest = {
            unlockType,
        };
        this.ajaxRequest(
            "/api/user/set_pass_unlock",
            args,
            (err, res: SetPassUnlockResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "set_pass_unlock_error");
                } else {
                    this.getPass(false);
                }
            },
        );
    }

    buyPremiumPass(cb?: (error?: BuyPremiumPassResponse["error"]) => void) {
        this.ajaxRequest(
            "/api/user/buy_premium_pass",
            {},
            (err, res: BuyPremiumPassResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "buy_premium_pass_error");
                    cb?.(res?.error || "server_error");
                    return;
                }
                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.getPass(false);
                this.loadProfile();
                cb?.();
            },
        );
    }

    buyFullPass(cb?: (error?: BuyFullPassResponse["error"]) => void) {
        this.ajaxRequest(
            "/api/user/buy_full_pass",
            {},
            (err, res: BuyFullPassResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "buy_full_pass_error");
                    cb?.(res?.error || "server_error");
                    return;
                }
                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.getPass(false);
                this.loadProfile();
                cb?.();
            },
        );
    }

    refreshQuest(idx: number) {
        const args: RefreshQuestRequest = {
            idx,
        };
        this.ajaxRequest(
            "/api/user/refresh_quest",
            args,
            (err, res: RefreshQuestResponse) => {
                if (err) {
                    errorLogManager.storeGeneric("account", "refresh_quest_error");
                    return;
                }
                if (res.success) {
                    this.getPass(false);
                } else {
                    // Give the pass UI a chance to update quests
                    this.emit("pass", this.pass, this.quests, false);
                }
            },
        );
    }

    loadMarket(callback?: (success: boolean) => void) {
        this.ajaxRequest("/api/user/get_market", (err, res: GetMarketResponse) => {
            if (err || !res.success) {
                errorLogManager.storeGeneric("account", "get_market_error");
                callback?.(false);
                return;
            }

            this.gpBalance = res.gpBalance;
            this.socialGpRewardClaims = res.socialGpRewardClaims || {};
            this.socialGpRewardClaimsLoaded = true;
            this.featuredBundles = res.featuredBundles || [];
            this.lootBoxes = res.lootBoxes || [];
            this.marketListings = res.listings || [];
            this.userMarketListings = res.userListings || [];
            this.auctionListings = res.auctions || [];
            this.userAuctionListings = res.userAuctions || [];
            this.soldMarketListings = res.soldListings || [];
            this.emit("gpBalance", this.gpBalance);
            this.emit("socialGpRewardClaims", this.socialGpRewardClaims);
            this.emit("market", this.marketListings, this.userMarketListings);
            if (this.soldMarketListings.length > 0) {
                this.emit("soldMarketListings", this.soldMarketListings);
            }
            if (res.expiredItemTypes?.length) {
                this.emit("expiredMarketListings", res.expiredItemTypes);
                this.loadProfile();
            }
            callback?.(true);
        });
    }

    claimSocialGpReward(
        rewardKey: SocialGpRewardKey,
        callback?: (error?: ClaimSocialGpRewardResponse["error"]) => void,
    ) {
        const args: ClaimSocialGpRewardRequest = { rewardKey };
        this.ajaxRequest(
            "/api/user/claim_social_gp_reward",
            args,
            (err, res: ClaimSocialGpRewardResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric(
                        "account",
                        "claim_social_gp_reward_error",
                    );
                    if (res?.socialGpRewardClaims) {
                        this.socialGpRewardClaims = res.socialGpRewardClaims;
                        this.socialGpRewardClaimsLoaded = true;
                        this.emit("socialGpRewardClaims", this.socialGpRewardClaims);
                    }
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.socialGpRewardClaims = res.socialGpRewardClaims || {
                    ...this.socialGpRewardClaims,
                    [rewardKey]: true,
                };
                this.socialGpRewardClaimsLoaded = true;
                this.emit("socialGpRewardClaims", this.socialGpRewardClaims);
                callback?.();
            },
        );
    }

    buyFeaturedBundle(bundleId: string, callback?: (error?: string) => void) {
        const args: BuyFeaturedBundleRequest = { bundleId };
        this.ajaxRequest(
            "/api/user/buy_featured_bundle",
            args,
            (err, res: BuyFeaturedBundleResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "buy_featured_bundle_error");
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.emit("newItemsAwarded");
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    openLootBox(
        boxId: string,
        callback?: (error?: string, reward?: { itemType: string }) => void,
    ) {
        const args: OpenLootBoxRequest = { boxId };
        this.ajaxRequest(
            "/api/user/open_loot_box",
            args,
            (err, res: OpenLootBoxResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "open_loot_box_error");
                    const errorCode =
                        !err && res && "error" in res ? res.error : "server_error";
                    callback?.(errorCode);
                    return;
                }

                this.gpBalance = res.gpBalance;
                this.emit("gpBalance", this.gpBalance);
                this.loadProfile();
                this.loadMarket();
                callback?.(undefined, { itemType: res.itemType });
            },
        );
    }

    createMarketListing(
        itemId: string,
        price: number,
        callback?: (error?: string) => void,
    ) {
        const args: CreateMarketListingRequest = { itemId, price };
        this.ajaxRequest(
            "/api/user/create_market_listing",
            args,
            (err, res: CreateMarketListingResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric(
                        "account",
                        "create_market_listing_error",
                    );
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.emit("newItemsAwarded");
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    createAuctionListing(
        itemId: string,
        startPrice: number,
        callback?: (error?: string) => void,
    ) {
        const args: CreateAuctionListingRequest = { itemId, startPrice };
        this.ajaxRequest(
            "/api/user/create_auction_listing",
            args,
            (err, res: CreateAuctionListingResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric(
                        "account",
                        "create_auction_listing_error",
                    );
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    buyMarketListing(listingId: string, callback?: (error?: string) => void) {
        const args: BuyMarketListingRequest = { listingId };
        this.ajaxRequest(
            "/api/user/buy_market_listing",
            args,
            (err, res: BuyMarketListingResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "buy_market_listing_error");
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    cancelMarketListing(listingId: string, callback?: (error?: string) => void) {
        const args: CancelMarketListingRequest = { listingId };
        this.ajaxRequest(
            "/api/user/cancel_market_listing",
            args,
            (err, res: CancelMarketListingResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric(
                        "account",
                        "cancel_market_listing_error",
                    );
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    placeAuctionBid(
        auctionId: string,
        amount: number,
        callback?: (error?: string) => void,
    ) {
        const args: PlaceAuctionBidRequest = { auctionId, amount };
        this.ajaxRequest(
            "/api/user/place_auction_bid",
            args,
            (err, res: PlaceAuctionBidResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric("account", "place_auction_bid_error");
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.loadMarket();
                callback?.();
            },
        );
    }

    cancelAuctionListing(auctionId: string, callback?: (error?: string) => void) {
        const args: CancelAuctionListingRequest = { auctionId };
        this.ajaxRequest(
            "/api/user/cancel_auction_listing",
            args,
            (err, res: CancelAuctionListingResponse) => {
                if (err || !res.success) {
                    errorLogManager.storeGeneric(
                        "account",
                        "cancel_auction_listing_error",
                    );
                    callback?.(res?.error || "server_error");
                    return;
                }

                if (typeof res.gpBalance === "number") {
                    this.gpBalance = res.gpBalance;
                    this.emit("gpBalance", this.gpBalance);
                }
                this.loadProfile();
                this.loadMarket();
                callback?.();
            },
        );
    }

    ackSoldMarketListings(listingIds: string[], callback?: (success: boolean) => void) {
        const args: AckSoldMarketListingsRequest = { listingIds };
        this.ajaxRequest(
            "/api/user/ack_sold_market_listings",
            args,
            (err, res: AckSoldMarketListingsResponse) => {
                callback?.(!err && !!res?.success);
            },
        );
    }
}
