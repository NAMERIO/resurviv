import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { EmoteDef } from "../../../shared/defs/gameObjects/emoteDefs";
import { UnlockDefs } from "../../../shared/defs/gameObjects/unlockDefs";
import {
    ClanConstants,
    type ClanDetail,
    type ClanInfo,
    type ClanLeaderboardEntry,
    type ClanLeaderboardResponse,
    type ClanMember,
    type ClanMessage,
    type CreateClanResponse,
    type DeleteClanMessageResponse,
    type EditClanMessageResponse,
    type GetClanMessagesResponse,
    type GetMyClanResponse,
    type JoinClanResponse,
    type ListClansResponse,
    type ResolveKlipyGifResponse,
    type SearchKlipyGifsResponse,
    type SendClanMessageResponse,
    type UpdateClanResponse,
} from "../../../shared/types/clan";
import {
    GameModeStatus,
    type GameModeStatus as GameModeStatusType,
} from "../../../shared/types/stats";
import type { Account } from "../account";
import { api } from "../api";
import type { Localization } from "./localization";
import { MenuModal } from "./menuModal";

function clanRequest<T>(
    url: string,
    data: Record<string, unknown> | null,
    callback: (err: any, res?: T) => void,
) {
    const opts: JQueryAjaxSettings = {
        url: api.resolveUrl(url),
        type: data ? "POST" : "GET",
        timeout: 10 * 1000,
        xhrFields: {
            withCredentials: true,
        },
        headers: {
            "X-Requested-With": "XMLHttpRequest",
        },
    };
    if (data) {
        opts.contentType = "application/json; charset=utf-8";
        opts.data = JSON.stringify(data);
    }
    $.ajax(opts)
        .done((res) => callback(null, res))
        .fail((err) => callback(err));
}

function getClanIconUrl(iconType: string): string {
    const def = GameObjectDefs[iconType] as EmoteDef | undefined;
    if (def && def.type === "emote" && def.texture) {
        return `img/emotes/${def.texture.slice(0, -4)}.svg`;
    }
    return "img/gui/player-gui.svg";
}

function formatTimeRemaining(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatChatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
        ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

type ClanChatGifPreview = Extract<ResolveKlipyGifResponse, { success: true }>["gif"];
type ClanChatGifPickerItem = Extract<SearchKlipyGifsResponse, { success: true }>["gifs"][number];
const blankGifSrc =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function findKlipyUrl(message: string): string | null {
    const match = message.match(/https?:\/\/(?:[a-z0-9-]+\.)?klipy\.com\/\S+/i);
    if (!match) return null;

    try {
        const url = new URL(match[0]);
        const hostname = url.hostname.toLowerCase();
        if (hostname !== "klipy.com" && !hostname.endsWith(".klipy.com")) {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

function isOnlyKlipyUrl(message: string) {
    return /^https?:\/\/(?:[a-z0-9-]+\.)?klipy\.com\/\S+$/i.test(message.trim());
}

function normalizeColorInputValue(color?: string | null) {
    const value = (color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        return value;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return "#ffffff";
}

function normalizeMentionValue(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class ClanUi {
    mainModal: MenuModal;
    iconModal: MenuModal;
    clanPageModal: MenuModal;
    leaderboardModal: MenuModal;

    currentClan: ClanDetail | null = null;
    viewingClan: ClanDetail | null = null;
    cooldownUntil: number | null = null;
    availableIcons: string[] = [];
    selectedIcon: string = "emote_surviv";
    isEditingIcon: boolean = false;
    clanMessages: ClanMessage[] = [];
    clanMessagesHasMore = false;
    clanMessagesLoading = false;
    clanMessagesPolling = false;
    clanMessagesPollTimer: ReturnType<typeof setTimeout> | null = null;
    clanMessageLongPressTimer: ReturnType<typeof setTimeout> | null = null;
    clanMentionPollTimer: ReturnType<typeof setTimeout> | null = null;
    clanMentionPolling = false;
    mentionSuggestionsMenu: JQuery<HTMLElement> | null = null;
    unreadMentionCount = 0;
    replyingToMessage: ClanMessage | null = null;
    editingMessage: ClanMessage | null = null;
    messageActionsMenu: JQuery<HTMLElement> | null = null;
    gifPreviewCache = new Map<string, ClanChatGifPreview | null>();
    gifPreviewPending = new Set<string>();
    gifPickerSearchTimer: ReturnType<typeof setTimeout> | null = null;
    gifPickerSection = "";
    gifPickerLoading = false;
    gifImageObserver: IntersectionObserver | null = null;
    observedGifImages = new Set<HTMLImageElement>();
    gifStillFrameCache = new Map<string, string | null>();

    constructor(
        public account: Account,
        public localization: Localization,
        private readonly isHomeScreenActive: () => boolean = () => true,
    ) {
        this.mainModal = new MenuModal($("#modal-clan-main"));
        this.iconModal = new MenuModal($("#modal-clan-icons"));
        this.clanPageModal = new MenuModal($("#modal-clan-page"));
        this.leaderboardModal = new MenuModal($("#modal-clan-leaderboard"));
        this.clanPageModal.onHide(() => {
            this.stopClanMessagePolling();
        });

        this.initUi();
        this.loadAvailableIcons();
        this.account.addEventListener("login", () => {
            this.loadMyClan();
        });
        if (this.account.loggedIn) {
            this.loadMyClan();
        }
    }

    initUi() {
        $("#btn-clan-create-submit").on("click", () => {
            this.createClan();
        });

        $("#clan-create-name-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                this.createClan();
            }
        });
        $("#btn-clan-icon-edit").on("click", () => {
            this.isEditingIcon = false;
            this.showIconSelector();
        });
        $("#btn-clan-icon-reset").on("click", () => {
            this.selectIcon("emote_surviv");
        });
        $(".btn-clan-icons-close").on("click", () => {
            this.iconModal.hide();
        });
        $("#btn-clan-icon-confirm").on("click", () => {
            if (this.isEditingIcon && this.viewingClan) {
                this.updateClan({ icon: this.selectedIcon });
            }
            this.iconModal.hide();
        });
        $("#clan-icon-selector").on("click", ".clan-icon-option", (e) => {
            const icon = $(e.currentTarget).data("icon") as string;
            this.selectIcon(icon);
        });
        $("#btn-clan-edit-icon").on("click", () => {
            if (this.viewingClan) {
                this.isEditingIcon = true;
                this.selectedIcon = this.viewingClan.icon;
                this.showIconSelector();
            }
        });
        $("#btn-clan-edit-name").on("click", () => {
            if (this.viewingClan) {
                $("#clan-detail-name").hide();
                $("#btn-clan-edit-name").hide();
                $("#clan-detail-name-edit").show();
                $("#clan-edit-name-input").val(this.viewingClan.name).focus();
            }
        });
        $("#btn-clan-save-name").on("click", () => {
            const newName = ($("#clan-edit-name-input").val() as string).trim();
            if (newName && this.viewingClan && newName !== this.viewingClan.name) {
                this.updateClan({ name: newName });
            } else {
                this.cancelNameEdit();
            }
        });
        $("#clan-tag-color-input").on("change", () => {
            const tagColor = ($("#clan-tag-color-input").val() as string) || "";
            this.updateClan({ tagColor });
        });
        $("#btn-clan-cancel-name").on("click", () => {
            this.cancelNameEdit();
        });
        $("#clan-edit-name-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                $("#btn-clan-save-name").trigger("click");
            }
        });
        $("#btn-clan-leave").on("click", () => {
            if (confirm("Are you sure you want to leave this clan?")) {
                this.leaveClan();
            }
        });
        $("#btn-clan-delete").on("click", () => {
            if (
                confirm(
                    "Are you sure you want to delete this clan? This action cannot be undone.",
                )
            ) {
                this.deleteClan();
            }
        });
        $("#btn-clan-my-clan").on("click", () => {
            if (this.currentClan) {
                this.mainModal.hide();
                this.showClanPage(this.currentClan.id);
            }
        });
        $("#btn-clan-view-details").on("click", () => {
            if (this.currentClan) {
                this.mainModal.hide();
                this.showClanPage(this.currentClan.id);
            }
        });
        $("#btn-clan-leave-main").on("click", () => {
            if (confirm("Are you sure you want to leave this clan?")) {
                this.leaveClan();
            }
        });
        $("#btn-clan-delete-main").on("click", () => {
            if (
                confirm(
                    "Are you sure you want to delete this clan? This action cannot be undone.",
                )
            ) {
                this.deleteClan();
            }
        });
        $("#btn-clan-leaderboard").on("click", () => {
            this.mainModal.hide();
            this.showLeaderboard();
        });
        $("#btn-clan-back-to-hub, #btn-leaderboard-back").on("click", () => {
            this.clanPageModal.hide();
            this.leaderboardModal.hide();
            this.showMainModal();
        });
        $("#btn-clan-search").on("click", () => {
            this.loadClanList(1);
        });

        $("#clan-search-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                this.loadClanList(1);
            }
        });
        $(".clan-leaderboard-tab").on("click", (e) => {
            const type = $(e.currentTarget).data("type") as "kills" | "wins";
            $(".clan-leaderboard-tab").removeClass("active");
            $(e.currentTarget).addClass("active");
            this.loadLeaderboard(type);
        });
        $("#clan-leaderboard-game-mode").on("change", () => {
            this.loadLeaderboard(this.getSelectedLeaderboardType());
        });
        $("#btn-clan-chat-send").on("click", () => {
            this.sendClanMessage();
        });
        $("#btn-clan-chat-gif").on("click", (e) => {
            e.stopPropagation();
            this.toggleGifPicker();
        });
        $("#clan-chat-gif-picker").on("click", (e) => {
            e.stopPropagation();
        });
        $("#clan-chat-gif-search").on("input", () => {
            this.scheduleGifPickerSearch();
        });
        $("#clan-chat-gif-search").on("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.loadGifPickerResults();
            }
        });
        $("#clan-chat-gif-sections").on("click", ".clan-chat-gif-section", (e) => {
            const section = ($(e.currentTarget).data("section") as string) || "";
            this.gifPickerSection = section;
            $("#clan-chat-gif-search").val("");
            $(".clan-chat-gif-section").removeClass("active");
            $(e.currentTarget).addClass("active");
            this.loadGifPickerResults();
        });
        $("#clan-chat-gif-grid").on("click", ".clan-chat-gif-item", (e) => {
            const sourceUrl = $(e.currentTarget).data("source-url") as string;
            if (sourceUrl) {
                this.sendGifMessage(sourceUrl);
            }
        });
        $("#clan-chat-input").on("keydown", (e) => {
            if (this.mentionSuggestionsMenu?.is(":visible")) {
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    this.applyMentionSuggestion(
                        this.mentionSuggestionsMenu
                            .find(".clan-mention-suggestion")
                            .first()
                            .data("mention") as string,
                    );
                    return;
                }
                if (e.key === "Escape") {
                    this.hideMentionSuggestions();
                    return;
                }
            }
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendClanMessage();
            }
        });
        $("#clan-chat-input").on("input", () => {
            this.updateClanChatCounter();
            this.updateMentionSuggestions();
        });
        $("#btn-clan-chat-compose-clear").on("click", () => {
            this.clearClanChatComposeContext();
        });
        $(document).on("click", () => {
            this.hideMessageActionsMenu();
            this.hideGifPicker();
            this.hideMentionSuggestions();
        });
        $("#clan-chat-messages").on("scroll", () => {
            const container = $("#clan-chat-messages");
            if (container.scrollTop()! <= 16) {
                if (this.clanMessagesHasMore && !this.clanMessagesLoading) {
                    this.loadClanMessages(true);
                } else if (this.clanMessages.length > 0 && !this.clanMessagesHasMore) {
                    $("#clan-chat-status").text("No older messages.");
                }
            }
        });
        $(".modal-clans-close.close").on("click", (e) => {
            const modal = $(e.currentTarget).closest(".modal");
            if (modal.attr("id") === "modal-clan-main") {
                this.mainModal.hide();
            } else if (modal.attr("id") === "modal-clan-page") {
                this.clanPageModal.hide();
            } else if (modal.attr("id") === "modal-clan-leaderboard") {
                this.leaderboardModal.hide();
            }
        });
    }

    loadAvailableIcons() {
        const items = this.account.items || [];
        const defaultUnlocks = UnlockDefs.unlock_default.unlocks;
        this.availableIcons = [];
        for (const type of defaultUnlocks) {
            const def = GameObjectDefs[type] as EmoteDef | undefined;
            if (def && def.type === "emote") {
                this.availableIcons.push(type);
            }
        }
        for (const item of items) {
            const def = GameObjectDefs[item.type] as EmoteDef | undefined;
            if (def && def.type === "emote" && !this.availableIcons.includes(item.type)) {
                this.availableIcons.push(item.type);
            }
        }
    }

    selectIcon(icon: string) {
        this.selectedIcon = icon;
        $(".clan-icon-option").removeClass("selected");
        $(`.clan-icon-option[data-icon="${icon}"]`).addClass("selected");
        $("#clan-create-icon-preview").css(
            "background-image",
            `url(${getClanIconUrl(icon)})`,
        );
    }

    showMainModal() {
        this.loadMyClan();
        this.loadAvailableIcons();
        this.resetDefaults();
        this.loadClanList(1);
        this.mainModal.show(true);
    }

    showIconSelector() {
        const iconContainer = $("#clan-icon-selector");
        iconContainer.empty();
        for (const icon of this.availableIcons) {
            const iconUrl = getClanIconUrl(icon);
            const div = $("<div/>", {
                class: `clan-icon-option${icon === this.selectedIcon ? " selected" : ""}`,
                "data-icon": icon,
            }).css("background-image", `url(${iconUrl})`);
            iconContainer.append(div);
        }
        this.iconModal.show(true);
    }

    resetDefaults() {
        this.selectedIcon = "emote_surviv";
        $("#clan-create-name-input").val("");
        $("#clan-create-icon-preview").css(
            "background-image",
            `url(${getClanIconUrl(this.selectedIcon)})`,
        );
        $("#clan-create-warning").hide();
    }

    showClanPage(clanId: string) {
        this.resetClanMessages();
        $("#clan-chat-section").hide();
        this.loadClanDetail(clanId);
        this.mainModal.hide();
        this.clanPageModal.show(true);
    }

    showLeaderboard() {
        $(".clan-leaderboard-tab").removeClass("active").first().addClass("active");
        $("#clan-leaderboard-game-mode").val(GameModeStatus.Deathmatch);
        this.loadLeaderboard("kills");
        this.leaderboardModal.show(true);
    }

    getSelectedLeaderboardType(): "kills" | "wins" {
        return (
            ($(".clan-leaderboard-tab.active").data("type") as "kills" | "wins") ||
            "kills"
        );
    }

    getSelectedLeaderboardGameMode(): GameModeStatusType {
        const value = $("#clan-leaderboard-game-mode").val();
        return value === GameModeStatus.BattleRoyale
            ? GameModeStatus.BattleRoyale
            : GameModeStatus.Deathmatch;
    }

    showError(message: string) {
        alert(message);
    }

    loadMyClan() {
        clanRequest<GetMyClanResponse>("/api/clan/my_clan", {}, (err, res) => {
            if (err || !res?.success) {
                console.error("Failed to load clan data");
                this.stopMentionPolling();
                return;
            }

            this.currentClan = res.clan;
            this.cooldownUntil = res.cooldownUntil;
            if (this.currentClan) {
                this.startMentionPolling();
            } else {
                this.unreadMentionCount = 0;
                this.stopMentionPolling();
            }

            this.updateMainCard();
            this.updateMentionBadges();
        });
    }

    updateMainCard() {
        if (this.currentClan) {
            $("#clan-create-card").hide();
            $("#clan-my-card").show();
            $("#btn-clan-create-submit").hide();
            $("#btn-clan-my-clan").removeClass("disabled").css("opacity", "1");
            $("#clan-my-icon").css(
                "background-image",
                `url(${getClanIconUrl(this.currentClan.icon)})`,
            );
            $("#clan-my-name").text(this.currentClan.name);
            $("#clan-my-members").text(
                `${this.currentClan.memberCount} / ${this.currentClan.maxMembers} Members`,
            );
            $("#clan-my-kills").text(this.currentClan.totalKills.toLocaleString());
            $("#clan-my-wins").text(this.currentClan.totalWins.toLocaleString());
            const isOwner = this.currentClan.members?.some(
                (m) => m.slug === this.account.profile?.slug && m.isOwner,
            );

            if (isOwner) {
                $("#btn-clan-leave-main").hide();
                $("#btn-clan-delete-main").show();
            } else {
                $("#btn-clan-leave-main").show();
                $("#btn-clan-delete-main").hide();
            }
        } else {
            $("#clan-create-card").show();
            $("#clan-my-card").hide();
            $("#btn-clan-create-submit").show();
            $("#btn-clan-my-clan").addClass("disabled").css("opacity", "0.5");
        }
        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            const remaining = formatTimeRemaining(this.cooldownUntil - Date.now());
            $("#clan-create-warning").text(`You can join a clan in ${remaining}`).show();
        }
    }

    createClan() {
        const name = ($("#clan-create-name-input").val() as string).trim();

        if (this.currentClan) {
            $("#clan-create-warning")
                .text("You must leave your current clan first.")
                .show();
            return;
        }

        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            $("#clan-create-warning")
                .text(
                    `You must wait ${formatTimeRemaining(this.cooldownUntil - Date.now())} before creating a clan.`,
                )
                .show();
            return;
        }

        if (name.length < ClanConstants.NameMinLen) {
            $("#clan-create-warning")
                .text(
                    `Clan name must be at least ${ClanConstants.NameMinLen} characters.`,
                )
                .show();
            return;
        }

        if (name.length > ClanConstants.NameMaxLen) {
            $("#clan-create-warning")
                .text(`Clan name must be at most ${ClanConstants.NameMaxLen} characters.`)
                .show();
            return;
        }

        clanRequest<CreateClanResponse>(
            "/api/clan/create",
            {
                name,
                icon: this.selectedIcon,
            },
            (err, res) => {
                if (err) {
                    $("#clan-create-warning")
                        .text("Server error. Please try again.")
                        .show();
                    return;
                }

                if (!res?.success) {
                    const errorMessages: Record<string, string> = {
                        name_taken: "This clan name is already taken.",
                        invalid_name: "Invalid clan name.",
                        already_in_clan: "You are already in a clan.",
                        server_error: "Server error. Please try again.",
                    };
                    $("#clan-create-warning")
                        .text(errorMessages[res?.error || "server_error"])
                        .show();
                    return;
                }

                this.mainModal.hide();
                this.loadMyClan();
                if (res.clan) {
                    this.showClanPage(res.clan.id);
                }
            },
        );
    }

    loadClanList(page: number) {
        const search = (($("#clan-search-input").val() as string) || "").trim();

        clanRequest<ListClansResponse>(
            "/api/clan/list",
            {
                page,
                limit: 20,
                search: search || undefined,
            },
            (err, res) => {
                if (err || !res) {
                    console.error("Failed to load clan list");
                    return;
                }

                this.renderClanList(res.clans, res.page, res.totalPages);
            },
        );
    }

    renderClanList(clans: ClanInfo[], page: number, totalPages: number) {
        const container = $("#clan-list-container");
        container.empty();

        if (clans.length === 0) {
            container.append(
                $("<div/>", {
                    class: "clan-list-empty",
                    text: "No clans found.",
                }),
            );
            return;
        }

        for (const clan of clans) {
            const isFull = clan.memberCount >= clan.maxMembers;
            const item = $("<div/>", {
                class: "clan-list-item",
            });

            item.append(
                $("<div/>", {
                    class: "clan-list-icon",
                }).css("background-image", `url(${getClanIconUrl(clan.icon)})`),
            );

            item.append(
                $("<div/>", {
                    class: "clan-list-info",
                }).append(
                    $("<div/>", { class: "clan-list-name", text: clan.name }),
                    $("<div/>", {
                        class: "clan-list-members",
                        text: `${clan.memberCount}/${clan.maxMembers} members`,
                    }),
                ),
            );

            if (isFull) {
                item.append(
                    $("<div/>", {
                        class: "clan-list-status",
                        text: "FULL",
                    }),
                );
            } else if (!this.currentClan) {
                const joinBtn = $("<div/>", {
                    class: "clan-btn clan-btn-teal clan-btn-small",
                    text: "Join",
                }).on("click", (e) => {
                    e.stopPropagation();
                    this.joinClan(clan.id);
                });
                item.append(joinBtn);
            }

            item.on("click", () => {
                this.showClanPage(clan.id);
            });

            container.append(item);
        }

        if (totalPages > 1) {
            const pagination = $("<div/>", { class: "clan-pagination" });
            if (page > 1) {
                pagination.append(
                    $("<div/>", {
                        class: "clan-btn clan-btn-grey clan-btn-small",
                        text: "Previous",
                    }).on("click", () => this.loadClanList(page - 1)),
                );
            }
            pagination.append(
                $("<span/>", {
                    class: "clan-pagination-info",
                    text: `Page ${page} of ${totalPages}`,
                }),
            );
            if (page < totalPages) {
                pagination.append(
                    $("<div/>", {
                        class: "clan-btn clan-btn-grey clan-btn-small",
                        text: "Next",
                    }).on("click", () => this.loadClanList(page + 1)),
                );
            }
            container.append(pagination);
        }
    }

    joinClan(clanId: string) {
        if (this.currentClan) {
            this.showError("You must leave your current clan first.");
            return;
        }

        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            this.showError(
                `You must wait ${formatTimeRemaining(this.cooldownUntil - Date.now())} before joining a clan.`,
            );
            return;
        }

        clanRequest<JoinClanResponse>("/api/clan/join", { clanId }, (err, res) => {
            if (err) {
                this.showError("Server error. Please try again.");
                return;
            }

            if (!res?.success) {
                const errorMessages: Record<string, string> = {
                    clan_not_found: "Clan not found.",
                    clan_full: "This clan is full.",
                    already_in_clan: "You are already in a clan.",
                    cooldown_active: "You must wait before joining a new clan.",
                    server_error: "Server error. Please try again.",
                };
                this.showError(errorMessages[res?.error || "server_error"]);
                return;
            }

            this.mainModal.hide();
            this.clanPageModal.hide();
            this.loadMyClan();
            this.showClanPage(clanId);
        });
    }

    loadClanDetail(clanId: string) {
        clanRequest<{ success: boolean; clan?: ClanDetail }>(
            "/api/clan/get",
            { clanId },
            (err, res) => {
                if (err || !res?.success || !res.clan) {
                    this.showError("Failed to load clan details.");
                    return;
                }

                this.viewingClan = res.clan;
                this.renderClanDetail(res.clan);
                this.resetClanMessages();
                if (this.isCurrentUserClanMember(res.clan)) {
                    $("#clan-chat-section").show();
                    this.loadClanMessages(false);
                    this.startClanMessagePolling();
                } else {
                    $("#clan-chat-section").hide();
                    this.stopClanMessagePolling();
                }
            },
        );
    }

    isCurrentUserClanMember(clan: ClanDetail) {
        return (
            !!this.account.profile?.slug &&
            clan.members.some((m) => m.slug === this.account.profile.slug)
        );
    }

    getCurrentUserId() {
        const clan = this.viewingClan || this.currentClan;
        if (!clan || !this.account.profile?.slug) return null;
        return (
            clan.members.find((member) => member.slug === this.account.profile.slug)
                ?.odUserId || null
        );
    }

    getMentionSeenStorageKey(clanId: string) {
        const userKey = this.account.profile?.slug || "guest";
        return `clanMentionSeen:v2:${userKey}:${clanId}`;
    }

    getMentionSeenAt(clanId: string) {
        return Number(localStorage.getItem(this.getMentionSeenStorageKey(clanId)) || 0);
    }

    setMentionSeenAt(clanId: string, timestamp: number) {
        localStorage.setItem(this.getMentionSeenStorageKey(clanId), String(timestamp));
    }

    startMentionPolling() {
        this.stopMentionPolling();
        this.loadMentionNotifications();
        this.scheduleMentionPoll();
    }

    scheduleMentionPoll() {
        if (this.clanMentionPollTimer) {
            clearTimeout(this.clanMentionPollTimer);
        }
        this.clanMentionPollTimer = setTimeout(() => {
            this.loadMentionNotifications();
        }, 60000);
    }

    stopMentionPolling() {
        if (this.clanMentionPollTimer) {
            clearTimeout(this.clanMentionPollTimer);
            this.clanMentionPollTimer = null;
        }
        this.clanMentionPolling = false;
    }

    loadMentionNotifications(force = false) {
        if (
            !this.currentClan ||
            this.clanPageModal.isVisible() ||
            this.clanMentionPolling ||
            (!force && !this.isHomeScreenActive())
        ) {
            if (this.clanMentionPollTimer) {
                this.scheduleMentionPoll();
            }
            return;
        }

        const clanId = this.currentClan.id;
        const after = this.getMentionSeenAt(clanId) || undefined;
        const markExistingSeen = !after;
        this.clanMentionPolling = true;
        clanRequest<GetClanMessagesResponse>(
            "/api/clan/messages",
            { clanId, limit: 40, after },
            (err, res) => {
                this.clanMentionPolling = false;
                if (this.clanMentionPollTimer) {
                    this.scheduleMentionPoll();
                }
                if (err || !res?.success || !this.currentClan || this.currentClan.id !== clanId) {
                    return;
                }
                this.updateUnreadMentionsFromMessages(res.messages, markExistingSeen);
            },
        );
    }

    updateUnreadMentionsFromMessages(messages: ClanMessage[], markSeen: boolean) {
        const clan = this.currentClan || this.viewingClan;
        if (!clan) return;

        const seenAt = this.getMentionSeenAt(clan.id);
        const currentUserId = this.getCurrentUserId();
        const mentionCount = messages.filter(
            (message) =>
                message.createdAt > seenAt &&
                message.senderId !== currentUserId &&
                this.isMessageMentioningCurrentUser(message),
        ).length;

        this.unreadMentionCount = markSeen ? 0 : this.unreadMentionCount + mentionCount;
        if (markSeen && messages.length === 0 && !seenAt) {
            this.setMentionSeenAt(clan.id, 1);
        } else if (messages.length > 0) {
            this.setMentionSeenAt(clan.id, Math.max(...messages.map((m) => m.createdAt)));
        }
        this.updateMentionBadges();
    }

    updateMentionBadges() {
        const count = this.unreadMentionCount;
        const label = count > 99 ? "99+" : String(count);
        for (const target of [$("#btn-clans"), $("#btn-clan-my-clan")]) {
            let badge = target.find(".clan-mention-badge");
            if (!badge.length) {
                badge = $("<span/>", { class: "clan-mention-badge" });
                target.append(badge);
            }
            badge.text(label).toggle(count > 0);
        }
    }

    isMessageMentioningCurrentUser(message: ClanMessage) {
        if (message.type !== "user" || !this.account.profile?.slug) return false;
        const clan = this.viewingClan || this.currentClan;
        const currentMember = clan?.members.find(
            (member) => member.slug === this.account.profile.slug,
        );
        if (!currentMember) return false;

        const mentions = this.getMessageMentions(message.message);
        return mentions.some((mention) => this.isMentionForMember(mention, currentMember));
    }

    isMentionForMember(mention: string, member: ClanMember) {
        const normalizedMention = normalizeMentionValue(mention);
        return (
            normalizedMention === normalizeMentionValue(member.username) ||
            normalizedMention === normalizeMentionValue(member.slug)
        );
    }

    getMessageMentions(message: string) {
        const matches = message.match(/@[\w.-]+/g) || [];
        return matches.map((mention) => mention.slice(1));
    }

    renderClanDetail(clan: ClanDetail) {
        $("#clan-detail-icon").css(
            "background-image",
            `url(${getClanIconUrl(clan.icon)})`,
        );
        $("#clan-detail-name").text(clan.name);
        $("#clan-detail-name").css("color", clan.tagColor || "");
        $("#clan-detail-members-count, #clan-members-count").text(
            `${clan.memberCount} / ${clan.maxMembers}`,
        );
        const owner = clan.members?.find((m) => m.isOwner)?.username || "Unknown";
        $("#clan-detail-owner").text(`Owner: ${owner}`);
        const createdDate = new Date(clan.createdAt).toLocaleDateString();
        $("#clan-detail-created").text(`Created: ${createdDate}`);
        $("#clan-detail-kills").text(clan.totalKills.toLocaleString());
        $("#clan-detail-wins").text(clan.totalWins.toLocaleString());
        $("#clan-detail-games").text("0");
        $("#clan-detail-kill-placement").text("N/A");
        $("#clan-detail-win-placement").text("N/A");
        const membersContainer = $("#clan-members-list");
        membersContainer.empty();

        const isOwner =
            this.account.profile?.slug &&
            clan.members.some((m) => m.slug === this.account.profile.slug && m.isOwner);
        const isMember =
            this.account.profile?.slug &&
            clan.members.some((m) => m.slug === this.account.profile.slug);
        if (isOwner) {
            $("#btn-clan-edit-icon").show();
            $("#btn-clan-edit-name").show();
            $("#clan-tag-color-input").show();
            $("#clan-tag-color-input").val(normalizeColorInputValue(clan.tagColor));
        } else {
            $("#btn-clan-edit-icon").hide();
            $("#btn-clan-edit-name").hide();
            $("#clan-tag-color-input").hide();
        }
        this.cancelNameEdit();

        for (const member of clan.members) {
            const item = $("<div/>", { class: "clan-member-item" });

            const iconDiv = $("<div/>", {
                class: "clan-member-icon",
            }).css("background-image", `url(${getClanIconUrl(member.playerIcon)})`);

            if (member.isOwner) {
                iconDiv.append($("<div/>", { class: "clan-member-crown" }));
            }

            item.append(iconDiv);

            item.append(
                $("<div/>", {
                    class: "clan-member-info",
                }).append(
                    $("<div/>", {
                        class: `clan-member-name${member.isOwner ? " owner" : ""}`,
                        text: member.username,
                    }),
                    $("<div/>", {
                        class: "clan-member-stats",
                        text: `Kills: ${member.statsAfterJoin.kills} | Wins: ${member.statsAfterJoin.wins}`,
                    }),
                ),
            );
            if (isOwner && !member.isOwner) {
                const controls = $("<div/>", { class: "clan-member-controls" });

                controls.append(
                    $("<div/>", {
                        class: "clan-btn-small clan-btn-transfer",
                        text: "Transfer",
                        title: "Transfer ownership",
                    }).on("click", (e) => {
                        e.stopPropagation();
                        if (confirm(`Transfer ownership to ${member.username}?`)) {
                            this.transferOwnership(member.odUserId);
                        }
                    }),
                );

                controls.append(
                    $("<div/>", {
                        class: "clan-btn-small clan-btn-kick",
                        text: "Kick",
                    }).on("click", (e) => {
                        e.stopPropagation();
                        if (confirm(`Kick ${member.username} from the clan?`)) {
                            this.kickMember(member.odUserId);
                        }
                    }),
                );

                item.append(controls);
            }

            membersContainer.append(item);
        }
        if (isMember) {
            $("#clan-member-actions").show();
            if (isOwner) {
                $("#btn-clan-leave").hide();
                $("#btn-clan-delete").show();
            } else {
                $("#btn-clan-leave").show();
                $("#btn-clan-delete").hide();
            }
        } else {
            $("#clan-member-actions").hide();
        }
    }

    resetClanMessages() {
        this.clanMessages = [];
        this.clanMessagesHasMore = false;
        this.clanMessagesLoading = false;
        this.clanMessagesPolling = false;
        this.replyingToMessage = null;
        this.editingMessage = null;
        $("#clan-chat-messages").empty();
        $("#clan-chat-input").val("");
        $("#clan-chat-status").text("");
        this.hideMessageActionsMenu();
        this.hideMentionSuggestions();
        this.renderClanChatComposeContext();
        this.updateClanChatCounter();
    }

    loadClanMessages(loadOlder: boolean) {
        if (!this.viewingClan || this.clanMessagesLoading) return;
        if (loadOlder && this.clanMessages.length === 0) return;

        const container = $("#clan-chat-messages");
        const oldScrollHeight = container.prop("scrollHeight") || 0;
        const before = loadOlder ? this.clanMessages[0]?.createdAt : undefined;
        const clanId = this.viewingClan.id;

        this.clanMessagesLoading = true;
        $("#clan-chat-status").text(loadOlder ? "Loading older messages..." : "");
        clanRequest<GetClanMessagesResponse>(
            "/api/clan/messages",
            {
                clanId,
                limit: 30,
                before,
            },
            (err, res) => {
                this.clanMessagesLoading = false;
                if (!this.viewingClan || this.viewingClan.id !== clanId) {
                    return;
                }
                if (err || !res?.success) {
                    $("#clan-chat-status").text("Failed to load chat.");
                    return;
                }

                this.clanMessagesHasMore = res.hasMore;
                if (loadOlder) {
                    this.clanMessages = [...res.messages, ...this.clanMessages];
                } else {
                    this.clanMessages = res.messages;
                }
                this.renderClanMessages();
                if (!loadOlder) {
                    this.updateUnreadMentionsFromMessages(this.clanMessages, true);
                }

                if (loadOlder) {
                    const newScrollHeight = container.prop("scrollHeight") || 0;
                    container.scrollTop(newScrollHeight - oldScrollHeight);
                    $("#clan-chat-status").text(
                        this.clanMessagesHasMore ? "" : "No older messages.",
                    );
                } else {
                    container.scrollTop(container.prop("scrollHeight") || 0);
                    $("#clan-chat-status").text(
                        this.clanMessages.length === 0 ? "No messages yet." : "",
                    );
                }
            },
        );
    }

    startClanMessagePolling() {
        this.stopClanMessagePolling();
        this.scheduleClanMessagePoll();
    }

    scheduleClanMessagePoll() {
        if (this.clanMessagesPollTimer) {
            clearTimeout(this.clanMessagesPollTimer);
        }
        this.clanMessagesPollTimer = setTimeout(() => {
            this.loadNewClanMessages();
        }, 4000);
    }

    stopClanMessagePolling() {
        if (this.clanMessagesPollTimer) {
            clearTimeout(this.clanMessagesPollTimer);
            this.clanMessagesPollTimer = null;
        }
        this.clanMessagesPolling = false;
    }

    clearClanMessageLongPress() {
        if (this.clanMessageLongPressTimer) {
            clearTimeout(this.clanMessageLongPressTimer);
            this.clanMessageLongPressTimer = null;
        }
    }

    loadNewClanMessages() {
        if (
            !this.viewingClan ||
            !this.clanPageModal.isVisible() ||
            this.clanMessagesPolling
        ) {
            if (this.clanMessagesPollTimer) {
                this.scheduleClanMessagePoll();
            }
            return;
        }

        const container = $("#clan-chat-messages");
        const clanId = this.viewingClan.id;
        const scrollBottom =
            (container.prop("scrollHeight") || 0) -
            (container.scrollTop() || 0) -
            container.outerHeight()!;
        const shouldStickToBottom = scrollBottom < 80;

        this.clanMessagesPolling = true;
        clanRequest<GetClanMessagesResponse>(
            "/api/clan/messages",
            {
                clanId,
                limit: 40,
            },
            (err, res) => {
                this.clanMessagesPolling = false;
                if (this.clanMessagesPollTimer) {
                    this.scheduleClanMessagePoll();
                }
                if (!this.viewingClan || this.viewingClan.id !== clanId) {
                    return;
                }
                if (err || !res?.success) {
                    return;
                }

                const messageRenderKey = this.getClanMessagesRenderKey();
                this.syncRecentClanMessages(res.messages);
                this.mergeClanMessages(res.messages);
                if (messageRenderKey === this.getClanMessagesRenderKey()) {
                    this.updateUnreadMentionsFromMessages(this.clanMessages, true);
                    $("#clan-chat-status").text("");
                    return;
                }

                this.renderClanMessages();
                this.updateUnreadMentionsFromMessages(this.clanMessages, true);
                if (shouldStickToBottom) {
                    container.scrollTop(container.prop("scrollHeight") || 0);
                }
                $("#clan-chat-status").text("");
            },
        );
    }

    getClanMessagesRenderKey() {
        return this.clanMessages
            .map((message) =>
                [
                    message.id,
                    message.message,
                    message.editedAt ?? "",
                    message.replyTo?.id ?? "",
                ].join(":"),
            )
            .join("|");
    }

    syncRecentClanMessages(messages: ClanMessage[]) {
        if (messages.length === 0) return;
        const oldestRecentMessage = messages[0];
        const recentMessageIds = new Set(messages.map((message) => message.id));
        this.clanMessages = this.clanMessages.filter(
            (message) =>
                message.createdAt < oldestRecentMessage.createdAt ||
                recentMessageIds.has(message.id),
        );
    }

    mergeClanMessages(messages: ClanMessage[]) {
        const messagesById = new Map(
            this.clanMessages.map((message) => [message.id, message]),
        );
        for (const message of messages) {
            if (messagesById.has(message.id)) {
                Object.assign(messagesById.get(message.id)!, message);
            } else {
                this.clanMessages.push(message);
            }
        }
        this.clanMessages.sort((a, b) => a.createdAt - b.createdAt);
        if (this.clanMessages.length > 100) {
            this.clanMessages = this.clanMessages.slice(-100);
        }
    }

    updateClanChatCounter() {
        const message = ($("#clan-chat-input").val() as string) || "";
        const remaining = Math.max(0, ClanConstants.MessageMaxLen - message.length);
        $("#clan-chat-counter")
            .text(`${remaining} left`)
            .toggleClass("low", remaining <= 20)
            .toggleClass("empty", remaining === 0);
    }

    renderClanChatComposeContext() {
        const context = $("#clan-chat-compose-context");
        if (this.editingMessage) {
            $("#clan-chat-compose-label").text("Editing message");
            $("#clan-chat-compose-text").text(this.editingMessage.message);
            $("#btn-clan-chat-send").text("Save");
            context.show();
            return;
        }
        if (this.replyingToMessage) {
            $("#clan-chat-compose-label").text(
                `Replying to ${this.replyingToMessage.username}`,
            );
            $("#clan-chat-compose-text").text(this.replyingToMessage.message);
            $("#btn-clan-chat-send").text("Send");
            context.show();
            return;
        }
        $("#btn-clan-chat-send").text("Send");
        context.hide();
    }

    clearClanChatComposeContext() {
        this.replyingToMessage = null;
        this.editingMessage = null;
        $("#clan-chat-input").val("");
        this.renderClanChatComposeContext();
        this.updateClanChatCounter();
    }

    toggleGifPicker() {
        if ($("#clan-chat-gif-picker").is(":visible")) {
            this.hideGifPicker();
            return;
        }
        this.showGifPicker();
    }

    showGifPicker() {
        if (!this.viewingClan) return;
        $("#clan-chat-gif-picker").show();
        $("#btn-clan-chat-gif").addClass("active");
        $("#clan-chat-gif-search").focus();
        if ($("#clan-chat-gif-grid").children().length === 0) {
            this.loadGifPickerResults();
        }
    }

    hideGifPicker() {
        $("#clan-chat-gif-picker").hide();
        $("#btn-clan-chat-gif").removeClass("active");
        this.unloadGifImages($("#clan-chat-gif-grid")[0]);
    }

    scheduleGifPickerSearch() {
        if (this.gifPickerSearchTimer) {
            clearTimeout(this.gifPickerSearchTimer);
        }
        this.gifPickerSearchTimer = setTimeout(() => {
            this.loadGifPickerResults();
        }, 250);
    }

    loadGifPickerResults() {
        if (!this.viewingClan || this.gifPickerLoading) return;

        const query = (($("#clan-chat-gif-search").val() as string) || "").trim();
        const grid = $("#clan-chat-gif-grid");
        const adMaxWidth = Math.max(50, Math.round(grid.outerWidth() || 401));
        this.gifPickerLoading = true;
        $("#clan-chat-gif-status").text("Loading GIFs...");

        clanRequest<SearchKlipyGifsResponse>(
            "/api/clan/search_klipy_gifs",
            {
                clanId: this.viewingClan.id,
                query: query || undefined,
                section: query ? undefined : this.gifPickerSection || undefined,
                limit: 24,
                adMaxWidth,
                adMaxHeight: 250,
            },
            (err, res) => {
                this.gifPickerLoading = false;
                if (err || !res?.success) {
                    $("#clan-chat-gif-grid").empty();
                    $("#clan-chat-gif-status").text(
                        res?.success === false && res.error === "not_configured"
                            ? "Klipy API key is not configured."
                            : "GIFs could not be loaded.",
                    );
                    return;
                }

                this.renderGifPickerResults(res.gifs);
            },
        );
    }

    renderGifPickerResults(gifs: ClanChatGifPickerItem[]) {
        const grid = $("#clan-chat-gif-grid");
        this.unobserveGifImages(grid[0]);
        grid.empty();

        for (const [index, gif] of gifs.entries()) {
            if (gif.type === "ad") {
                grid.append(this.renderGifPickerAd(gif));
                continue;
            }

            grid.append(
                $("<button/>", {
                    class: "clan-chat-gif-item",
                    type: "button",
                    title: gif.title,
                })
                    .data("source-url", gif.url)
                    .append(
                        this.createLazyGifImage({
                            class: "clan-chat-gif-thumb",
                            src: gif.url,
                            alt: gif.title,
                            eager: index < 4,
                        }),
                    ),
            );
        }

        $("#clan-chat-gif-status").text(gifs.length === 0 ? "No GIFs found." : "");
    }

    renderGifPickerAd(ad: Extract<ClanChatGifPickerItem, { type: "ad" }>) {
        const item = $("<div/>", {
            class: "clan-chat-gif-item clan-chat-gif-ad",
            title: ad.title,
        });

        const label = $("<span/>", {
            class: "clan-chat-gif-ad-label",
            text: "Ad",
        });

        if (ad.html || ad.iframeUrl) {
            item.append(
                $("<iframe/>", {
                    class: "clan-chat-gif-ad-frame",
                    title: ad.title,
                    loading: "lazy",
                    sandbox:
                        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
                    referrerpolicy: "no-referrer-when-downgrade",
                    src: ad.iframeUrl || undefined,
                    srcdoc: ad.html || undefined,
                }),
                label,
            );
            return item;
        }

        if (ad.imageUrl) {
            const image = $("<img/>", {
                class: "clan-chat-gif-ad-image",
                src: ad.imageUrl,
                alt: ad.title,
                loading: "lazy",
            });

            if (ad.clickUrl) {
                item.append(
                    $("<a/>", {
                        class: "clan-chat-gif-ad-link",
                        href: ad.clickUrl,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        title: ad.title,
                    }).append(image),
                    label,
                );
                return item;
            }

            item.append(image, label);
            return item;
        }

        return item.append(
            $("<div/>", {
                class: "clan-chat-gif-ad-empty",
                text: "Advertisement",
            }),
            label,
        );
    }

    createLazyGifImage(options: {
        class: string;
        src: string;
        alt: string;
        eager?: boolean;
    }) {
        const image = $("<img/>", {
            class: `${options.class} clan-chat-lazy-gif`,
            src: options.eager ? this.resolveImageSrc(options.src) : blankGifSrc,
            alt: options.alt,
            loading: options.eager ? "eager" : "lazy",
            crossOrigin: "anonymous",
        }).on("load", (e) => {
            this.cacheGifStillFrame(e.currentTarget as HTMLImageElement);
        });
        image.data("gif-src", this.resolveImageSrc(options.src));
        if (!options.eager) {
            this.observeGifImage(image[0] as HTMLImageElement);
        }
        return image;
    }

    resolveImageSrc(src: string) {
        try {
            return new URL(src, window.location.href).toString();
        } catch {
            return src;
        }
    }

    cacheGifStillFrame(image: HTMLImageElement) {
        const gifSrc = $(image).data("gif-src") as string | undefined;
        if (!gifSrc || image.src !== gifSrc || this.gifStillFrameCache.has(gifSrc)) {
            return;
        }

        const stillFrame = this.captureGifStillFrame(image);
        this.gifStillFrameCache.set(gifSrc, stillFrame);
    }

    captureGifStillFrame(image: HTMLImageElement) {
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
            return null;
        }

        try {
            const maxStillFrameWidth = 480;
            const scale = Math.min(1, maxStillFrameWidth / image.naturalWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

            const context = canvas.getContext("2d");
            if (!context) return null;

            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
        } catch {
            return null;
        }
    }

    pauseGifImage(image: HTMLImageElement) {
        const gifSrc = $(image).data("gif-src") as string | undefined;
        if (!gifSrc || image.src !== gifSrc) return;

        const cachedStillFrame = this.gifStillFrameCache.get(gifSrc);
        if (cachedStillFrame) {
            image.src = cachedStillFrame;
            return;
        }

        const stillFrame = this.captureGifStillFrame(image);
        this.gifStillFrameCache.set(gifSrc, stillFrame);
        if (stillFrame) {
            image.src = stillFrame;
        }
    }

    getGifImageObserver() {
        if (!("IntersectionObserver" in window)) return null;
        if (!this.gifImageObserver) {
            this.gifImageObserver = new IntersectionObserver(
                (entries) => {
                    for (const entry of entries) {
                        const image = entry.target as HTMLImageElement;
                        const gifSrc = $(image).data("gif-src") as string | undefined;
                        if (!gifSrc) continue;

                        if (entry.isIntersecting) {
                            if (image.src !== gifSrc) {
                                image.src = gifSrc;
                            }
                        } else {
                            this.pauseGifImage(image);
                        }
                    }
                },
                { root: null, rootMargin: "80px 0px", threshold: 0 },
            );
        }
        return this.gifImageObserver;
    }

    observeGifImage(image: HTMLImageElement) {
        const observer = this.getGifImageObserver();
        if (!observer) {
            const gifSrc = $(image).data("gif-src") as string | undefined;
            if (gifSrc) image.src = gifSrc;
            return;
        }

        this.observedGifImages.add(image);
        observer.observe(image);
    }

    unobserveGifImages(root?: HTMLElement) {
        if (!this.gifImageObserver) return;

        for (const image of Array.from(this.observedGifImages)) {
            if (root && !root.contains(image)) continue;
            this.gifImageObserver.unobserve(image);
            this.observedGifImages.delete(image);
        }
    }

    unloadGifImages(root?: HTMLElement) {
        for (const image of Array.from(this.observedGifImages)) {
            if (root && !root.contains(image)) continue;
            this.pauseGifImage(image);
        }
    }

    sendGifMessage(sourceUrl: string) {
        if (this.editingMessage) {
            $("#clan-chat-status").text("Finish editing before sending a GIF.");
            return;
        }
        if (sourceUrl.length > ClanConstants.MessageMaxLen) {
            $("#clan-chat-status").text("That GIF link is too long to send.");
            return;
        }
        $("#clan-chat-input").val(sourceUrl);
        this.updateClanChatCounter();
        this.hideGifPicker();
        this.sendClanMessage();
    }

    findClanMessage(messageId: string) {
        return this.clanMessages.find((message) => message.id === messageId) || null;
    }

    getCurrentUserClanMemberId() {
        if (!this.viewingClan || !this.account.profile?.slug) return null;
        return (
            this.viewingClan.members.find(
                (member) => member.slug === this.account.profile!.slug,
            )?.odUserId || null
        );
    }

    isOwnClanMessage(message: ClanMessage) {
        if (message.type !== "user") return false;
        const currentUserId = this.getCurrentUserClanMemberId();
        return !!currentUserId && message.senderId === currentUserId;
    }

    renderGifPreview(message: ClanMessage) {
        if (!this.viewingClan) return $();

        const gifUrl = findKlipyUrl(message.message);
        if (!gifUrl) return $();

        const preview = $("<a/>", {
            class: "clan-chat-gif-preview loading",
            href: gifUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "Open GIF",
        }).append(
            $("<div/>", {
                class: "clan-chat-gif-placeholder",
                text: "Loading GIF...",
            }),
        );

        const cachedGif = this.gifPreviewCache.get(gifUrl);
        if (cachedGif === null) return $();
        if (cachedGif) {
            return this.fillGifPreview(preview, cachedGif);
        }
        if (this.gifPreviewPending.has(gifUrl)) {
            return preview;
        }

        this.gifPreviewPending.add(gifUrl);
        clanRequest<ResolveKlipyGifResponse>(
            "/api/clan/resolve_klipy_gif",
            {
                clanId: this.viewingClan.id,
                url: gifUrl,
            },
            (err, res) => {
                this.gifPreviewPending.delete(gifUrl);
                if (err || !res?.success) {
                    this.gifPreviewCache.set(gifUrl, null);
                    preview.removeClass("loading").empty().append(
                        $("<div/>", {
                            class: "clan-chat-gif-placeholder",
                            text: "Open GIF",
                        }),
                    );
                    return;
                }

                this.gifPreviewCache.set(gifUrl, res.gif);
                this.fillGifPreview(preview, res.gif);
            },
        );

        return preview;
    }

    fillGifPreview(preview: JQuery<HTMLElement>, gif: ClanChatGifPreview) {
        preview.removeClass("loading");
        preview.empty().append(
            this.createLazyGifImage({
                class: "clan-chat-gif-image",
                src: gif.url,
                alt: gif.title,
            }),
            $("<span/>", {
                class: "clan-chat-gif-attribution",
                text: "Powered by Klipy",
            }),
        );
        return preview;
    }

    getActiveMentionQuery() {
        const input = $("#clan-chat-input")[0] as HTMLInputElement | undefined;
        if (!input) return null;

        const cursor = input.selectionStart ?? input.value.length;
        const beforeCursor = input.value.slice(0, cursor);
        const match = beforeCursor.match(/(^|\s)@([\w.-]*)$/);
        if (!match) return null;

        const start = beforeCursor.length - match[2].length - 1;
        return {
            query: match[2],
            start,
            end: cursor,
        };
    }

    updateMentionSuggestions() {
        if (!this.viewingClan) {
            this.hideMentionSuggestions();
            return;
        }

        const activeMention = this.getActiveMentionQuery();
        if (!activeMention) {
            this.hideMentionSuggestions();
            return;
        }

        const normalizedQuery = normalizeMentionValue(activeMention.query);
        const suggestions = this.viewingClan.members
            .filter((member) => {
                if (!normalizedQuery) return true;
                return (
                    normalizeMentionValue(member.username).startsWith(normalizedQuery) ||
                    normalizeMentionValue(member.slug).startsWith(normalizedQuery)
                );
            })
            .slice(0, 6);

        if (suggestions.length === 0) {
            this.hideMentionSuggestions();
            return;
        }

        const menu =
            this.mentionSuggestionsMenu ||
            $("<div/>", { class: "clan-mention-suggestions" }).on("click", (e) => {
                e.stopPropagation();
            });
        menu.empty();

        for (const member of suggestions) {
            menu.append(
                $("<button/>", {
                    class: "clan-mention-suggestion",
                    type: "button",
                    title: `Mention ${member.username}`,
                })
                    .data("mention", member.slug)
                    .append(
                        $("<div/>", { class: "clan-mention-suggestion-icon" }).css(
                            "background-image",
                            `url(${getClanIconUrl(member.playerIcon)})`,
                        ),
                        $("<div/>", { class: "clan-mention-suggestion-name" }).text(
                            member.username,
                        ),
                    )
                    .on("click", () => {
                        this.applyMentionSuggestion(member.slug);
                    }),
            );
        }

        if (!this.mentionSuggestionsMenu) {
            this.mentionSuggestionsMenu = menu;
            $("body").append(menu);
        }

        const input = $("#clan-chat-input");
        const offset = input.offset();
        if (!offset) return;

        menu.show();
        const menuHeight = menu.outerHeight() || 0;
        menu.css({
            left: offset.left,
            top: offset.top - menuHeight - 6,
            width: input.outerWidth() || 260,
        });
    }

    applyMentionSuggestion(username: string | undefined) {
        if (!username) return;

        const activeMention = this.getActiveMentionQuery();
        const input = $("#clan-chat-input")[0] as HTMLInputElement | undefined;
        if (!activeMention || !input) return;

        const replacement = `@${username} `;
        const nextValue =
            input.value.slice(0, activeMention.start) +
            replacement +
            input.value.slice(activeMention.end);
        const nextCursor = activeMention.start + replacement.length;

        input.value = nextValue;
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
        this.hideMentionSuggestions();
        this.updateClanChatCounter();
    }

    hideMentionSuggestions() {
        this.mentionSuggestionsMenu?.hide();
    }

    renderMessageText(message: ClanMessage) {
        const text = $("<div/>", { class: "clan-chat-text" });
        const mentionRegex = /@[\w.-]+/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mentionRegex.exec(message.message))) {
            if (match.index > lastIndex) {
                text.append(document.createTextNode(message.message.slice(lastIndex, match.index)));
            }

            const mentionName = match[0].slice(1);
            const mentionedMember = this.viewingClan?.members.find((member) =>
                this.isMentionForMember(mentionName, member),
            );
            const isCurrentUserMention =
                !!mentionedMember && mentionedMember.slug === this.account.profile?.slug;

            text.append(
                $("<span/>", {
                    class: `clan-chat-mention${isCurrentUserMention ? " current-user" : ""}`,
                    text: match[0],
                    title: mentionedMember ? mentionedMember.username : undefined,
                }),
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < message.message.length) {
            text.append(document.createTextNode(message.message.slice(lastIndex)));
        }

        return text;
    }

    renderClanMessages() {
        const container = $("#clan-chat-messages");
        this.unobserveGifImages(container[0]);
        container.empty();

        for (const message of this.clanMessages) {
            const isOwnMessage = this.isOwnClanMessage(message);
            const isMentioningCurrentUser = this.isMessageMentioningCurrentUser(message);
            const item = $("<div/>", {
                class: `clan-chat-message${isOwnMessage ? " own" : ""}${
                    message.type !== "user" ? " server" : ""
                }${isMentioningCurrentUser ? " mentioned-current-user" : ""}`,
                "data-message-id": message.id,
            })
                .on("contextmenu", (e) => {
                    e.preventDefault();
                    this.showMessageActionsMenu(message, e.pageX, e.pageY);
                })
                .on("touchstart", (e) => {
                    this.clearClanMessageLongPress();
                    const touch = e.originalEvent?.touches[0];
                    if (!touch) return;
                    this.clanMessageLongPressTimer = setTimeout(() => {
                        this.showMessageActionsMenu(message, touch.pageX, touch.pageY);
                    }, 500);
                })
                .on("touchmove touchend touchcancel", () => {
                    this.clearClanMessageLongPress();
                });

            item.append(
                $("<div/>", {
                    class: "clan-chat-avatar",
                }).css("background-image", `url(${getClanIconUrl(message.playerIcon)})`),
            );

            const onlyKlipyUrl = isOnlyKlipyUrl(message.message);
            const bubble = $("<div/>", { class: "clan-chat-bubble" }).append(
                $("<button/>", {
                    class: "clan-chat-actions-btn",
                    text: "...",
                    title: "Message actions",
                    type: "button",
                }).on("click", (e) => {
                    e.stopPropagation();
                    this.showMessageActionsMenu(message, e.pageX, e.pageY);
                }),
                message.replyTo
                    ? $("<div/>", { class: "clan-chat-reply-preview" }).append(
                          $("<div/>", {
                              class: "clan-chat-reply-author",
                              text: message.replyTo.username,
                          }),
                          $("<div/>", {
                              class: "clan-chat-reply-text",
                              text: message.replyTo.message,
                          }),
                      )
                    : $(),
                $("<div/>", { class: "clan-chat-meta" }).append(
                    $("<span/>", {
                        class: "clan-chat-author",
                        text: message.username,
                    }),
                    $("<span/>", {
                        class: "clan-chat-time",
                        text: formatChatTime(message.createdAt),
                    }),
                    message.editedAt
                        ? $("<span/>", {
                              class: "clan-chat-edited",
                              text: "(edited)",
                          })
                        : $(),
                ),
                onlyKlipyUrl
                    ? $()
                    : this.renderMessageText(message),
                this.renderGifPreview(message),
            );

            item.append(bubble);

            container.append(item);
        }
    }

    showMessageActionsMenu(message: ClanMessage, x: number, y: number) {
        if (message.type !== "user") return;
        this.hideMessageActionsMenu();
        const isOwnMessage = this.isOwnClanMessage(message);
        const menu = $("<div/>", { class: "clan-chat-actions-menu" });

        menu.append(
            $("<div/>", { class: "clan-chat-actions-item", text: "Reply" }).on(
                "click",
                (e) => {
                    e.stopPropagation();
                    this.startReplyToMessage(message.id);
                    this.hideMessageActionsMenu();
                },
            ),
        );

        if (isOwnMessage) {
            menu.append(
                $("<div/>", { class: "clan-chat-actions-item", text: "Edit" }).on(
                    "click",
                    (e) => {
                        e.stopPropagation();
                        this.startEditMessage(message.id);
                        this.hideMessageActionsMenu();
                    },
                ),
                $("<div/>", {
                    class: "clan-chat-actions-item danger",
                    text: "Delete",
                }).on("click", (e) => {
                    e.stopPropagation();
                    this.deleteClanMessage(message.id);
                    this.hideMessageActionsMenu();
                }),
            );
        }

        $("body").append(menu);
        const menuWidth = menu.outerWidth() || 0;
        const menuHeight = menu.outerHeight() || 0;
        const left = Math.min(x, $(window).width()! - menuWidth - 8);
        const top = Math.min(y, $(window).height()! - menuHeight - 8);
        menu.css({ left, top });
        this.messageActionsMenu = menu;
    }

    hideMessageActionsMenu() {
        this.messageActionsMenu?.remove();
        this.messageActionsMenu = null;
    }

    startReplyToMessage(messageId: string) {
        const message = this.findClanMessage(messageId);
        if (!message) return;
        this.editingMessage = null;
        this.replyingToMessage = message;
        this.renderClanChatComposeContext();
        $("#clan-chat-input").focus();
    }

    startEditMessage(messageId: string) {
        const message = this.findClanMessage(messageId);
        if (!message || !this.isOwnClanMessage(message)) return;
        this.replyingToMessage = null;
        this.editingMessage = message;
        $("#clan-chat-input").val(message.message).focus();
        this.renderClanChatComposeContext();
        this.updateClanChatCounter();
    }

    sendClanMessage() {
        if (!this.viewingClan) return;
        if ($("#btn-clan-chat-send").hasClass("disabled")) return;

        const input = $("#clan-chat-input");
        const message = ((input.val() as string) || "").trim();
        if (!message) return;
        const clanId = this.viewingClan.id;

        $("#btn-clan-chat-send").addClass("disabled");
        if (this.editingMessage) {
            this.saveEditedClanMessage(clanId, this.editingMessage.id, message);
            return;
        }

        clanRequest<SendClanMessageResponse>(
            "/api/clan/send_message",
            {
                clanId,
                message,
                replyToId: this.replyingToMessage?.id,
            },
            (err, res) => {
                $("#btn-clan-chat-send").removeClass("disabled");
                if (!this.viewingClan || this.viewingClan.id !== clanId) {
                    return;
                }
                if (err || !res?.success) {
                    $("#clan-chat-status").text("Message could not be sent.");
                    return;
                }

                input.val("");
                this.replyingToMessage = null;
                this.renderClanChatComposeContext();
                this.updateClanChatCounter();
                this.mergeClanMessages([res.message]);
                this.renderClanMessages();
                const container = $("#clan-chat-messages");
                container.scrollTop(container.prop("scrollHeight") || 0);
                $("#clan-chat-status").text("");
            },
        );
    }

    saveEditedClanMessage(clanId: string, messageId: string, message: string) {
        clanRequest<EditClanMessageResponse>(
            "/api/clan/edit_message",
            { clanId, messageId, message },
            (err, res) => {
                $("#btn-clan-chat-send").removeClass("disabled");
                if (!this.viewingClan || this.viewingClan.id !== clanId) {
                    return;
                }
                if (err || !res?.success) {
                    $("#clan-chat-status").text("Message could not be edited.");
                    return;
                }
                $("#clan-chat-input").val("");
                this.editingMessage = null;
                this.renderClanChatComposeContext();
                this.updateClanChatCounter();
                this.mergeClanMessages([res.message]);
                this.renderClanMessages();
                $("#clan-chat-status").text("");
            },
        );
    }

    deleteClanMessage(messageId: string) {
        if (!this.viewingClan) return;
        const message = this.findClanMessage(messageId);
        if (!message || !this.isOwnClanMessage(message)) return;
        const clanId = this.viewingClan.id;
        clanRequest<DeleteClanMessageResponse>(
            "/api/clan/delete_message",
            { clanId, messageId },
            (err, res) => {
                if (!this.viewingClan || this.viewingClan.id !== clanId) {
                    return;
                }
                if (err || !res?.success) {
                    $("#clan-chat-status").text("Message could not be deleted.");
                    return;
                }
                this.clanMessages = this.clanMessages.filter(
                    (message) => message.id !== res.messageId,
                );
                if (this.replyingToMessage?.id === res.messageId) {
                    this.replyingToMessage = null;
                }
                if (this.editingMessage?.id === res.messageId) {
                    this.editingMessage = null;
                }
                this.renderClanChatComposeContext();
                this.renderClanMessages();
            },
        );
    }

    leaveClan() {
        clanRequest<{ success: boolean }>("/api/clan/leave", {}, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to leave clan.");
                return;
            }

            this.clanPageModal.hide();
            this.currentClan = null;
            this.unreadMentionCount = 0;
            this.stopMentionPolling();
            this.updateMentionBadges();
            this.loadMyClan();
            this.showMainModal();
        });
    }

    kickMember(memberId: string) {
        clanRequest<{ success: boolean }>("/api/clan/kick", { memberId }, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to kick member.");
                return;
            }
            if (this.currentClan) {
                this.loadClanDetail(this.currentClan.id);
            }
        });
    }

    transferOwnership(newOwnerId: string) {
        clanRequest<{ success: boolean }>(
            "/api/clan/transfer",
            { newOwnerId },
            (err, res) => {
                if (err || !res?.success) {
                    this.showError("Failed to transfer ownership.");
                    return;
                }
                if (this.currentClan) {
                    this.loadClanDetail(this.currentClan.id);
                    this.loadMyClan();
                }
            },
        );
    }

    deleteClan() {
        clanRequest<{ success: boolean }>("/api/clan/delete", {}, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to delete clan.");
                return;
            }

            this.clanPageModal.hide();
            this.currentClan = null;
            this.unreadMentionCount = 0;
            this.stopMentionPolling();
            this.updateMentionBadges();
            this.loadMyClan();
            this.showMainModal();
        });
    }

    loadLeaderboard(type: "kills" | "wins", page: number = 1) {
        clanRequest<ClanLeaderboardResponse>(
            "/api/clan/leaderboard",
            {
                type,
                gameMode: this.getSelectedLeaderboardGameMode(),
                page,
                limit: 50,
            },
            (err, res) => {
                if (err || !res) {
                    console.error("Failed to load leaderboard");
                    return;
                }

                this.renderLeaderboard(res.entries, type, res.page, res.totalPages);
            },
        );
    }

    renderLeaderboard(
        entries: ClanLeaderboardEntry[],
        type: "kills" | "wins",
        page: number,
        totalPages: number,
    ) {
        const container = $("#clan-leaderboard-list");
        container.empty();

        if (entries.length === 0) {
            container.append(
                $("<div/>", {
                    class: "clan-leaderboard-empty",
                    text: "No clans found.",
                }),
            );
            return;
        }

        for (const entry of entries) {
            const rankClass = entry.rank <= 3 ? ` rank-${entry.rank}` : "";
            const item = $("<div/>", { class: `clan-leaderboard-item${rankClass}` });

            item.append(
                $("<div/>", {
                    class: "clan-leaderboard-rank",
                    text: `${entry.rank}`,
                }),
            );

            item.append(
                $("<div/>", {
                    class: "clan-leaderboard-icon",
                }).css("background-image", `url(${getClanIconUrl(entry.clan.icon)})`),
            );

            item.append(
                $("<div/>", {
                    class: "clan-leaderboard-info",
                }).append(
                    $("<div/>", {
                        class: "clan-leaderboard-name",
                        text: entry.clan.name,
                    }),
                    $("<div/>", {
                        class: "clan-leaderboard-members",
                        text: `${entry.clan.memberCount} members`,
                    }),
                ),
            );

            item.append(
                $("<div/>", {
                    class: "clan-leaderboard-stat",
                    text:
                        type === "kills"
                            ? entry.clan.totalKills.toLocaleString()
                            : entry.clan.totalWins.toLocaleString(),
                }),
            );

            item.on("click", () => {
                this.leaderboardModal.hide();
                this.showClanPage(entry.clan.id);
            });

            container.append(item);
        }

        if (totalPages > 1) {
            const pagination = $("<div/>", { class: "clan-pagination" });
            if (page > 1) {
                pagination.append(
                    $("<div/>", {
                        class: "clan-btn clan-btn-grey clan-btn-small",
                        text: "Previous",
                    }).on("click", () => this.loadLeaderboard(type, page - 1)),
                );
            }
            pagination.append(
                $("<span/>", {
                    class: "clan-pagination-info",
                    text: `Page ${page} of ${totalPages}`,
                }),
            );
            if (page < totalPages) {
                pagination.append(
                    $("<div/>", {
                        class: "clan-btn clan-btn-grey clan-btn-small",
                        text: "Next",
                    }).on("click", () => this.loadLeaderboard(type, page + 1)),
                );
            }
            container.append(pagination);
        }
    }

    cancelNameEdit() {
        const canEditViewedClan =
            !!this.viewingClan &&
            !!this.account.profile?.slug &&
            this.viewingClan.members.some(
                (m) => m.slug === this.account.profile!.slug && m.isOwner,
            );
        $("#clan-detail-name-edit").hide();
        $("#clan-detail-name").show();
        $("#btn-clan-edit-name").toggle(canEditViewedClan);
    }

    updateClan(updates: { name?: string; icon?: string; tagColor?: string }) {
        clanRequest<UpdateClanResponse>("/api/clan/update", updates, (err, res) => {
            if (err) {
                this.showError("Server error. Please try again.");
                return;
            }

            if (!res?.success) {
                const errorMessages: Record<string, string> = {
                    not_owner: "You are not the owner of this clan.",
                    name_taken: "This clan name is already taken.",
                    invalid_name: "Invalid clan name.",
                    server_error: "Server error. Please try again.",
                };
                this.showError(errorMessages[res?.error || "server_error"]);
                return;
            }
            this.currentClan = res.clan;
            this.viewingClan = res.clan;
            this.renderClanDetail(res.clan);
            this.cancelNameEdit();
            this.updateMainCard();
        });
    }
}
