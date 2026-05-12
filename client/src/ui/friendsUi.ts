import $ from "jquery";
import type { FriendUser } from "../../../shared/types/user";
import type { Account } from "../account";
import { helpers } from "../helpers";
import type { ProfileUi } from "./profileUi";

type FriendsTab = "friends" | "add" | "requests";
type FriendRowMode = "friend" | "search" | "incoming" | "outgoing";
type FriendAction = "remove" | "send_gp" | "confirm_send_gp" | "close";

export class FriendsUi {
    private readonly pollIntervalMs = 4000;
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
    } | null = null;

    constructor(
        public account: Account,
        public profileUi: ProfileUi,
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

        if (tab === "requests") {
            this.markRequestsSeen();
        }
    }

    private render() {
        this.renderHeader();
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
        this.pollTimer = window.setInterval(
            () => this.pollFriends(),
            this.pollIntervalMs,
        );
    }

    private pollFriends() {
        if (!this.account.loggedIn || this.pollInFlight) {
            return;
        }

        this.pollInFlight = true;
        this.account.loadFriends(() => {
            this.pollInFlight = false;
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

        for (const friend of this.account.friends) {
            list.append(this.createUserRow(friend, "friend"));
        }
    }

    private renderRequests() {
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
        kind: "add" | "accept" | "decline" | "profile" | "gp" | "remove",
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
        $("#friend-action-confirm").text("Yes");
    }

    private hideActionModal() {
        this.pendingAction = null;
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
        }
    }
}
