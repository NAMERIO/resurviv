import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { FriendUser } from "../../../shared/types/user";
import { getMarketPriceBounds } from "../../../shared/utils/marketPricing";
import type { Account } from "../account";
import { helpers } from "../helpers";
import type { ProfileUi } from "./profileUi";

type FriendsTab = "friends" | "add" | "requests";
type FriendRowMode = "friend" | "search" | "incoming" | "outgoing";
type GiftCategory = "outfit" | "melee" | "emote" | "death_effect";
type FriendAction =
    | "remove"
    | "send_gp"
    | "confirm_send_gp"
    | "send_skins"
    | "confirm_send_skins"
    | "close";

export class FriendsUi {
    private readonly openPollIntervalMs = 4000;
    private readonly backgroundPollIntervalMs = 60000;
    private pollTimer = 0;
    private pollInFlight = false;
    private searchTimer = 0;
    private searchRequestId = 0;
    private searchResults: FriendUser[] = [];
    private searchState: "idle" | "loading" | "empty" | "error" = "idle";
    private activeTab: FriendsTab = "friends";
    private statusText = "";
    private seenIncomingRequestIds = new Set<string>();
    private pendingAction: {
        action: FriendAction;
        user: FriendUser;
        amount?: number;
        itemIds?: string[];
    } | null = null;
    private selectedSkinGiftItemIds = new Set<string>();
    private activeGiftCategory: GiftCategory = "outfit";
    private readonly giftCategories: Array<{
        type: GiftCategory;
        label: string;
        icon: string;
    }> = [
        { type: "outfit", label: "Skins", icon: "img/gui/loadout-outfit.svg" },
        { type: "melee", label: "Melee", icon: "img/gui/loadout-melee.svg" },
        { type: "emote", label: "Emotes", icon: "img/gui/loadout-emote.svg" },
        {
            type: "death_effect",
            label: "Death",
            icon: "img/gui/item-deathEffect-style.svg",
        },
    ];

    constructor(
        public account: Account,
        public profileUi: ProfileUi,
        private readonly isHomeScreenActive: () => boolean = () => true,
    ) {
        account.addEventListener("friends", () => this.onFriendsUpdated());
        account.addEventListener("login", () => this.startPolling());
        account.addEventListener("loadout", () => this.renderHeader());
        account.addEventListener("request", () => this.renderHeader());
        this.initUi();
        this.startPolling();
        this.render();
    }

    private initUi() {
        $("#btn-friends").on("click", () => {
            if (!this.account.loggedIn) {
                this.profileUi.showLoginMenu({ modal: true });
                return false;
            }

            this.show();
            return false;
        });

        $("#friends-close").on("click", () => {
            this.hide();
            return false;
        });

        $("#friends-wrapper").on("click touchend", (e) => {
            if ($(e.target).closest("#friends-panel").length === 0) {
                this.hide();
                return false;
            }
        });

        $(".friends-tab").on("click", (e) => {
            const tab = $(e.currentTarget).data("tab") as FriendsTab;
            this.setTab(tab);
            return false;
        });

        $("#friends-search-input").on("input", () => {
            window.clearTimeout(this.searchTimer);
            this.searchTimer = window.setTimeout(() => this.search(), 180);
        });

        $("#friends-search-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                window.clearTimeout(this.searchTimer);
                this.search();
            }
        });

        $("#friends-list-search-input").on("input", () => {
            this.renderFriends();
        });

        $(".friend-action-cancel").on("click", () => {
            this.hideActionModal();
            return false;
        });

        $("#friend-action-modal").on("click touchend", (e) => {
            if ($(e.target).closest(".friend-action-content").length === 0) {
                this.hideActionModal();
                return false;
            }
        });

        $("#friend-action-confirm").on("click", () => {
            this.confirmPendingAction();
            return false;
        });

        $("#friend-gp-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                this.confirmPendingAction();
                return false;
            }
        });
    }

    show() {
        $("#news-wrapper").fadeOut(150);
        $("#friends-wrapper").addClass("open");
        this.account.loadFriends((success) => {
            if (success && this.activeTab === "requests") {
                this.markRequestsSeen();
            }
        });
        this.render();
    }

    hide() {
        $("#friends-wrapper").removeClass("open");
        this.resetSearch();
    }

    private setTab(tab: FriendsTab) {
        this.activeTab = tab;
        $(".friends-tab").removeClass("active");
        $(`.friends-tab[data-tab="${tab}"]`).addClass("active");
        $(".friends-tab-panel").removeClass("active");
        $(`#friends-tab-${tab}`).addClass("active");

        if (tab === "add") {
            window.setTimeout(() => $("#friends-search-input").trigger("focus"), 80);
        }

        if (tab === "friends") {
            window.setTimeout(() => $("#friends-list-search-input").trigger("focus"), 80);
        }

        if (tab === "requests") {
            this.markRequestsSeen();
        }
    }

    private render() {
        this.renderHeader();
        this.renderFriendCount();
        this.renderTabs();
        this.renderFriends();
        this.renderSearchResults();
        this.renderRequests();
    }

    private renderTabs() {
        $(".friends-tab").removeClass("active");
        $(`.friends-tab[data-tab="${this.activeTab}"]`).addClass("active");
        $(".friends-tab-panel").removeClass("active");
        $(`#friends-tab-${this.activeTab}`).addClass("active");
        $(".friends-tab-requests, .friends-btn-container").toggleClass(
            "has-friend-request-alert",
            this.hasUnreadIncomingRequests(),
        );
    }

    private renderFriendCount() {
        const count = this.account.loggedIn ? this.account.friends.length : 0;
        const header = $(".friends-list-header-friends");

        header.empty().append(document.createTextNode("FRIENDS"));
        if (this.account.loggedIn) {
            header.append($("<span/>", { class: "friends-list-count", text: count }));
        }
    }

    private renderHeader() {
        const icon =
            helpers.getSvgFromGameType(this.account.loadout.player_icon) ||
            helpers.getSvgFromGameType("emote_surviv") ||
            "img/gui/player-gui.svg";
        const name = this.account.loggedIn
            ? this.account.profile.username || this.account.profile.slug
            : "Log in";
        const slug = this.account.loggedIn ? this.account.profile.slug : "";

        $("#friends-profile-icon").css("background-image", `url(${icon})`);
        $("#friends-panel-title").text(slug ? `@${slug}` : name);
    }

    private startPolling() {
        if (this.pollTimer || !this.account.loggedIn) {
            return;
        }

        this.pollFriends();
        this.scheduleNextPoll();
    }

    private scheduleNextPoll() {
        window.clearTimeout(this.pollTimer);
        if (!this.account.loggedIn) {
            this.pollTimer = 0;
            return;
        }

        const delay = this.isOpen()
            ? this.openPollIntervalMs
            : this.backgroundPollIntervalMs;
        this.pollTimer = window.setTimeout(() => this.pollFriends(), delay);
    }

    private pollFriends() {
        if (
            !this.account.loggedIn ||
            this.pollInFlight ||
            (!this.isOpen() && !this.isHomeScreenActive())
        ) {
            this.scheduleNextPoll();
            return;
        }

        this.pollInFlight = true;
        this.account.loadFriends(() => {
            this.pollInFlight = false;
            this.scheduleNextPoll();
        }, true);
    }

    private onFriendsUpdated() {
        if (this.isOpen() && this.activeTab === "requests") {
            this.markRequestsSeen();
            return;
        }

        this.render();
    }

    private isOpen() {
        return $("#friends-wrapper").hasClass("open");
    }

    private markRequestsSeen() {
        for (const request of this.account.incomingFriendRequests) {
            this.seenIncomingRequestIds.add(request.userId);
        }
        this.render();
    }

    private hasUnreadIncomingRequests() {
        return this.account.incomingFriendRequests.some(
            (request) => !this.seenIncomingRequestIds.has(request.userId),
        );
    }

    private renderFriends() {
        const list = $("#friends-list");
        list.empty();

        if (!this.account.loggedIn) {
            list.append(
                $("<div/>", { class: "friends-empty", text: "Log in to see friends." }),
            );
            return;
        }

        if (this.account.friends.length === 0) {
            list.append($("<div/>", { class: "friends-empty", text: "No friends yet." }));
            return;
        }

        const query = String($("#friends-list-search-input").val() || "")
            .trim()
            .toLowerCase();
        const friends = query
            ? this.account.friends.filter((friend) =>
                  this.friendMatchesQuery(friend, query),
              )
            : this.account.friends;

        if (friends.length === 0) {
            list.append(
                $("<div/>", { class: "friends-empty", text: "No friends found." }),
            );
            return;
        }

        for (const friend of friends) {
            list.append(this.createUserRow(friend, "friend"));
        }
    }

    private friendMatchesQuery(friend: FriendUser, query: string) {
        return (
            (friend.username || "").toLowerCase().includes(query) ||
            friend.slug.toLowerCase().includes(query)
        );
    }

    private renderRequests() {
        this.renderRequestHeader(
            $(".friends-list-header-incoming"),
            "INCOMING REQUEST",
            this.account.incomingFriendRequests.length,
        );
        this.renderRequestHeader(
            $(".friends-list-header-pending"),
            "PENDING REQUEST",
            this.account.outgoingFriendRequests.length,
        );
        this.renderRequestList(
            $("#friends-incoming-requests"),
            this.account.incomingFriendRequests,
            "incoming",
            "No incoming requests.",
        );
        this.renderRequestList(
            $("#friends-outgoing-requests"),
            this.account.outgoingFriendRequests,
            "outgoing",
            "No sent requests.",
        );
    }

    private renderRequestHeader(
        header: JQuery<HTMLElement>,
        label: string,
        count: number,
    ) {
        header.empty().append(document.createTextNode(label));
        if (this.account.loggedIn) {
            header.append($("<span/>", { class: "friends-list-count", text: count }));
        }
    }

    private renderRequestList(
        list: JQuery<HTMLElement>,
        requests: FriendUser[],
        mode: "incoming" | "outgoing",
        emptyText: string,
    ) {
        list.empty();
        if (requests.length === 0) {
            list.append($("<div/>", { class: "friends-empty", text: emptyText }));
            return;
        }

        for (const request of requests) {
            list.append(this.createUserRow(request, mode));
        }
    }

    private search() {
        const query = String($("#friends-search-input").val() || "").trim();
        const requestId = ++this.searchRequestId;
        this.statusText = "";

        if (query.length < 2) {
            this.searchResults = [];
            this.searchState = "idle";
            this.renderSearchResults();
            return;
        }

        this.searchState = "loading";
        this.renderSearchResults();

        this.account.searchFriends(query, (success, results) => {
            if (requestId !== this.searchRequestId) {
                return;
            }

            this.searchResults = results;
            this.searchState = success ? (results.length ? "idle" : "empty") : "error";
            this.renderSearchResults();
        });
    }

    private renderSearchResults() {
        const list = $("#friends-search-results");
        list.empty();

        if (this.statusText) {
            list.append($("<div/>", { class: "friends-status", text: this.statusText }));
        }

        switch (this.searchState) {
            case "loading":
                list.append(
                    $("<div/>", { class: "friends-empty", text: "Searching..." }),
                );
                return;
            case "empty":
                list.append(
                    $("<div/>", { class: "friends-empty", text: "No players found." }),
                );
                return;
            case "error":
                list.append(
                    $("<div/>", { class: "friends-empty", text: "Search failed." }),
                );
                return;
            default:
                break;
        }

        if (this.searchResults.length === 0) {
            list.append(
                $("<div/>", {
                    class: "friends-empty",
                    text: "Type at least 2 characters to search.",
                }),
            );
            return;
        }

        for (const result of this.searchResults) {
            list.append(this.createUserRow(result, "search"));
        }
    }

    private resetSearch() {
        window.clearTimeout(this.searchTimer);
        this.searchRequestId++;
        this.searchResults = [];
        this.searchState = "idle";
        this.statusText = "";
        $("#friends-search-input").val("");
        this.renderSearchResults();
    }

    private createUserRow(user: FriendUser, mode: FriendRowMode) {
        const icon =
            helpers.getSvgFromGameType(user.playerIcon) ||
            helpers.getSvgFromGameType("emote_surviv") ||
            "img/gui/player-gui.svg";
        const row = $("<div/>", { class: "friends-user-row" });
        row.append(
            $("<div/>", {
                class: "friends-user-icon",
                css: { "background-image": `url(${icon})` },
            }),
        );

        const text = $("<div/>", { class: "friends-user-text" });
        text.append(
            $("<div/>", { class: "friends-user-name", text: user.username || user.slug }),
        );
        text.append($("<div/>", { class: "friends-user-slug", text: `@${user.slug}` }));
        row.append(text);
        this.appendActions(row, user, mode);

        return row;
    }

    private appendActions(
        row: JQuery<HTMLElement>,
        user: FriendUser,
        mode: FriendRowMode,
    ) {
        if (mode === "search") {
            this.appendSearchAction(row, user);
            return;
        }

        if (mode === "incoming") {
            row.append(
                this.createIconButton("accept", "Accept request", () => {
                    this.account.acceptFriendRequest(user.userId, () => {
                        this.statusText = "";
                    });
                }),
                this.createIconButton("decline", "Decline request", () => {
                    this.account.declineFriendRequest(user.userId);
                }),
            );
            return;
        }

        if (mode === "outgoing") {
            row.append(
                $("<div/>", { class: "friends-row-state", text: "Sent" }),
                this.createIconButton("decline", "Cancel request", () => {
                    this.account.cancelFriendRequest(user.userId);
                }),
            );
            return;
        }

        if (mode === "friend") {
            row.append(
                this.createIconButton("profile", "View stats", () => {
                    window.open(
                        `/stats/?slug=${encodeURIComponent(user.slug)}`,
                        "_blank",
                    );
                }),
                this.createIconButton("gp", "Send GP", () => {
                    this.showSendGpModal(user);
                }),
                this.createIconButton("skin", "Gift cosmetics", () => {
                    this.showSendSkinsModal(user);
                }),
                this.createIconButton("remove", "Remove friend", () => {
                    this.showRemoveFriendModal(user);
                }),
            );
        }
    }

    private appendSearchAction(row: JQuery<HTMLElement>, user: FriendUser) {
        const stateText = {
            friends: "Friend",
            outgoing: "Sent",
            incoming: "Incoming",
            none: "",
        }[user.relationStatus];

        if (user.relationStatus !== "none") {
            row.append($("<div/>", { class: "friends-row-state", text: stateText }));
            return;
        }

        row.append(
            this.createIconButton("add", "Send friend request", () => {
                this.account.addFriend(user.userId, (error, request) => {
                    if (error) {
                        this.statusText =
                            error === "already_requested"
                                ? "Friend request already exists."
                                : "Could not send request.";
                    } else {
                        user.relationStatus = "outgoing";
                        this.statusText = request
                            ? `Request sent to ${request.username || request.slug}.`
                            : "Request sent.";
                    }
                    this.renderSearchResults();
                    this.renderRequests();
                });
            }),
        );
    }

    private createIconButton(
        kind: "add" | "accept" | "decline" | "profile" | "gp" | "skin" | "remove",
        title: string,
        onClick: () => void,
    ) {
        return $("<button/>", {
            class: `friends-action-button friends-action-${kind}`,
            type: "button",
            title,
        }).on("click", () => {
            onClick();
            return false;
        });
    }

    private showRemoveFriendModal(user: FriendUser) {
        this.pendingAction = { action: "remove", user };
        $("#friend-action-title").text("Remove Friend");
        $("#friend-action-text").text(
            `Are you sure you want to remove ${user.username || user.slug}?`,
        );
        $("#friend-gp-input").hide().val("");
        $("#friend-skin-list").hide().empty();
        $("#friend-action-confirm").text("Yes");
        $("#friend-action-modal").fadeIn(120);
    }

    private showSendGpModal(user: FriendUser) {
        this.pendingAction = { action: "send_gp", user };
        $("#friend-action-title").text("Send GP");
        $("#friend-action-text").text(
            `How much GP do you want to send to @${user.slug}?`,
        );
        $("#friend-gp-input").show().val("").trigger("focus");
        $("#friend-skin-list").hide().empty();
        $("#friend-action-confirm").text("Enter");
        $("#friend-action-modal").fadeIn(120);
    }

    private showConfirmSendGpModal(user: FriendUser, amount: number) {
        this.pendingAction = { action: "confirm_send_gp", user, amount };
        $("#friend-action-title").text("Confirm GP");
        $("#friend-action-text").text(
            `Are you sure you want to send ${amount} GP to @${user.slug}?`,
        );
        $("#friend-gp-input").hide();
        $("#friend-skin-list").hide().empty();
        $("#friend-action-confirm").text("Yes");
    }

    private showSendSkinsModal(user: FriendUser) {
        this.pendingAction = { action: "send_skins", user };
        this.selectedSkinGiftItemIds.clear();
        this.activeGiftCategory = "outfit";
        $("#friend-action-title").text("Gift Items");
        $("#friend-action-text").text(
            `Select market-sellable cosmetics to send to @${user.slug}.`,
        );
        $("#friend-gp-input").hide().val("");
        $("#friend-action-confirm").text("Send");
        this.renderSkinGiftList();
        $("#friend-skin-list").show();
        $("#friend-action-modal").fadeIn(120);
    }

    private showConfirmSendSkinsModal(user: FriendUser, itemIds: string[]) {
        this.pendingAction = { action: "confirm_send_skins", user, itemIds };
        $("#friend-action-title").text("Confirm Gift");
        $("#friend-action-text").text(
            `Send ${itemIds.length} item${itemIds.length === 1 ? "" : "s"} to @${
                user.slug
            }?`,
        );
        $("#friend-gp-input").hide();
        $("#friend-skin-list").hide();
        $("#friend-action-confirm").text("Yes");
    }

    private renderSkinGiftList() {
        const list = $("#friend-skin-list");
        list.empty();
        list.append(this.createGiftCategoryTabs());

        const giftableItems = this.account.items
            .filter((item) => {
                const def = GameObjectDefs[item.type];
                return (
                    item.id &&
                    def?.type === this.activeGiftCategory &&
                    getMarketPriceBounds(item.type) !== null
                );
            })
            .sort((a, b) => {
                const defA = GameObjectDefs[a.type] as { name?: string } | undefined;
                const defB = GameObjectDefs[b.type] as { name?: string } | undefined;
                return (defA?.name || a.type).localeCompare(defB?.name || b.type);
            });

        if (giftableItems.length === 0) {
            list.append(
                $("<div/>", {
                    class: "friend-skin-empty",
                    text: `No giftable ${this.getGiftCategoryLabel().toLowerCase()}.`,
                }),
            );
            return;
        }

        for (const item of giftableItems) {
            const def = GameObjectDefs[item.type] as
                | { name?: string; rarity?: number }
                | undefined;
            const icon = helpers.getSvgFromGameType(item.type);
            const selected = this.selectedSkinGiftItemIds.has(item.id!);
            const row = $("<button/>", {
                class: `friend-skin-row${selected ? " selected" : ""}`,
                type: "button",
                title: def?.name || item.type,
            });

            row.append(
                $("<div/>", {
                    class: "friend-skin-icon",
                    css: { "background-image": `url(${icon})` },
                }),
                $("<div/>", {
                    class: "friend-skin-name",
                    text: def?.name || item.type,
                }),
            );
            row.on("click", () => {
                if (this.selectedSkinGiftItemIds.has(item.id!)) {
                    this.selectedSkinGiftItemIds.delete(item.id!);
                } else {
                    this.selectedSkinGiftItemIds.add(item.id!);
                }
                this.renderSkinGiftList();
                return false;
            });
            list.append(row);
        }
    }

    private createGiftCategoryTabs() {
        const tabs = $("<div/>", { class: "friend-gift-tabs" });
        for (const category of this.giftCategories) {
            const button = $("<button/>", {
                class: `friend-gift-tab${
                    this.activeGiftCategory === category.type ? " active" : ""
                }`,
                type: "button",
                title: category.label,
            });
            button.append(
                $("<div/>", {
                    class: "friend-gift-tab-icon",
                    css: { "background-image": `url(${category.icon})` },
                }),
                $("<div/>", { class: "friend-gift-tab-label", text: category.label }),
            );
            button.on("click", () => {
                this.activeGiftCategory = category.type;
                this.renderSkinGiftList();
                return false;
            });
            tabs.append(button);
        }

        return tabs;
    }

    private getGiftCategoryLabel() {
        return (
            this.giftCategories.find(
                (category) => category.type === this.activeGiftCategory,
            )?.label || "items"
        );
    }

    private hideActionModal() {
        this.pendingAction = null;
        this.selectedSkinGiftItemIds.clear();
        $("#friend-skin-list").hide().empty();
        $("#friend-action-modal").fadeOut(120);
    }

    private confirmPendingAction() {
        const pending = this.pendingAction;
        if (!pending) {
            return;
        }

        if (pending.action === "remove") {
            this.account.removeFriend(pending.user.userId, () => {
                this.hideActionModal();
            });
            return;
        }

        if (pending.action === "close") {
            this.hideActionModal();
            return;
        }

        if (pending.action === "send_gp") {
            const amount = Math.floor(Number($("#friend-gp-input").val()));
            if (!Number.isFinite(amount) || amount <= 0) {
                $("#friend-action-text").text("Enter a valid GP amount.");
                return;
            }
            this.showConfirmSendGpModal(pending.user, amount);
            return;
        }

        if (pending.action === "send_skins") {
            const itemIds = [...this.selectedSkinGiftItemIds];
            if (itemIds.length === 0) {
                $("#friend-action-text").text("Select at least one item.");
                return;
            }
            this.showConfirmSendSkinsModal(pending.user, itemIds);
            return;
        }

        if (pending.action === "confirm_send_gp") {
            this.account.sendFriendGp(
                pending.user.userId,
                pending.amount || 0,
                (error) => {
                    if (error) {
                        const message =
                            error === "not_enough_gp"
                                ? "You do not have enough GP."
                                : "Could not send GP.";
                        $("#friend-action-title").text("Send GP Failed");
                        $("#friend-action-text").text(message);
                        $("#friend-action-confirm").text("Close");
                        this.pendingAction = { ...pending, action: "close" };
                        return;
                    }

                    this.hideActionModal();
                },
            );
            return;
        }

        if (pending.action === "confirm_send_skins") {
            this.account.sendFriendSkins(
                pending.user.userId,
                pending.itemIds || [],
                (error) => {
                    if (error) {
                        const message =
                            error === "item_not_owned"
                                ? "You do not own one of those items anymore."
                                : error === "invalid_item"
                                  ? "Only market-sellable cosmetics can be gifted."
                                  : "Could not send items.";
                        $("#friend-action-title").text("Gift Failed");
                        $("#friend-action-text").text(message);
                        $("#friend-skin-list").hide();
                        $("#friend-action-confirm").text("Close");
                        this.pendingAction = { ...pending, action: "close" };
                        return;
                    }

                    this.hideActionModal();
                },
            );
        }
    }
}
