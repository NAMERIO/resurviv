import $ from "jquery";
import {
    DefaultAmongUsImpostorCount,
    DefaultPrivateLobbyMiniGame,
} from "../../../shared/defs/miniGame";
import { GameConfig, TeamMode } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import type { FindGameMatchData } from "../../../shared/types/api";
import type {
    KlipyGifPickerItem,
    ResolveKlipyGifResponse,
    SearchKlipyGifsResponse,
} from "../../../shared/types/clan";
import type {
    RoomData,
    ServerToClientTeamMsg,
    TeamLobbyChatMsg,
    TeamMenuErrorType,
    TeamPlayGameMsg,
    TeamStateMsg,
} from "../../../shared/types/team";
import { api } from "../api";
import type { AudioManager } from "../audioManager";
import type { ConfigManager } from "../config";
import { device } from "../device";
import { helpers } from "../helpers";
import type { PingTest } from "../pingTest";
import { SDK } from "../sdk/sdk";
import type { SiteInfo } from "../siteInfo";
import type { Localization } from "./localization";

type LobbyChatGifPreview = Extract<ResolveKlipyGifResponse, { success: true }>["gif"];
type LobbyChatGifPickerItem = KlipyGifPickerItem;
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

function lobbyGifRequest<T>(
    url: string,
    data: Record<string, unknown>,
    callback: (err: any, res?: T) => void,
) {
    $.ajax({
        url: api.resolveUrl(url),
        type: "POST",
        timeout: 10 * 1000,
        xhrFields: {
            withCredentials: true,
        },
        headers: {
            "X-Requested-With": "XMLHttpRequest",
        },
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(data),
    })
        .done((res) => callback(null, res))
        .fail((err) => callback(err));
}

function errorTypeToString(type: string, localization: Localization) {
    const typeMap = {
        join_full: localization.translate("index-team-is-full"),
        team_full: localization.translate("index-arena-team-full"),
        spectator_full: localization.translate("index-arena-spectator-full"),
        join_not_found: localization.translate("index-failed-joining-team"),
        game_in_progress: localization.translate("index-game-in-progress"),
        waiting_for_players: localization.translate("game-waiting-for-players"),
        create_failed: localization.translate("index-failed-creating-team"),
        join_failed: localization.translate("index-failed-joining-team"),
        join_game_failed: localization.translate("index-failed-joining-game"),
        lost_conn: localization.translate("index-lost-connection"),
        find_game_error: localization.translate("index-failed-finding-game"),
        find_game_full: localization.translate("index-failed-finding-game"),
        find_game_invalid_protocol: localization.translate("index-invalid-protocol"),
        find_game_invalid_captcha: localization.translate("index-invalid-captcha"),
        arena_cooldown: localization.translate("index-arena-cooldown"),
        arena_round_finished: localization.translate("index-arena-round-finished"),
        arena_need_teams: localization.translate("index-arena-need-teams"),
        br_need_players: localization.translate("game-waiting-for-players"),
        kicked: localization.translate("index-team-kicked"),
        banned: localization.translate("index-ip-banned"),
        behind_proxy: "behind_proxy", // this will get passed to the main app to show a modal
    } as Record<TeamMenuErrorType, string>;
    return typeMap[type as keyof typeof typeMap] || typeMap.lost_conn;
}

export class TeamMenu {
    // Jquery elems
    playBtn = $("#btn-start-team");
    serverWarning = $("#server-warning");
    teamOptions = $(
        "#btn-team-queue-mode-1, #btn-team-queue-mode-2, #btn-team-fill-auto, #btn-team-fill-none",
    );

    serverSelect = $("#team-server-select");
    modeSelect = $<HTMLSelectElement>("#team-mode-select");
    queueMode1 = $("#btn-team-queue-mode-1");
    queueMode2 = $("#btn-team-queue-mode-2");
    fillAuto = $("#btn-team-fill-auto");
    fillNone = $("#btn-team-fill-none");
    typeSummary = $("#team-type-summary");
    fillSummary = $("#team-fill-summary");

    active = false;
    joined = false;
    create = false;
    joiningGame = false;
    ws: WebSocket | null = null;
    keepAliveTimeout = 0;

    // Ui state
    playerData = {};
    roomData = {} as RoomData;
    players: Array<{
        playerId: number;
        inGame: boolean;
        name: string;
        outfit?: string;
        playerIcon?: string;
        clanName?: string;
        clanTagColor?: string;
        isLeader: boolean;
        team?: "A" | "B";
        spectator?: boolean;
        brTeamCode?: string;
    }> = [];
    joinPrefs: {
        preferredTeam?: "A" | "B";
        spectator?: boolean;
        teamCode?: string;
    } = {};

    prevPlayerCount = 0;
    localPlayerId = 0;
    isLeader = true;
    editingName = false;
    displayedInvalidProtocolModal = false;
    arena = false;
    onStateUpdated?: () => void;
    syncedOutfit?: string;
    syncedPlayerIcon?: string;
    lobbyMessages: TeamLobbyChatMsg["data"][] = [];
    lobbyGifPickerSearchTimer: ReturnType<typeof setTimeout> | null = null;
    lobbyGifPickerLoading = false;
    lobbyGifPickerSection = "";
    lobbyGifPreviewCache = new Map<string, LobbyChatGifPreview | null>();
    lobbyGifPreviewPending = new Set<string>();
    lobbyGifStillFrameCache = new Map<string, string | null>();
    lobbyGifImageObserver: IntersectionObserver | null = null;
    observedLobbyGifImages = new Set<HTMLImageElement>();
    battleRoyaleTeamError: TeamMenuErrorType | "" = "";
    battleRoyaleTeamErrorTimeout: ReturnType<typeof setTimeout> | null = null;
    lastJoinGameData: FindGameMatchData | null = null;

    hideUrl!: boolean;

    constructor(
        public config: ConfigManager,
        public pingTest: PingTest,
        public siteInfo: SiteInfo,
        public localization: Localization,
        public audioManager: AudioManager,
        public joinGameCb: (data: FindGameMatchData) => void,
        public leaveCb: (err: string) => void,
    ) {
        // Listen for ui modifications
        this.serverSelect.on("change", () => {
            const e = this.serverSelect.find(":selected").val() as string;
            this.pingTest.start([e]);
            this.setRoomProperty("region", e);
        });
        this.modeSelect.on("change", () => {
            if (!this.isLeader) return;
            const selectedIdx = Number(this.modeSelect.val());
            if (Number.isFinite(selectedIdx)) {
                this.setRoomProperty("gameModeIdx", selectedIdx);
            }
        });
        this.queueMode1.on("click", () => {
            this.setRoomProperty("gameModeIdx", this.findTeamModeIdx(TeamMode.Duo));
        });
        this.queueMode2.on("click", () => {
            this.setRoomProperty("gameModeIdx", this.findTeamModeIdx(TeamMode.Squad));
        });
        this.fillAuto.click(() => {
            this.setRoomProperty("autoFill", true);
        });
        this.fillNone.on("click", () => {
            this.setRoomProperty("autoFill", false);
        });
        this.typeSummary.on("click", () => {
            if (!this.isLeader) return;

            const currentMode = this.getCurrentMode();
            const nextTeamMode =
                currentMode?.teamMode === TeamMode.Squad ? TeamMode.Duo : TeamMode.Squad;
            this.setRoomProperty("gameModeIdx", this.findTeamModeIdx(nextTeamMode));
        });
        this.fillSummary.on("click", () => {
            this.setRoomProperty("autoFill", !this.roomData.autoFill);
        });
        this.playBtn.on("click", () => {
            this.tryStartGame();
        });
        $(document).on("click", "#btn-team-clan-chat-send", () => {
            this.sendLobbyChat();
        });
        $(document).on("keydown", "#team-clan-chat-input", (e) => {
            if (e.which === 13) {
                this.sendLobbyChat();
                return false;
            }
        });
        $(document).on("click", "#btn-team-clan-chat-gif", (e) => {
            e.preventDefault();
            this.toggleLobbyGifPicker();
        });
        $(document).on("click", "#team-clan-chat-gif-picker", (e) => {
            e.stopPropagation();
        });
        $(document).on("input", "#team-clan-chat-gif-search", () => {
            this.scheduleLobbyGifPickerSearch();
        });
        $(document).on("keydown", "#team-clan-chat-gif-search", (e) => {
            if (e.which === 13) {
                this.loadLobbyGifPickerResults();
                return false;
            }
        });
        $(document).on(
            "click",
            "#team-clan-chat-gif-sections .clan-chat-gif-section",
            (e) => {
                const section = String($(e.currentTarget).data("section") || "");
                this.lobbyGifPickerSection = section;
                $("#team-clan-chat-gif-search").val("");
                $("#team-clan-chat-gif-sections .clan-chat-gif-section").removeClass(
                    "active",
                );
                $(e.currentTarget).addClass("active");
                this.loadLobbyGifPickerResults();
            },
        );
        $(document).on("click", "#team-clan-chat-gif-grid .clan-chat-gif-item", (e) => {
            const sourceUrl = $(e.currentTarget).data("source-url") as string | undefined;
            if (sourceUrl) {
                this.sendLobbyGifMessage(sourceUrl);
            }
        });
        $("#team-copy-url, #team-desc-text").on("click", (e) => {
            const t = $("<div/>", {
                class: "copy-toast",
                html: "Copied!",
            });
            $("#start-menu-wrapper").append(t);
            t.css({
                left: e.pageX - parseInt(t.css("width")) / 2,
                top: $("#team-copy-url").offset()!.top,
            });
            t.animate(
                {
                    top: "-=20",
                    opacity: 1,
                },
                {
                    queue: false,
                    duration: 300,
                    complete: function () {
                        $(this).fadeOut(250, function () {
                            $(this).remove();
                        });
                    },
                },
            );
            let codeToCopy = $("#team-url").text();
            // if running on an iframe
            if (window !== window.top) {
                codeToCopy = this.roomData.roomUrl.substring(1);
            }
            helpers.copyTextToClipboard(codeToCopy);
        });

        if (window !== window.top) {
            $("#team-desc-text").hide();
        }

        if (!device.mobile) {
            this.hideUrl = !!this.config.get("teamInviteHidden");
            this.applyInviteCodeVisibility();
            $("#team-hide-url").on("click", (e) => {
                const el = e.currentTarget;
                this.hideUrl = !this.hideUrl;
                this.config.set("teamInviteHidden", this.hideUrl);
                this.applyInviteCodeVisibility(el);
            });
        }

        setInterval(() => {
            if (this.joined) {
                this.sendMessage("keepAlive", {});
            }
        }, 10 * 1000);

        document.addEventListener("visibilitychange", () => {
            if (this.joined && document.visibilityState === "visible") {
                this.sendMessage("keepAlive", {});
            }
        });

        this.config.addModifiedListener((key) => {
            if (key === "loadout") {
                this.syncOutfit();
            }
        });
    }

    getPlayerById(playerId: number) {
        return this.players.find((x) => {
            return x.playerId == playerId;
        });
    }

    applyInviteCodeVisibility(
        toggleEl: HTMLElement | JQuery<HTMLElement> = $("#team-hide-url"),
    ) {
        $("#team-desc-text, #team-code-text").css({
            opacity: this.hideUrl ? 0 : 1,
        });
        $(toggleEl).css({
            "background-image": this.hideUrl
                ? "url(../img/gui/hide.svg)"
                : "url(../img/gui/eye.svg)",
        });
    }

    connect(
        create: boolean,
        roomUrl: string,
        arena = false,
        joinPrefs?: {
            preferredTeam?: "A" | "B";
            spectator?: boolean;
            teamCode?: string;
        },
    ) {
        const shouldReconnect =
            !this.active ||
            roomUrl !== this.roomData.roomUrl ||
            create !== this.create ||
            arena !== this.arena ||
            !this.joined ||
            !this.ws ||
            this.ws.readyState === WebSocket.CLOSING ||
            this.ws.readyState === WebSocket.CLOSED;

        if (shouldReconnect) {
            const roomHost = api.resolveRoomHost();
            const url = `w${
                window.location.protocol === "https:" ? "ss" : "s"
            }://${roomHost}/team_v2`;
            this.active = true;
            this.joined = false;
            this.create = create;
            this.arena = arena;
            this.joiningGame = false;
            this.editingName = false;
            this.joinPrefs = joinPrefs || {};
            this.syncedOutfit = undefined;
            this.syncedPlayerIcon = undefined;
            this.lobbyMessages = [];
            this.lastJoinGameData = null;
            this.hideLobbyGifPicker();

            // Load properties from config
            this.playerData = {
                name: this.config.get("playerName"),
            };
            this.roomData = {
                roomUrl,
                region: this.config.get("region")!,
                gameModeIdx: this.config.get("gameModeIdx")!,
                autoFill: arena ? false : this.config.get("teamAutoFill")!,
                arena,
                teamsLocked: false,
                miniGame: this.roomData.miniGame || DefaultPrivateLobbyMiniGame,
                amongUsImpostorCount:
                    this.roomData.amongUsImpostorCount || DefaultAmongUsImpostorCount,
                disableAirstrikes: !!this.roomData.disableAirstrikes,
                disablePerks: !!this.roomData.disablePerks,
                findingGame: false,
                lastError: "",
            } as RoomData;
            const loadout = this.config.get("loadout");
            this.displayedInvalidProtocolModal = false;

            this.refreshUi();
            this.onStateUpdated?.();

            if (this.ws) {
                this.ws.onclose = function () {};
                this.ws.close();
                this.ws = null;
            }

            try {
                this.ws = new WebSocket(url);
                this.ws.onerror = (_e) => {
                    this.ws?.close();
                };
                this.ws.onclose = () => {
                    let errMsg = "";
                    if (!this.joiningGame) {
                        errMsg = this.joined
                            ? "lost_conn"
                            : this.create
                              ? "create_failed"
                              : "join_failed";
                    }
                    this.leave(errMsg);
                };
                this.ws.onopen = () => {
                    this.syncedOutfit = loadout?.outfit;
                    this.syncedPlayerIcon = loadout?.player_icon;
                    if (this.create) {
                        this.sendMessage("create", {
                            arena: this.arena,
                            roomData: this.roomData,
                            playerData: {
                                ...this.playerData,
                                outfit: loadout?.outfit,
                                playerIcon: loadout?.player_icon,
                            },
                        });
                    } else {
                        this.sendMessage("join", {
                            roomUrl: this.roomData.roomUrl,
                            arena: this.arena,
                            preferredTeam: this.joinPrefs.preferredTeam,
                            spectator: this.joinPrefs.spectator,
                            teamCode: this.joinPrefs.teamCode,
                            playerData: {
                                ...this.playerData,
                                outfit: loadout?.outfit,
                                playerIcon: loadout?.player_icon,
                            },
                        });
                    }
                };
                this.ws.onmessage = (e) => {
                    if (this.active) {
                        const msg = JSON.parse(e.data);
                        this.onMessage(msg.type, msg.data);
                    }
                };
            } catch (_e) {
                this.leave(this.create ? "create_failed" : "join_failed");
            }
        }
    }

    leave(errType = "") {
        if (this.active) {
            this.ws?.close();
            this.ws = null;
            this.active = false;
            this.joined = false;
            this.joiningGame = false;
            this.arena = false;
            this.joinPrefs = {};
            this.lastJoinGameData = null;
            if (this.battleRoyaleTeamErrorTimeout) {
                clearTimeout(this.battleRoyaleTeamErrorTimeout);
                this.battleRoyaleTeamErrorTimeout = null;
            }
            this.battleRoyaleTeamError = "";
            this.lobbyMessages = [];
            this.hideLobbyGifPicker();
            this.refreshUi();
            this.onStateUpdated?.();

            // Save state to config for the menu
            this.config.set("gameModeIdx", this.roomData.gameModeIdx);
            this.config.set("teamAutoFill", this.roomData.autoFill);
            if (this.isLeader) {
                this.config.set("region", this.roomData.region);
            }
            let errTxt = "";
            if (errType && errType != "") {
                errTxt = errorTypeToString(errType, this.localization);
            }
            this.leaveCb(errTxt);

            SDK.hideInviteButton();
        }
    }

    onGameComplete() {
        if (this.active) {
            this.joiningGame = false;
            this.roomData.findingGame = false;
            this.roomData.lastError = "";
            this.lastJoinGameData = null;
            const localPlayer = this.getPlayerById(this.localPlayerId);
            if (localPlayer) {
                localPlayer.inGame = false;
            }
            this.refreshUi();
            this.onStateUpdated?.();
            this.sendMessage("gameComplete");
        }
    }

    onMessage<T extends ServerToClientTeamMsg["type"]>(
        type: T,
        data: ServerToClientTeamMsg["data"],
    ) {
        switch (type) {
            case "state": {
                let stateData = data as TeamStateMsg["data"];
                this.joined = true;
                const ourRoomData = this.roomData;
                this.roomData = stateData.room;
                this.players = stateData.players;
                this.localPlayerId = stateData.localPlayerId;
                this.isLeader = this.getPlayerById(this.localPlayerId)!.isLeader;
                if (
                    this.isBattleRoyaleRoom() &&
                    !this.roomData.findingGame &&
                    !this.players.some((player) => player.inGame)
                ) {
                    this.lastJoinGameData = null;
                }
                if (this.getPlayerById(this.localPlayerId)?.brTeamCode) {
                    this.battleRoyaleTeamError = "";
                }

                // Override room properties with local values if we're
                // the leader; otherwise, the server may override a
                // recent change.
                //
                // A better solution here would be just a sequence
                // number and we can ignore updates that don't include our
                // most recent change request.
                if (this.isLeader) {
                    this.roomData.region = ourRoomData.region;
                    this.roomData.gameModeIdx = ourRoomData.gameModeIdx;
                    this.roomData.autoFill = ourRoomData.autoFill;
                    this.roomData.teamsLocked = ourRoomData.teamsLocked;
                    this.roomData.miniGame = ourRoomData.miniGame;
                    this.roomData.amongUsImpostorCount = ourRoomData.amongUsImpostorCount;
                    this.roomData.disableAirstrikes = ourRoomData.disableAirstrikes;
                    this.roomData.disablePerks = ourRoomData.disablePerks;
                }
                this.refreshUi();
                this.onStateUpdated?.();
                // Since the only way to get the roomID (ig?) is from state, each time receiving state, we can show the invite button
                const inviteRoomId = this.arena
                    ? `a:${stateData.room.roomUrl.replace("#", "")}`
                    : stateData.room.roomUrl.replace("#", "");
                SDK.showInviteButton(inviteRoomId);
                break;
            }
            case "joinGame":
                this.joiningGame = true;
                this.lastJoinGameData = data as FindGameMatchData;
                this.joinGameCb(this.lastJoinGameData);
                break;
            case "keepAlive":
                break;
            case "lobbyChat":
                this.addLobbyMessage(data as TeamLobbyChatMsg["data"]);
                break;
            case "kicked":
                this.leave("kicked");
                break;
            case "error":
                if (
                    this.joined &&
                    this.arena &&
                    ["team_full", "join_not_found"].includes(
                        (data as { type: TeamMenuErrorType }).type,
                    )
                ) {
                    this.battleRoyaleTeamError = (
                        data as {
                            type: TeamMenuErrorType;
                        }
                    ).type;
                    this.refreshUi();
                    this.onStateUpdated?.();
                    if (this.battleRoyaleTeamErrorTimeout) {
                        clearTimeout(this.battleRoyaleTeamErrorTimeout);
                    }
                    this.battleRoyaleTeamErrorTimeout = setTimeout(() => {
                        this.battleRoyaleTeamError = "";
                        this.battleRoyaleTeamErrorTimeout = null;
                        this.refreshUi();
                        this.onStateUpdated?.();
                    }, 3000);
                    break;
                }
                this.leave((data as { type: string }).type);
        }
    }

    getLocalPlayer() {
        return this.getPlayerById(this.localPlayerId);
    }

    toggleLobbyGifPicker() {
        if ($("#team-clan-chat-gif-picker").is(":visible")) {
            this.hideLobbyGifPicker();
            return;
        }
        this.showLobbyGifPicker();
    }

    showLobbyGifPicker() {
        if (!this.joined || !this.arena) return;
        $("#team-clan-chat-gif-picker").show();
        $("#btn-team-clan-chat-gif").addClass("active");
        $("#team-clan-chat-gif-search").focus();
        if ($("#team-clan-chat-gif-grid").children().length === 0) {
            this.loadLobbyGifPickerResults();
        }
    }

    hideLobbyGifPicker() {
        $("#team-clan-chat-gif-picker").hide();
        $("#btn-team-clan-chat-gif").removeClass("active");
        this.unloadLobbyGifImages($("#team-clan-chat-gif-grid")[0]);
    }

    scheduleLobbyGifPickerSearch() {
        if (this.lobbyGifPickerSearchTimer) {
            clearTimeout(this.lobbyGifPickerSearchTimer);
        }
        this.lobbyGifPickerSearchTimer = setTimeout(() => {
            this.loadLobbyGifPickerResults();
        }, 250);
    }

    loadLobbyGifPickerResults() {
        if (!this.joined || !this.arena || this.lobbyGifPickerLoading) return;

        const query = (($("#team-clan-chat-gif-search").val() as string) || "").trim();
        const grid = $("#team-clan-chat-gif-grid");
        const adMaxWidth = Math.max(50, Math.round(grid.outerWidth() || 280));
        this.lobbyGifPickerLoading = true;
        $("#team-clan-chat-gif-status").text("Loading GIFs...");

        lobbyGifRequest<SearchKlipyGifsResponse>(
            "/api/clan/search_lobby_klipy_gifs",
            {
                query: query || undefined,
                section: query ? undefined : this.lobbyGifPickerSection || undefined,
                limit: 24,
                adMaxWidth,
                adMaxHeight: 250,
            },
            (err, res) => {
                this.lobbyGifPickerLoading = false;
                if (err || !res?.success) {
                    $("#team-clan-chat-gif-grid").empty();
                    $("#team-clan-chat-gif-status").text(
                        res?.success === false && res.error === "not_configured"
                            ? "Klipy API key is not configured."
                            : "GIFs could not be loaded.",
                    );
                    return;
                }

                this.renderLobbyGifPickerResults(res.gifs);
            },
        );
    }

    renderLobbyGifPickerResults(gifs: LobbyChatGifPickerItem[]) {
        const grid = $("#team-clan-chat-gif-grid");
        this.unobserveLobbyGifImages(grid[0]);
        grid.empty();

        for (const [index, gif] of gifs.entries()) {
            if (gif.type === "ad") {
                grid.append(this.renderLobbyGifPickerAd(gif));
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
                        this.createLobbyLazyGifImage({
                            class: "clan-chat-gif-thumb",
                            src: gif.url,
                            alt: gif.title,
                            eager: index < 4,
                        }),
                    ),
            );
        }

        $("#team-clan-chat-gif-status").text(gifs.length === 0 ? "No GIFs found." : "");
    }

    renderLobbyGifPickerAd(ad: Extract<LobbyChatGifPickerItem, { type: "ad" }>) {
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

    addLobbyMessage(message: TeamLobbyChatMsg["data"]) {
        const duplicateOwnMessage = this.lobbyMessages.some((existing) => {
            return (
                message.playerId === this.localPlayerId &&
                existing.playerId === this.localPlayerId &&
                existing.playerId === message.playerId &&
                existing.message === message.message &&
                Math.abs(existing.timestamp - message.timestamp) < 3000
            );
        });
        if (duplicateOwnMessage) {
            return;
        }

        this.lobbyMessages.push(message);
        if (this.lobbyMessages.length > 80) {
            this.lobbyMessages.splice(0, this.lobbyMessages.length - 80);
        }
        this.renderLobbyChat();
    }

    sendLobbyChat() {
        const input = $("#team-clan-chat-input");
        const message = String(input.val() || "").trim();
        if (!message) return;

        input.val("");

        const localPlayer = this.getLocalPlayer();
        const fallbackName = String(
            (this.playerData as { name?: string }).name ||
                this.config.get("playerName") ||
                "Player",
        );
        const fallbackLoadout = this.config.get("loadout");

        this.addLobbyMessage({
            playerId: localPlayer?.playerId ?? this.localPlayerId,
            name: localPlayer?.name || fallbackName,
            playerIcon: localPlayer?.playerIcon || fallbackLoadout?.player_icon,
            clanName: localPlayer?.clanName,
            clanTagColor: localPlayer?.clanTagColor,
            message,
            timestamp: Date.now(),
        });

        if (this.active && this.joined && this.arena) {
            this.sendMessage("lobbyChat", { message });
        }
    }

    renderLobbyChat() {
        const chat = $("#team-clan-chat");
        const messages = $("#team-clan-chat-messages");
        const status = $("#team-clan-chat-status");
        const input = $("#team-clan-chat-input");
        const send = $("#btn-team-clan-chat-send");
        const gif = $("#btn-team-clan-chat-gif");
        const visible =
            this.joined && this.arena
                ? true
                : chat.closest("#modal-prestige-arena.is-open").length > 0;

        chat.css("display", visible ? "flex" : "none");
        input.prop("disabled", !visible);
        send.prop("disabled", !visible);
        gif.prop("disabled", !visible);
        send.toggleClass("btn-disabled btn-opaque", !visible);
        gif.toggleClass("btn-disabled", !visible);
        if (!visible) {
            this.hideLobbyGifPicker();
        }
        status.text("Everyone in this private lobby can see these messages.");

        this.unobserveLobbyGifImages(messages[0]);
        messages.empty();
        if (this.lobbyMessages.length === 0) {
            messages.append(
                $("<div/>", {
                    class: "team-clan-chat-empty",
                    text: "No lobby messages yet.",
                }),
            );
            return;
        }

        for (const msg of this.lobbyMessages) {
            const isOwn = msg.playerId === this.localPlayerId;
            const tag = msg.clanName
                ? `${helpers.getClanTagHtml(msg.clanName, msg.clanTagColor || "")} `
                : "";
            const item = $("<div/>", {
                class: `team-clan-chat-message${isOwn ? " own" : ""}`,
            });
            const playerIcon =
                helpers.getSvgFromGameType(msg.playerIcon || "emote_surviv") ||
                "img/gui/player-gui.svg";
            item.append(
                $("<div/>", {
                    class: "team-clan-chat-avatar",
                }).css("background-image", `url(${playerIcon})`),
                $("<div/>", { class: "team-clan-chat-bubble" }).append(
                    $("<div/>", {
                        class: "team-clan-chat-meta",
                        html: `${tag}${helpers.htmlEscape(msg.name)}`,
                    }),
                    $("<div/>", {
                        class: "team-clan-chat-text",
                        text: msg.message,
                    }).toggle(!isOnlyKlipyUrl(msg.message)),
                    this.renderLobbyGifPreview(msg.message),
                ),
            );
            messages.append(item);
        }
        messages.scrollTop(messages.prop("scrollHeight"));
    }

    createLobbyLazyGifImage(options: {
        class: string;
        src: string;
        alt: string;
        eager?: boolean;
    }) {
        const image = $("<img/>", {
            class: `${options.class} clan-chat-lazy-gif`,
            src: options.eager ? this.resolveLobbyImageSrc(options.src) : blankGifSrc,
            alt: options.alt,
            loading: options.eager ? "eager" : "lazy",
            crossOrigin: "anonymous",
        }).on("load", (e) => {
            this.cacheLobbyGifStillFrame(e.currentTarget as HTMLImageElement);
        });
        image.data("gif-src", this.resolveLobbyImageSrc(options.src));
        if (!options.eager) {
            this.observeLobbyGifImage(image[0] as HTMLImageElement);
        }
        return image;
    }

    resolveLobbyImageSrc(src: string) {
        try {
            return new URL(src, window.location.href).toString();
        } catch {
            return src;
        }
    }

    cacheLobbyGifStillFrame(image: HTMLImageElement) {
        const gifSrc = $(image).data("gif-src") as string | undefined;
        if (!gifSrc || image.src !== gifSrc || this.lobbyGifStillFrameCache.has(gifSrc)) {
            return;
        }

        const stillFrame = this.captureLobbyGifStillFrame(image);
        this.lobbyGifStillFrameCache.set(gifSrc, stillFrame);
    }

    captureLobbyGifStillFrame(image: HTMLImageElement) {
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

    pauseLobbyGifImage(image: HTMLImageElement) {
        const gifSrc = $(image).data("gif-src") as string | undefined;
        if (!gifSrc || image.src !== gifSrc) return;

        const cachedStillFrame = this.lobbyGifStillFrameCache.get(gifSrc);
        if (cachedStillFrame) {
            image.src = cachedStillFrame;
            return;
        }

        const stillFrame = this.captureLobbyGifStillFrame(image);
        this.lobbyGifStillFrameCache.set(gifSrc, stillFrame);
        if (stillFrame) {
            image.src = stillFrame;
        }
    }

    getLobbyGifImageObserver() {
        if (!("IntersectionObserver" in window)) return null;
        if (!this.lobbyGifImageObserver) {
            this.lobbyGifImageObserver = new IntersectionObserver(
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
                            this.pauseLobbyGifImage(image);
                        }
                    }
                },
                { root: null, rootMargin: "80px 0px", threshold: 0 },
            );
        }
        return this.lobbyGifImageObserver;
    }

    observeLobbyGifImage(image: HTMLImageElement) {
        const observer = this.getLobbyGifImageObserver();
        if (!observer) {
            const gifSrc = $(image).data("gif-src") as string | undefined;
            if (gifSrc) image.src = gifSrc;
            return;
        }

        this.observedLobbyGifImages.add(image);
        observer.observe(image);
    }

    unobserveLobbyGifImages(root?: HTMLElement) {
        if (!this.lobbyGifImageObserver) return;

        for (const image of Array.from(this.observedLobbyGifImages)) {
            if (root && !root.contains(image)) continue;
            this.lobbyGifImageObserver.unobserve(image);
            this.observedLobbyGifImages.delete(image);
        }
    }

    unloadLobbyGifImages(root?: HTMLElement) {
        for (const image of Array.from(this.observedLobbyGifImages)) {
            if (root && !root.contains(image)) continue;
            this.pauseLobbyGifImage(image);
        }
    }

    sendLobbyGifMessage(sourceUrl: string) {
        if (sourceUrl.length > 300) {
            $("#team-clan-chat-status").text("That GIF link is too long to send.");
            return;
        }

        $("#team-clan-chat-input").val(sourceUrl);
        this.hideLobbyGifPicker();
        this.sendLobbyChat();
    }

    renderLobbyGifPreview(message: string) {
        const gifUrl = findKlipyUrl(message);
        if (!gifUrl) return $();

        const preview = $("<a/>", {
            class: "clan-chat-gif-preview loading",
            href: gifUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "Open GIF",
            "data-gif-url": gifUrl,
        }).append(
            $("<div/>", {
                class: "clan-chat-gif-placeholder",
                text: "Loading GIF...",
            }),
        );

        const cachedGif = this.lobbyGifPreviewCache.get(gifUrl);
        if (cachedGif === null) {
            return this.fillLobbyGifFallback(preview);
        }
        if (cachedGif) {
            return this.fillLobbyGifPreview(preview, cachedGif);
        }
        if (this.lobbyGifPreviewPending.has(gifUrl)) {
            return preview;
        }

        this.lobbyGifPreviewPending.add(gifUrl);
        lobbyGifRequest<ResolveKlipyGifResponse>(
            "/api/clan/resolve_lobby_klipy_gif",
            { url: gifUrl },
            (err, res) => {
                this.lobbyGifPreviewPending.delete(gifUrl);
                if (err || !res?.success) {
                    this.lobbyGifPreviewCache.set(gifUrl, null);
                    this.fillCurrentLobbyGifPreviews(gifUrl);
                    return;
                }

                this.lobbyGifPreviewCache.set(gifUrl, res.gif);
                this.fillCurrentLobbyGifPreviews(gifUrl);
            },
        );

        return preview;
    }

    fillCurrentLobbyGifPreviews(gifUrl: string) {
        const cachedGif = this.lobbyGifPreviewCache.get(gifUrl);
        const previews = $("#team-clan-chat-messages .clan-chat-gif-preview").filter(
            (_index, element) => $(element).attr("data-gif-url") === gifUrl,
        );

        previews.each((_index, element) => {
            const preview = $(element);
            if (cachedGif) {
                this.fillLobbyGifPreview(preview, cachedGif);
            } else {
                this.fillLobbyGifFallback(preview);
            }
        });
    }

    fillLobbyGifFallback(preview: JQuery<HTMLElement>) {
        preview.removeClass("loading");
        preview.empty().append(
            $("<div/>", {
                class: "clan-chat-gif-placeholder",
                text: "Open GIF",
            }),
        );
        return preview;
    }

    fillLobbyGifPreview(preview: JQuery<HTMLElement>, gif: LobbyChatGifPreview) {
        preview.removeClass("loading");
        preview.empty().append(
            this.createLobbyLazyGifImage({
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

    sendMessage(type: string, data?: unknown) {
        if (this.ws) {
            if (this.ws.readyState === this.ws.OPEN) {
                const msg = JSON.stringify({
                    type,
                    data,
                });
                this.ws.send(msg);
            } else {
                this.ws.close();
            }
        }
    }

    syncOutfit() {
        if (!this.active || !this.joined) {
            return;
        }

        const loadout = this.config.get("loadout");
        const outfit = loadout?.outfit;
        const playerIcon = loadout?.player_icon;
        if (this.syncedOutfit === outfit && this.syncedPlayerIcon === playerIcon) {
            return;
        }

        this.syncedOutfit = outfit;
        this.syncedPlayerIcon = playerIcon;
        this.sendMessage("changeOutfit", {
            outfit,
            playerIcon,
        });
    }

    setRoomProperty<T extends keyof RoomData>(prop: T, val: RoomData[T] | undefined) {
        if (val === undefined) {
            return;
        }
        if (this.arena && prop === "autoFill") {
            return;
        }
        if (this.isLeader && this.roomData[prop] != val) {
            this.roomData[prop] = val;
            this.sendMessage("setRoomProps", this.roomData);
        }
    }

    kickPlayer(playerId: number) {
        if (!this.isLeader) return;
        this.sendMessage("kick", {
            playerId,
        });
    }

    swapPlayerTeam(playerId: number, team: "A" | "B" | "spectator") {
        if (!this.arena) return;
        const player = this.getPlayerById(playerId);
        if (!player) return;
        if (team === "spectator") {
            if (player.spectator) return;
        } else if (!player.spectator && player.team === team) {
            return;
        }
        this.sendMessage("swapTeam", {
            playerId,
            team,
        });
    }

    createBattleRoyaleTeam() {
        if (!this.joined || !this.arena) return;
        this.sendMessage("createBattleRoyaleTeam", {});
    }

    joinBattleRoyaleTeam(teamCode: string) {
        if (!this.joined || !this.arena) return;
        this.battleRoyaleTeamError = "";
        this.sendMessage("joinBattleRoyaleTeam", {
            teamCode,
        });
    }

    joinCurrentArenaGame() {
        if (!this.joined || !this.arena || !this.isBattleRoyaleRoom()) return;
        if (!this.roomData.findingGame && !this.players.some((player) => player.inGame)) {
            return;
        }
        this.sendMessage("joinCurrentArenaGame", {});
    }

    isBattleRoyaleRoom() {
        const mode = this.siteInfo.info.modes?.[this.roomData.gameModeIdx];
        return !!mode?.mapName.startsWith("br_");
    }

    getCurrentMode() {
        return this.siteInfo.info.modes?.[this.roomData.gameModeIdx];
    }

    getModeBaseName(mapName: string) {
        return mapName.startsWith("br_") ? mapName.slice(3) : mapName;
    }

    findMatchingModeIdx(opts: { battleRoyale?: boolean; teamMode?: number }) {
        const currentMode = this.getCurrentMode();
        if (!currentMode) return undefined;

        const currentBaseName = this.getModeBaseName(currentMode.mapName);
        const currentBattleRoyale = currentMode.mapName.startsWith("br_");
        const battleRoyale = opts.battleRoyale ?? currentBattleRoyale;
        const teamMode = opts.teamMode ?? currentMode.teamMode;

        return this.roomData.enabledGameModeIdxs.find((idx) => {
            const mode = this.siteInfo.info.modes?.[idx];
            if (!mode) return false;
            return (
                this.getModeBaseName(mode.mapName) === currentBaseName &&
                mode.mapName.startsWith("br_") === battleRoyale &&
                mode.teamMode === teamMode
            );
        });
    }

    findTeamModeIdx(teamMode: TeamMode) {
        return this.findMatchingModeIdx({ teamMode });
    }

    getBattleModeIdx(battleRoyale: boolean) {
        return this.findMatchingModeIdx({ battleRoyale });
    }

    getInviteXpBoost(slotIdx: number) {
        const boosts = [0, 10, 20, 50];
        return boosts[Math.min(slotIdx, boosts.length - 1)];
    }

    getSquadBoost() {
        return this.getInviteXpBoost(Math.max(0, this.players.length - 1));
    }

    getTeamModeDisplayName(teamMode?: number) {
        switch (teamMode) {
            case TeamMode.Squad:
                return "Squad";
            case TeamMode.Duo:
                return "Duo";
            case TeamMode.Solo:
                return "Solo";
            default:
                return "Squad";
        }
    }

    tryStartGame() {
        if (!this.roomData.findingGame) {
            const isBattleRoyaleRoom = this.isBattleRoyaleRoom();
            if (isBattleRoyaleRoom) {
                if (!this.isLeader) return;
                if (this.players.some((player) => player.inGame)) {
                    this.roomData.lastError = "waiting_for_players";
                    this.refreshUi();
                    return;
                }
            }
            const version = GameConfig.protocolVersion;
            let region = this.roomData.region;
            const paramRegion = helpers.getParameterByName("region");
            if (paramRegion !== undefined && paramRegion.length > 0) {
                region = paramRegion;
            }
            let zones = this.pingTest.getZones(region);
            const paramZone = helpers.getParameterByName("zone");
            if (paramZone !== undefined && paramZone.length > 0) {
                zones = [paramZone];
            }
            const matchArgs: TeamPlayGameMsg["data"] = {
                version,
                region,
                zones,
            };

            if (this.arena) {
                this.roomData.autoFill = false;
            }

            helpers.verifyTurnstile(this.roomData.captchaEnabled, (token) => {
                matchArgs.turnstileToken = token;
                this.sendMessage("playGame", matchArgs);
            });
            this.roomData.findingGame = true;
            this.roomData.lastError = "";
            this.refreshUi();
        }
    }

    refreshUi() {
        const setButtonState = function (
            el: JQuery<HTMLElement>,
            selected: boolean,
            enabled: boolean,
        ) {
            el.removeClass("btn-darken btn-disabled btn-opaque btn-hollow-selected");
            if (enabled) {
                el.addClass("btn-darken");
            } else {
                el.addClass("btn-disabled");
                if (!selected) {
                    el.addClass("btn-opaque");
                }
            }
            if (selected) {
                el.addClass("btn-hollow-selected");
            }
            el.prop("disabled", !enabled);
        };
        const showLegacyTeamMenu = this.active && !this.arena;
        $("#team-menu").css("display", showLegacyTeamMenu ? "block" : "none");
        $("#start-menu").css("display", showLegacyTeamMenu ? "none" : "flex");
        $("#right-column").css("display", showLegacyTeamMenu ? "none" : "block");
        $("#social-share-block").css("display", showLegacyTeamMenu ? "none" : "block");

        // Error text
        const hasError = this.roomData.lastError != "";
        const errorTxt = errorTypeToString(this.roomData.lastError, this.localization);
        this.serverWarning.css("opacity", hasError ? 1 : 0);
        this.serverWarning.html(errorTxt);

        if (
            this.roomData.lastError == "find_game_invalid_protocol" &&
            !this.displayedInvalidProtocolModal
        ) {
            $("#modal-refresh").fadeIn(200);
            this.displayedInvalidProtocolModal = true;
        }

        // Set captcha to enabled if we fail the captcha
        // This can happen if it was disabled when the page loaded which would meant it was sending an empty token
        // And we only fetch the state when the page loads...
        if (this.roomData.lastError === "find_game_invalid_captcha") {
            this.siteInfo.info.captchaEnabled = true;
        }

        // Show/hide team connecting/contents
        if (this.active) {
            $("#team-menu-joining-text").css("display", this.create ? "none" : "block");
            $("#team-menu-creating-text").css("display", this.create ? "block" : "none");
            $("#team-menu-connecting").css("display", this.joined ? "none" : "block");
            $("#team-menu-contents").css("display", this.joined ? "block" : "none");
            $("#btn-team-leave, #btn-team-close").css(
                "display",
                this.joined ? "block" : "none",
            );
        }

        if (this.joined) {
            this.renderLobbyChat();

            // Regions
            const regionPops = this.siteInfo.info.pops || {};
            const regions = Object.keys(regionPops);
            for (let i = 0; i < regions.length; i++) {
                const region = regions[i];
                const count = regionPops[region].playerCount;
                const players = this.localization.translate("index-players");
                const sel = $("#team-server-opts").children(`option[value="${region}"]`);
                sel.html(`${sel.attr("data-label")} [${count} ${players}]`);
            }

            this.serverSelect.find("option").each((_idx, ele) => {
                ele.selected = ele.value == this.roomData.region;
            });

            // Populate mode select
            const enabledModes = this.roomData.enabledGameModeIdxs || [];
            this.modeSelect.empty();
            for (const modeIdx of enabledModes) {
                const mode = this.siteInfo.info.modes?.[modeIdx];
                if (mode) {
                    const label = this.siteInfo.getModeLabel(mode.mapName, mode.teamMode);
                    this.modeSelect.append(
                        $("<option>", {
                            value: String(modeIdx),
                            text: label,
                        }),
                    );
                }
            }
            this.modeSelect.val(String(this.roomData.gameModeIdx));
            this.modeSelect.prop("disabled", !this.isLeader);

            // Modes btns
            const duoModeIdx = this.findTeamModeIdx(TeamMode.Duo);
            const squadModeIdx = this.findTeamModeIdx(TeamMode.Squad);
            setButtonState(
                this.queueMode1,
                this.roomData.gameModeIdx === duoModeIdx,
                this.isLeader && duoModeIdx !== undefined,
            );
            setButtonState(
                this.queueMode2,
                this.roomData.gameModeIdx === squadModeIdx,
                this.isLeader && squadModeIdx !== undefined,
            );

            // Fill mode
            if (this.arena) {
                this.roomData.autoFill = false;
            }
            setButtonState(this.fillAuto, this.roomData.autoFill, this.isLeader);
            setButtonState(this.fillNone, !this.roomData.autoFill, this.isLeader);
            const fillVisible = !this.arena;
            this.fillAuto.css("display", fillVisible ? "block" : "none");
            this.fillNone.css("display", fillVisible ? "block" : "none");
            $("#team-fill-summary, #team-fill-note").css(
                "display",
                fillVisible ? "flex" : "none",
            );
            this.serverSelect.prop("disabled", !this.isLeader);
            const mode = this.siteInfo.info.modes?.[this.roomData.gameModeIdx];

            const nextTeamMode =
                mode?.teamMode === TeamMode.Squad ? TeamMode.Duo : TeamMode.Squad;
            const canSwitchTeamMode =
                this.isLeader && this.findTeamModeIdx(nextTeamMode) !== undefined;
            this.typeSummary
                .toggleClass("btn-disabled btn-opaque", !canSwitchTeamMode)
                .toggleClass("btn-darken", canSwitchTeamMode);
            this.fillSummary
                .toggleClass("btn-disabled btn-opaque", !this.isLeader)
                .toggleClass("btn-darken", this.isLeader);

            $("#team-boost-value").text(`${this.getSquadBoost()}%`);
            const teamModeName = this.getTeamModeDisplayName(mode?.teamMode);
            $("#team-type-name").text(teamModeName);
            $("#team-type-icon").css({
                "background-image":
                    mode?.teamMode === TeamMode.Duo
                        ? "url(/img/ui/duo-player.svg)"
                        : mode?.teamMode === TeamMode.Solo
                          ? "url(/img/ui/player.svg)"
                          : "url(/img/ui/squad-player.svg)",
            });
            $("#team-fill-summary-label").text(
                `Auto Fill ${this.roomData.autoFill ? "ON" : "OFF"}`,
            );

            // Invite link
            if (this.roomData.roomUrl) {
                const roomCode = this.roomData.roomUrl.substring(1);
                $("#team-code").text(roomCode);
                const inviteRoomId = this.arena ? `a:${roomCode}` : roomCode;

                if (SDK.supportsInviteLink()) {
                    SDK.getInviteLink(inviteRoomId).then((sdkUrl) => {
                        $("#team-url").text(sdkUrl!);
                    });
                } else {
                    const roomUrl = new URL(window.location.href);
                    roomUrl.search = ""; // removes ?t=<timestamp> that is set when the client receives an invalid protocol error
                    roomUrl.hash = this.roomData.roomUrl;

                    const url = new URL(window.location.href);
                    url.search = this.arena ? "?arena" : "";
                    url.hash = this.roomData.roomUrl;

                    $("#team-url").text(url.toString());

                    if (window.history) {
                        const historyPath = this.arena
                            ? `/?arena${this.roomData.roomUrl}`
                            : this.roomData.roomUrl;
                        const nextUrl = new URL(historyPath, window.location.href);
                        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                        const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
                        if (currentPath !== nextPath) {
                            window.history.replaceState("", "", historyPath);
                        }
                    }
                }
            }
            this.applyInviteCodeVisibility();

            // Play button
            this.playBtn.html(
                this.roomData.findingGame || this.joiningGame
                    ? '<div class="ui-spinner"></div>'
                    : this.playBtn.attr("data-label")!,
            );

            const gameModeStyles = this.siteInfo.getGameModeStyles();
            for (let i = 0; i < gameModeStyles.length; i++) {
                this.playBtn.removeClass(gameModeStyles[i].buttonCss);
            }
            const style = gameModeStyles[this.roomData.gameModeIdx];
            if (style) {
                this.playBtn.addClass("btn-custom-mode-no-indent");
                this.playBtn.addClass(style.buttonCss);
                this.playBtn.css({
                    "background-image": style.icon ? `url(${style.icon})` : "",
                });
            } else {
                this.playBtn.css({
                    "background-image": "",
                });
            }
            let playersInGame = false;
            for (let i = 0; i < this.players.length; i++) {
                playersInGame = playersInGame || this.players[i].inGame;
            }

            const waitReason = $("#msg-wait-reason");
            const isBattleRoyaleRoom = this.isBattleRoyaleRoom();
            const battleRoyaleStartBlocked =
                isBattleRoyaleRoom && (!this.isLeader || playersInGame);
            this.playBtn
                .toggleClass("btn-disabled btn-opaque", battleRoyaleStartBlocked)
                .toggleClass("btn-darken", !battleRoyaleStartBlocked);

            if (isBattleRoyaleRoom && !this.isLeader) {
                if (this.roomData.findingGame || this.joiningGame) {
                    waitReason.html(
                        `<div class="ui-spinner" style="margin-right:16px"></div>${this.localization.translate(
                            "index-joining-game",
                        )}<span> ...</span>`,
                    );
                } else if (playersInGame) {
                    waitReason.html(
                        `${this.localization.translate(
                            "game-waiting-for-players",
                        )}<span> ...</span>`,
                    );
                } else {
                    waitReason.html(
                        `${this.localization.translate(
                            "index-waiting-for-leader",
                        )}<span> ...</span>`,
                    );
                }
                waitReason.css("display", "block");
                this.playBtn.css("display", "block");
            } else if (
                isBattleRoyaleRoom &&
                playersInGame &&
                !this.roomData.findingGame &&
                !this.joiningGame
            ) {
                waitReason.html(
                    `${this.localization.translate("game-waiting-for-players")}<span> ...</span>`,
                );
                waitReason.css("display", "block");
                this.playBtn.css("display", "block");
            } else if (this.isLeader || !this.arena) {
                if (this.joiningGame) {
                    waitReason.html(
                        `<div class="ui-spinner" style="margin-right:16px"></div>${this.localization.translate(
                            "index-joining-game",
                        )}<span> ...</span>`,
                    );
                } else {
                    waitReason.html("");
                }

                const showWaitMessage = this.joiningGame;
                waitReason.css("display", showWaitMessage ? "block" : "none");
            } else {
                if (this.roomData.findingGame || this.joiningGame) {
                    waitReason.html(
                        `<div class="ui-spinner" style="margin-right:16px"></div>${this.localization.translate(
                            "index-joining-game",
                        )}<span> ...</span>`,
                    );
                } else if (playersInGame) {
                    waitReason.html(
                        `${this.localization.translate(
                            "index-game-in-progress",
                        )}<span> ...</span>`,
                    );
                } else {
                    waitReason.html(
                        `${this.localization.translate(
                            "index-waiting-for-leader",
                        )}<span> ...</span>`,
                    );
                }
                waitReason.css("display", "block");
                this.playBtn.css("display", "block");
            }

            // Player properties
            const teamMembers = $("#team-menu-member-list");
            teamMembers.empty();
            teamMembers.css(
                "--team-member-count",
                String(Math.max(1, Math.min(this.roomData.maxPlayers || 4, 4))),
            );
            for (let t = 0; t < this.roomData.maxPlayers; t++) {
                const hasPlayer = t < this.players.length;
                let playerStatus = {
                    name: "",
                    playerId: 0,
                    isLeader: false,
                    inGame: false,
                    self: false,
                    outfit: "outfitBase",
                };
                if (hasPlayer) {
                    const player = this.players[t];
                    playerStatus = {
                        name: player.name,
                        playerId: player.playerId,
                        isLeader: player.isLeader,
                        inGame: player.inGame,
                        self: player.playerId == this.localPlayerId,
                        outfit: player.outfit || "outfitBase",
                    };
                }

                const member = $("<div/>", {
                    class: "team-menu-member",
                });

                if (!hasPlayer) {
                    member.addClass("team-menu-member-empty");
                    member.append(
                        $("<div/>", {
                            class: "team-menu-invite-title",
                            html: "INVITE<br>DUOMATE",
                        }),
                    );
                    member.append(
                        $("<div/>", {
                            class: "team-menu-xp-bonus",
                            html: `+${this.getInviteXpBoost(t)}% XP`,
                        }),
                    );
                    teamMembers.append(member);
                    continue;
                }

                member.addClass("team-menu-member-filled");

                // Left-side icon
                let iconClass = "";
                if (playerStatus.isLeader) {
                    iconClass = " icon-leader";
                } else if (this.isLeader && playerStatus.playerId != 0) {
                    iconClass = " icon-kick";
                }

                if (iconClass) {
                    member.append(
                        $("<div/>", {
                            class: `icon${iconClass}`,
                            "data-playerid": playerStatus.playerId,
                        }),
                    );
                }
                const outfitImage =
                    helpers.getSvgFromGameType(playerStatus.outfit) ||
                    "img/loot/loot-shirt-01.svg";
                const outfitTransform = helpers.getCssTransformFromGameType(
                    playerStatus.outfit,
                );
                member.append(
                    $("<div/>", {
                        class: "team-menu-avatar",
                        css: {
                            "background-image": `url(${outfitImage})`,
                            transform: outfitTransform,
                        },
                    }),
                );
                let n: JQuery<HTMLInputElement> | null = null;
                let c = null;
                if (this.editingName && playerStatus.self) {
                    n = $("<input/>", {
                        type: "text",
                        tabindex: 0,
                        class: "name menu-option name-text name-self-input",
                        maxLength: net.Constants.PlayerNameMaxLen,
                    });
                    n.val(playerStatus.name);
                    const m = () => {
                        const name = helpers.sanitizeNameInput(n?.val()!);
                        playerStatus.name = name;
                        this.config.set("playerName", name);
                        this.sendMessage("changeName", {
                            name,
                        });
                        this.editingName = false;
                        this.refreshUi();
                    };
                    const h = () => {
                        this.editingName = false;
                        this.refreshUi();
                    };
                    n.on("keydown", (e) => {
                        if (e.which === 13) {
                            m();
                            return false;
                        }
                    });
                    n.on("blur", h);
                    member.append(n);
                    c = $("<div/>", {
                        class: "icon icon-submit-name-change",
                    });
                    c.on("click", m);
                    c.on("mousedown", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                } else {
                    // Name
                    let nameClass = "name-text";

                    if (playerStatus.self) {
                        nameClass += " name-self";
                    }
                    if (playerStatus.inGame) {
                        nameClass += " name-in-game";
                    }
                    const nameDiv = $("<div/>", {
                        class: `name menu-option ${nameClass}`,
                        html: helpers.htmlEscape(playerStatus.name),
                    });
                    if (playerStatus.self) {
                        nameDiv.on("click", () => {
                            this.editingName = true;
                            this.refreshUi();
                        });
                    }
                    member.append(nameDiv);
                }
                if (c) {
                    member.append(c);
                } else if (playerStatus.inGame) {
                    member.append(
                        $("<div/>", {
                            class: "icon icon-in-game",
                        }),
                    );
                }
                teamMembers.append(member);
                n?.trigger("focus");
            }

            $(".icon-kick", teamMembers).on("click", (e) => {
                const playerId = Number($(e.currentTarget).attr("data-playerid"));
                this.sendMessage("kick", {
                    playerId,
                });
            });

            // Play a sound if player count has increased
            const localPlayer = this.players.find((player) => {
                return player.playerId == this.localPlayerId;
            });
            const playJoinSound = localPlayer && !localPlayer.inGame;
            if (
                !document.hasFocus() &&
                this.prevPlayerCount < this.players.length &&
                this.players.length > 1 &&
                playJoinSound
            ) {
                this.audioManager.playSound("notification_join_01", {
                    channel: "ui",
                });
            }
            this.prevPlayerCount = this.players.length;
        }
    }
}
