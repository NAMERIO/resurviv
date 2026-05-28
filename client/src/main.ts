import $ from "jquery";
import * as PIXI from "pixi.js-legacy";
import {
    AmongUsImpostorCounts,
    DefaultAmongUsImpostorCount,
    DefaultPrivateLobbyMiniGame,
    getPrivateLobbyMiniGameDef,
    normalizeAmongUsImpostorCount,
    type PrivateLobbyMiniGame,
    PrivateLobbyMiniGameDefs,
    PrivateLobbyMiniGameIds,
} from "../../shared/defs/miniGame";
import { GameConfig } from "../../shared/gameConfig";
import * as net from "../../shared/net/net";
import type {
    FindGameBody,
    FindGameError,
    FindGameMatchData,
    FindGameResponse,
} from "../../shared/types/api";
import { math } from "../../shared/utils/math";
import { Account } from "./account";
import { Ambiance } from "./ambiance";
import { api } from "./api";
import { AudioManager } from "./audioManager";
import { ConfigManager, type ConfigType } from "./config";
import { crosshair } from "./crosshair";
import { device } from "./device";
import { errorLogManager } from "./errorLogs";
import { Game } from "./game";
import { helpers } from "./helpers";
import { InputHandler } from "./input";
import { InputBinds, InputBindUi } from "./inputBinds";
import { PingTest } from "./pingTest";
import { proxy } from "./proxy";
import { ResourceManager } from "./resources";
import { SDK } from "./sdk/sdk";
import { SiteInfo } from "./siteInfo";
import { ClanUi } from "./ui/clanUi";
import { FriendsUi } from "./ui/friendsUi";
import { LoadoutMenu } from "./ui/loadoutMenu";
import { Localization } from "./ui/localization";
import Menu from "./ui/menu";
import { MenuModal } from "./ui/menuModal";
import { LoadoutDisplay } from "./ui/opponentDisplay";
import { Pass } from "./ui/pass";
import { ProfileUi } from "./ui/profileUi";
import { ShopMenu } from "./ui/shopMenu";
import { TeamMenu } from "./ui/teamMenu";
import { loadStaticDomImages } from "./ui/ui2";

export class Application {
    nameInput = $("#player-name-input-solo");
    serverSelect = $("#server-select-main");
    gameModeSelect = $<HTMLSelectElement>("#game-mode-select-main");
    playMode0Btn = $("#btn-start-mode-0");
    playMode1Btn = $("#btn-start-mode-1");
    playMode2Btn = $("#btn-start-mode-2");
    muteBtns = $(".btn-sound-toggle");
    aimLineBtn = $("#btn-game-aim-line");
    masterSliders = $<HTMLInputElement>(".sl-master-volume");
    soundSliders = $<HTMLInputElement>(".sl-sound-volume");
    musicSliders = $<HTMLInputElement>(".sl-music-volume");
    serverWarning = $("#server-warning");
    languageSelect = $<HTMLSelectElement>(".language-select");
    startMenuWrapper = $("#start-menu-wrapper");
    gameAreaWrapper = $("#game-area-wrapper");
    playButtons = $(".play-button-container");
    playLoading = $(".play-loading-outer");
    prestigeArenaModal = $("#modal-prestige-arena");
    prestigeArenaWrapper = $("#modal-prestige-wrapper");
    prestigeArenaBattleTab = $("#prestige-battle-button");
    prestigeArenaCreateTab = $("#prestige-create-button");
    prestigeArenaBattlePane = $("#modal-battle-window");
    prestigeArenaCreatePane = $("#modal-create-window");
    prestigeArenaBattleModeRow = $("#modal-battle-window .battle-mode");
    prestigeArenaBattleTypeRow = $("#modal-battle-window .battle-type");
    prestigeArenaBattleMiniGameRow = $("#modal-battle-window .battle-minigame");
    prestigeArenaCodeInput = $<HTMLInputElement>(".battle-link-entry");
    prestigeArenaBattleInputGroup = $("#modal-battle-window .input-group");
    prestigeArenaJoinBtn = $("#battle-button");
    prestigeArenaLoadoutBtn = $("#battle-loadout-button");
    prestigeArenaCreateBtn = $("#create-button");
    prestigeArenaDisableAirstrikesBtn = $<HTMLButtonElement>(
        "#create-disable-airstrikes",
    );
    prestigeArenaDisablePerksBtn = $<HTMLButtonElement>("#create-disable-perks");
    prestigeArenaBattleOptions = $("#battle-private-options");
    prestigeArenaBattleDisableAirstrikesBtn = $<HTMLButtonElement>(
        "#battle-disable-airstrikes",
    );
    prestigeArenaBattleDisablePerksBtn = $<HTMLButtonElement>("#battle-disable-perks");
    prestigeArenaPlayerCounter = $("#battle-player-counter");
    prestigeArenaPlayerCount = $("#battle-total");
    prestigeArenaPlayerMax = $("#battle-max");
    prestigeArenaCodeRow = $("#battle-code-row");
    prestigeArenaSpectatorCodeNote = $("#battle-spectator-code-note");
    prestigeArenaRoomCode = $("#battle-room-code");
    prestigeArenaCopyCodeBtn = $("#battle-copy-code");
    prestigeArenaTeamsBoard = $("#arena-teams-board");
    prestigeArenaTeamAList = $("#arena-team-a-list");
    prestigeArenaTeamBList = $("#arena-team-b-list");
    prestigeArenaSpectatorsBoard = $("#arena-spectators-board");
    prestigeArenaSpectatorList = $("#arena-spectator-list");
    prestigeArenaGameStatusToStart = $("#game-status-to-start");
    prestigeArenaGameStatusStarted = $("#game-status-started");
    prestigeArenaGameStatus = $("#game-status");
    prestigeArenaModeDropdown = $("#create-mode");
    prestigeArenaModeSelection = $("#create-mode-selection");
    prestigeArenaTypeDropdown = $("#create-type");
    prestigeArenaTypeSelection = $("#create-type-selection");
    prestigeArenaMiniGameDropdown = $("#create-minigame");
    prestigeArenaMiniGameSelection = $("#create-minigame-selection");
    prestigeArenaImpostorCountDropdown = $("#create-impostors");
    prestigeArenaImpostorCountGroup = $("#create-impostors-group");
    prestigeArenaImpostorCountSelection = $("#create-impostors-selection");
    prestigeArenaBattleModeSelection = $("#battle-mode-selection");
    prestigeArenaBattleTypeSelection = $("#battle-type-selection");
    prestigeArenaBattleMiniGameSelection = $("#battle-minigame-selection");
    prestigeArenaBattleImpostorCountRow = $("#modal-battle-window .battle-impostors");
    prestigeArenaBattleImpostorCountSelection = $("#battle-impostors-selection");
    prestigeArenaRegionSelect = $("#create-region-select");
    prestigeArenaRegionOpts = $("#create-region-opts");
    prestigeArenaModeLabel = $("#create-link-mode");
    prestigeArenaTypeLabel = $("#create-link-type");
    prestigeArenaMiniGameLabel = $("#create-link-minigame");
    prestigeArenaImpostorCountLabel = $("#create-link-impostors");
    prestigeArenaBattleModeLabel = $("#battle-link-mode");
    prestigeArenaBattleTypeLabel = $("#battle-link-type");
    prestigeArenaBattleMiniGameLabel = $("#battle-link-minigame");
    prestigeArenaBattleImpostorCountLabel = $("#battle-link-impostors");
    prestigeArenaPreviewReqId = 0;
    lastArenaPreloadedMapName = "";
    prestigeArenaSummaryTab = $("#prestige-game-summary-button");
    prestigeArenaSpectateTab = $("#prestige-spectate-button");
    errorModal = new MenuModal($("#modal-notification"));
    refreshModal = new MenuModal($("#modal-refresh"));
    ipBanModal = new MenuModal($("#modal-ip-banned"));
    config = new ConfigManager();
    localization = new Localization();

    account!: Account;
    loadoutMenu!: LoadoutMenu;
    pass!: Pass;
    profileUi!: ProfileUi;
    clanUi!: ClanUi;
    friendsUi!: FriendsUi;
    shopMenu!: ShopMenu;

    pingTest = new PingTest();
    audioManager = new AudioManager();
    ambience = new Ambiance();

    siteInfo!: SiteInfo;
    teamMenu!: TeamMenu;

    pixi: PIXI.Application<PIXI.ICanvas> | null = null;
    resourceManager: ResourceManager | null = null;
    input: InputHandler | null = null;
    inputBinds: InputBinds | null = null;
    inputBindUi: InputBindUi | null = null;
    game: Game | null = null;
    loadoutDisplay: LoadoutDisplay | null = null;
    socialEvents: EventSource | null = null;
    domContentLoaded = false;
    configLoaded = false;
    initialized = false;
    active = false;
    sessionId = helpers.random64();
    contextListener = function (e: MouseEvent) {
        e.preventDefault();
    };

    errorMessage = "";
    quickPlayPendingModeIdx = -1;
    findGameAttempts = 0;
    findGameTime = 0;
    pauseTime = 0;
    wasPlayingVideo = false;
    checkedPingTest = false;
    hasFocus = true;
    newsDisplayed = false;
    prestigeArenaSelectedModeIdx = 0;
    prestigeArenaSelectedMap = "main";
    prestigeArenaSelectedTeamMode = 2;
    prestigeArenaSelectedMiniGame: PrivateLobbyMiniGame = DefaultPrivateLobbyMiniGame;
    prestigeArenaSelectedImpostorCount = DefaultAmongUsImpostorCount;
    prestigeArenaModalRequestedOpen = false;
    modeDisplayNameByMap: Record<string, string> = {
        main: "Normal",
        br_main: "Battle Royale",
        br_main_spring: "Spring",
        br_main_summer: "Summer",
        br_desert: "Desert",
        br_faction: "Faction",
        br_halloween: "Halloween",
        br_potato: "Potato",
        br_potato_spring: "Potato Spring",
        br_snow: "Snow",
        br_woods: "Woods",
        br_woods_snow: "Woods Snow",
        br_woods_spring: "Woods Spring",
        br_woods_summer: "Woods Summer",
        br_savannah: "Savannah",
        br_cobalt: "Cobalt",
        br_turkey: "Turkey",
        br_birthday: "Birthday",
        br_beach: "Beach",
        woods: "Woods",
        potato: "Potato",
        desert: "Desert",
        savannah: "Savannah",
        snow: "Snow",
        cobalt: "Cobalt",
        perks: "Perks",
        valentine: "Valentine",
        inferno: "Inferno",
        stPatrick: "Saint Patrick",
    };

    getModeDisplayName(mapName: string) {
        return this.modeDisplayNameByMap[mapName] || mapName;
    }

    isBattleRoyaleMiniGame(miniGame?: PrivateLobbyMiniGame) {
        return miniGame === "battle_royale";
    }

    getArenaTeamModeDisplayName(teamMode: number, miniGame?: PrivateLobbyMiniGame) {
        if (this.isBattleRoyaleMiniGame(miniGame)) {
            const teamModeMap: Record<number, string> = {
                1: "Solo",
                2: "Duo",
                4: "Squad",
            };
            return teamModeMap[teamMode] || "Duo";
        }
        return this.getTeamModeDisplayName(teamMode);
    }

    getTeamModeDisplayName(teamMode: number) {
        const teamModeMap: Record<number, string> = {
            1: "1v1",
            2: "2v2",
            4: "4v4",
            10: "10v10",
            15: "15v15",
        };
        return teamModeMap[teamMode] || "2v2";
    }

    getTeamModeIcon(teamMode: number) {
        if (teamMode === 1) return "/img/gui/player-gui.svg";
        if (teamMode === 2) return "/img/ui/duo-player.svg";
        return "/img/ui/squad-player.svg";
    }

    updateLogoBasedOnLanguage(lang: string) {
        const header = $("#start-row-header");
        if (!header.length) return;
        header.toggleClass("lang-ru", lang === "ru");
    }

    constructor() {
        this.account = new Account(this.config);
        this.loadoutMenu = new LoadoutMenu(this.account, this.localization, this.config);
        this.pass = new Pass(this.account, this.loadoutMenu, this.localization);
        this.siteInfo = new SiteInfo(this.config, this.localization);
        this.loadoutMenu.showCombatLoadoutCategories =
            this.canUseCombatLoadoutCategories.bind(this);

        this.teamMenu = new TeamMenu(
            this.config,
            this.pingTest,
            this.siteInfo,
            this.localization,
            this.audioManager,
            this.onTeamMenuJoinGame.bind(this),
            this.onTeamMenuLeave.bind(this),
        );
        this.teamMenu.onStateUpdated = () => {
            this.syncPrestigeArenaRoomUi();
        };

        const onLoadComplete = () => {
            this.config.load(() => {
                this.configLoaded = true;
                this.tryLoad();
            });
        };
        this.loadBrowserDeps(onLoadComplete);
    }

    async loadBrowserDeps(onLoadCompleteCb: () => void) {
        await SDK.init(this);
        onLoadCompleteCb();
    }

    tryLoad() {
        if (this.domContentLoaded && this.configLoaded && !this.initialized) {
            this.initialized = true;
            // this should be this.config.config.teamAutofill = true???
            // this.config.teamAutoFill = true;
            if (device.mobile) {
                Menu.applyMobileBrowserStyling(device.tablet);
            }
            if (SDK.isSpellSync) {
                this.localization.setLocale(window.spellSync.language);
                this.updateLogoBasedOnLanguage(window.spellSync.language);
            } else {
                const language =
                    this.config.get("language") || this.localization.detectLocale();
                this.config.set("language", language);
                this.localization.setLocale(language);
                this.updateLogoBasedOnLanguage(language);
            }
            this.localization.populateLanguageSelect();
            this.startPingTest();
            this.siteInfo.load();
            this.localization.localizeIndex();
            this.account.init();
            this.account.addEventListener("login", () => {
                this.refreshUi();
            });

            // Initialize ProfileUi after DOM is ready
            this.profileUi = new ProfileUi(
                this.account,
                this.localization,
                this.loadoutMenu,
                this.errorModal,
            );
            this.shopMenu = new ShopMenu(this.account, this.localization);
            this.friendsUi = new FriendsUi(
                this.account,
                this.profileUi,
                () => this.active,
            );

            // Initialize ClanUi
            this.clanUi = new ClanUi(this.account, this.localization, () => this.active);
            this.account.addEventListener("login", () => {
                this.startSocialEvents();
            });
            this.startSocialEvents();
            $("#btn-clans").on("click", () => {
                if (!this.account.loggedIn) {
                    this.profileUi.showLoginMenu({
                        modal: true,
                    });
                    return;
                }
                this.clanUi.showMainModal();
            });

            this.nameInput.attr("maxLength", net.Constants.PlayerNameMaxLen);

            this.playMode0Btn.on("click", () => {
                this.tryQuickStartGame(this.getSelectedGameModeIdx());
            });
            this.playMode1Btn.on("click", () => {
                this.tryQuickStartGame(1);
            });
            this.playMode2Btn.on("click", () => {
                this.tryQuickStartGame(2);
            });

            this.serverSelect.on("change", () => {
                const t = this.serverSelect.find(":selected").val();
                this.config.set("region", t as string);
            });
            this.nameInput.on("blur", (_t) => {
                this.setConfigFromDOM();
            });
            this.muteBtns.on("click", (_t) => {
                this.config.set("muteAudio", !this.config.get("muteAudio"));
            });
            this.muteBtns.on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.masterSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.soundSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.musicSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            this.masterSliders.on("input", (t) => {
                const r = Number($(t.target).val()) / 100;
                this.audioManager.setMasterVolume(r);
                this.config.set("masterVolume", r);
            });
            this.soundSliders.on("input", (t) => {
                const r = Number($(t.target).val()) / 100;
                this.audioManager.setSoundVolume(r);
                this.config.set("soundVolume", r);
            });
            this.musicSliders.on("input", (t) => {
                const r = Number($(t.target).val()) / 100;
                this.audioManager.setMusicVolume(r);
                this.config.set("musicVolume", r);
            });
            $(".modal-settings-item")
                .children("input")
                .each((_t, r) => {
                    const a = $(r);
                    a.prop("checked", this.config.get(a.prop("id")));
                });
            $(".modal-settings-item > input:checkbox").on("change", (t) => {
                const r = $(t.target);
                this.config.set(r.prop("id"), r.is(":checked"));
            });
            $(".btn-fullscreen-toggle").on("click", () => {
                helpers.toggleFullScreen();
            });
            this.languageSelect.on("change", (t) => {
                const r = t.target.value;
                if (r) {
                    this.config.set("language", r as ConfigType["language"]);
                    if (SDK.isSpellSync && window.spellSync) {
                        window.spellSync.changeLanguage(r);
                    }
                    this.updateLogoBasedOnLanguage(r);
                }
            });
            $("#btn-create-team").on("click", () => {
                this.tryJoinTeam(true);
            });
            $("#btn-prestige-arena").on("click", () => {
                this.showPrestigeArenaModal();
            });
            $("#arena-mobile-spectators-tab").on("click", () => {
                this.setPrestigeArenaMobilePanel("spectators");
            });
            $("#arena-mobile-chat-tab").on("click", () => {
                this.setPrestigeArenaMobilePanel("chat");
            });
            $("#modal-prestige-close").on("click", () => {
                if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
                    this.hidePrestigeArenaModal();
                    if (window.history) {
                        window.history.replaceState("", "", "/");
                    }
                    $("#news-block").css("display", "block");
                    this.game?.free();
                    this.teamMenu.leave();
                    return;
                }
                this.hidePrestigeArenaModal();
            });
            this.prestigeArenaBattleTab.on("click", () => {
                if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
                    this.setPrestigeArenaTab("battle");
                    return;
                }
                this.setPrestigeArenaTab("battle");
                if (
                    !(this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined)
                ) {
                    this.setPrestigeArenaUnjoinedUi();
                }
            });
            this.prestigeArenaCreateTab.on("click", () => {
                if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
                    if (!this.teamMenu.isLeader) {
                        this.setPrestigeArenaTab("battle");
                        return;
                    }
                    this.populatePrestigeArenaModes();
                    this.syncPrestigeArenaCreateOptions();
                    this.setPrestigeArenaTab("battle");
                    this.renderPrestigeArenaTeams();
                    return;
                }
                this.setPrestigeArenaTab("battle");
                if (
                    !(this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined)
                ) {
                    this.setPrestigeArenaUnjoinedUi();
                }
            });
            this.prestigeArenaJoinBtn.on("click", () => {
                if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
                    if (this.teamMenu.isLeader) {
                        this.teamMenu.tryStartGame();
                    }
                    return;
                }
                const codeInput = (this.prestigeArenaCodeInput.val() || "").trim();
                const parsedInvite = this.parseInviteTarget(codeInput, true);
                if (parsedInvite.roomUrl.length !== 6) {
                    this.showErrorModal(
                        this.localization.translate("index-arena-invalid-code"),
                    );
                    return;
                }
                this.hidePrestigeArenaModal();
                this.tryJoinTeam(false, codeInput, true, {
                    preferredTeam: parsedInvite.preferredTeam,
                    spectator: parsedInvite.spectator,
                });
            });
            this.prestigeArenaLoadoutBtn.on("click", () => {
                this.loadoutMenu.show();
                return false;
            });
            $("#battle-search-button").on("click", () => {
                this.prestigeArenaJoinBtn.trigger("click");
            });
            this.prestigeArenaCodeInput.on("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.prestigeArenaJoinBtn.trigger("click");
                }
            });
            this.prestigeArenaCodeInput.on("input", () => {
                this.updatePrestigeJoinButtonState();
                this.updatePrestigeArenaJoinPreview();
            });
            this.prestigeArenaCopyCodeBtn.on("click", (e) => {
                const code = (this.prestigeArenaRoomCode.text() || "").trim();
                if (!code) return;
                const miniGameDef = getPrivateLobbyMiniGameDef(
                    this.teamMenu.roomData.miniGame,
                );
                const inviteUrl = new URL(window.location.href);
                inviteUrl.search = "?arena";
                inviteUrl.hash = miniGameDef.singleTeam ? `#${code}?A` : `#${code}`;
                helpers.copyTextToClipboard(inviteUrl.toString());
                this.showCopyToast(
                    this.prestigeArenaCopyCodeBtn.offset()?.left ?? e.pageX,
                    this.prestigeArenaCopyCodeBtn.offset()?.top ?? e.pageY,
                );
            });
            this.prestigeArenaModeDropdown.on("click", () => {
                const visible = this.prestigeArenaModeSelection.css("display") !== "none";
                this.prestigeArenaModeSelection.css("display", visible ? "none" : "grid");
                if (!visible) {
                    this.prestigeArenaTypeSelection.css("display", "none");
                    this.prestigeArenaMiniGameSelection.css("display", "none");
                    this.prestigeArenaImpostorCountSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                }
            });
            this.prestigeArenaTypeDropdown.on("click", () => {
                const visible = this.prestigeArenaTypeSelection.css("display") !== "none";
                this.prestigeArenaTypeSelection.css("display", visible ? "none" : "grid");
                if (!visible) {
                    this.prestigeArenaModeSelection.css("display", "none");
                    this.prestigeArenaMiniGameSelection.css("display", "none");
                    this.prestigeArenaImpostorCountSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                }
            });
            this.prestigeArenaMiniGameDropdown.on("click", () => {
                const visible =
                    this.prestigeArenaMiniGameSelection.css("display") !== "none";
                this.prestigeArenaMiniGameSelection.css(
                    "display",
                    visible ? "none" : "grid",
                );
                if (!visible) {
                    this.prestigeArenaModeSelection.css("display", "none");
                    this.prestigeArenaTypeSelection.css("display", "none");
                    this.prestigeArenaImpostorCountSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                }
            });
            this.prestigeArenaImpostorCountDropdown.on("click", () => {
                if (
                    this.teamMenu.active &&
                    this.teamMenu.arena &&
                    this.teamMenu.joined &&
                    !this.teamMenu.isLeader
                ) {
                    return;
                }
                const visible =
                    this.prestigeArenaImpostorCountSelection.css("display") !== "none";
                this.prestigeArenaImpostorCountSelection.css(
                    "display",
                    visible ? "none" : "grid",
                );
                if (!visible) {
                    this.prestigeArenaModeSelection.css("display", "none");
                    this.prestigeArenaTypeSelection.css("display", "none");
                    this.prestigeArenaMiniGameSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                }
            });
            this.prestigeArenaBattleModeRow.on("click", () => {
                if (!this.canEditPrestigeArenaLiveOptions()) return;
                this.togglePrestigeArenaBattleSelection(
                    this.prestigeArenaBattleModeSelection,
                    this.prestigeArenaBattleModeRow,
                );
            });
            this.prestigeArenaBattleTypeRow.on("click", () => {
                if (!this.canEditPrestigeArenaLiveOptions()) return;
                this.togglePrestigeArenaBattleSelection(
                    this.prestigeArenaBattleTypeSelection,
                    this.prestigeArenaBattleTypeRow,
                );
            });
            this.prestigeArenaBattleMiniGameRow.on("click", () => {
                if (!this.canEditPrestigeArenaLiveOptions()) return;
                this.togglePrestigeArenaBattleSelection(
                    this.prestigeArenaBattleMiniGameSelection,
                    this.prestigeArenaBattleMiniGameRow,
                );
            });
            this.prestigeArenaBattleImpostorCountRow.on("click", () => {
                if (!this.canEditPrestigeArenaLiveOptions()) return;
                this.togglePrestigeArenaBattleSelection(
                    this.prestigeArenaBattleImpostorCountSelection,
                    this.prestigeArenaBattleImpostorCountRow,
                );
            });
            $(document).on("click", (e) => {
                if (!this.prestigeArenaModal.hasClass("is-open")) return;
                const target = $(e.target);
                if (
                    target.closest(
                        [
                            "#create-mode",
                            "#create-type",
                            "#create-minigame",
                            "#create-impostors",
                            "#create-mode-selection",
                            "#create-type-selection",
                            "#create-minigame-selection",
                            "#create-impostors-selection",
                            "#modal-battle-window .battle-mode",
                            "#modal-battle-window .battle-type",
                            "#modal-battle-window .battle-minigame",
                            "#modal-battle-window .battle-impostors",
                            "#battle-mode-selection",
                            "#battle-type-selection",
                            "#battle-minigame-selection",
                            "#battle-impostors-selection",
                        ].join(","),
                    ).length
                ) {
                    return;
                }
                this.prestigeArenaModeSelection.css("display", "none");
                this.prestigeArenaTypeSelection.css("display", "none");
                this.prestigeArenaMiniGameSelection.css("display", "none");
                this.prestigeArenaImpostorCountSelection.css("display", "none");
                this.hidePrestigeArenaBattleSelections();
            });
            this.prestigeArenaRegionSelect.on("change", () => {
                const region = this.prestigeArenaRegionSelect.find(":selected").val();
                if (region) {
                    this.config.set("region", region as string);
                    if (
                        this.teamMenu.active &&
                        this.teamMenu.arena &&
                        this.teamMenu.joined &&
                        this.teamMenu.isLeader
                    ) {
                        this.teamMenu.setRoomProperty("region", region as string);
                    }
                }
            });
            this.prestigeArenaDisableAirstrikesBtn.on("click", () => {
                this.setPrestigeArenaCreateOption(
                    "disableAirstrikes",
                    !this.teamMenu.roomData.disableAirstrikes,
                );
            });
            this.prestigeArenaDisablePerksBtn.on("click", () => {
                this.setPrestigeArenaCreateOption(
                    "disablePerks",
                    !this.teamMenu.roomData.disablePerks,
                );
            });
            this.prestigeArenaBattleDisableAirstrikesBtn.on("click", () => {
                this.setPrestigeArenaCreateOption(
                    "disableAirstrikes",
                    !this.teamMenu.roomData.disableAirstrikes,
                );
            });
            this.prestigeArenaBattleDisablePerksBtn.on("click", () => {
                this.setPrestigeArenaCreateOption(
                    "disablePerks",
                    !this.teamMenu.roomData.disablePerks,
                );
            });
            this.prestigeArenaCreateBtn.on("click", () => {
                if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
                    this.setPrestigeArenaTab("battle");
                    return;
                }
                const modeIdx = this.prestigeArenaSelectedModeIdx;
                if (Number.isFinite(modeIdx) && modeIdx >= 0) {
                    this.config.set("gameModeIdx", modeIdx);
                }
                this.teamMenu.roomData.miniGame = this.prestigeArenaSelectedMiniGame;
                this.teamMenu.roomData.amongUsImpostorCount =
                    this.prestigeArenaSelectedImpostorCount;
                this.tryJoinTeam(true, undefined, true);
            });
            $("#btn-team-mobile-link-join").on("click", () => {
                const t = $<HTMLInputElement>("#team-link-input").val()?.trim()!;
                if (t.length > 0) {
                    $("#team-mobile-link").css("display", "none");
                    this.tryJoinTeam(false, t);
                } else {
                    $("#team-mobile-link-desc").css("display", "none");
                    $("#team-mobile-link-warning").css("display", "none").fadeIn(100);
                }
            });
            $("#btn-team-leave, #btn-team-close").on("click", () => {
                if (window.history) {
                    window.history.replaceState("", "", "/");
                }
                $("#news-block").css("display", "block");
                this.game?.free();
                this.teamMenu.leave();
            });
            const r = $("#news-current").data("date");
            const a = new Date(r).getTime();
            $(".news-toggle").on("click", () => {
                this.config.set("lastNewsTimestamp", a);
                $(".news-toggle").find(".account-alert").css("display", "none");
                $("#friends-wrapper").removeClass("open");
                $("#news-wrapper").fadeIn(250);
                this.newsDisplayed = true;
            });
            $("#news-wrapper").on("click touchend", (e) => {
                if ($(e.target).closest("#modal-news-card").length === 0) {
                    $("#news-wrapper").fadeOut(250);
                    this.newsDisplayed = false;
                    return false;
                }
            });
            $(".pass-toggle").on("click", () => {
                $("#news-wrapper").fadeOut(250);
                this.newsDisplayed = false;
            });
            const i = this.config.get("lastNewsTimestamp")!;
            if (a > i) {
                $(".news-toggle").find(".account-alert").css("display", "block");
            }
            this.setDOMFromConfig();
            this.setAppActive(true);
            const domCanvas = document.querySelector<HTMLCanvasElement>("#cvs")!;

            const rendererRes = window.devicePixelRatio > 1 ? 2 : 1;

            if (device.os == "ios") {
                PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
            }

            const createPixiApplication = (forceCanvas: boolean) => {
                return new PIXI.Application({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    view: domCanvas,
                    antialias: false,
                    resolution: rendererRes,
                    hello: true,
                    forceCanvas,
                });
            };
            let pixi = null;
            try {
                pixi = createPixiApplication(false);
            } catch (_e) {
                pixi = createPixiApplication(true);
            }
            this.pixi = pixi;
            this.pixi.renderer.events.destroy();
            this.pixi.ticker.add(this.update, this);
            this.pixi.renderer.background.color = 7378501;
            this.resourceManager = new ResourceManager(
                this.pixi.renderer,
                this.audioManager,
                this.config,
            );
            this.resourceManager.loadMapAssets("main");
            this.input = new InputHandler(document.getElementById("game-touch-area")!);
            this.inputBinds = new InputBinds(this.input, this.config);
            this.inputBindUi = new InputBindUi(
                this.input,
                this.inputBinds,
                this.localization,
            );
            const onJoin = () => {
                this.loadoutDisplay!.free();
                this.game!.init();
                this.onResize();
                this.findGameAttempts = 0;
                this.ambience.onGameStart();
                const currentLoadout = this.config.get("loadout");
                if (currentLoadout?.crosshair) {
                    crosshair.setGameCrosshair(currentLoadout.crosshair);
                }
            };
            const onQuit = (errMsg?: string) => {
                if (this.account.loggedIn) {
                    this.pass.scheduleUpdatePass(
                        this.game!.m_updatePass ? this.game!.m_updatePassDelay : 1,
                    );
                }
                this.game!.free();
                this.errorMessage = this.localization.translate(errMsg || "");
                this.teamMenu.onGameComplete();
                this.ambience.onGameComplete(this.audioManager);
                this.setAppActive(true);
                this.setPlayLockout(false);
                if (errMsg == "index-invalid-protocol") {
                    this.showInvalidProtocolModal();
                }
                if (errMsg == "rate_limited") {
                    this.onJoinGameError(errMsg);
                }
                if (errMsg) {
                    this.showErrorModal(errMsg);
                }
                console.error("Quitting", errMsg);
                SDK.gamePlayStop();
            };
            this.game = new Game(
                this.pixi,
                this.audioManager,
                this.localization,
                this.config,
                this.input,
                this.inputBinds,
                this.inputBindUi,
                this.ambience,
                this.resourceManager,
                onJoin,
                onQuit,
            );
            this.loadoutDisplay = new LoadoutDisplay(
                this.pixi,
                this.audioManager,
                this.config,
                this.inputBinds,
                this.account,
            );
            this.loadoutMenu.loadoutDisplay = this.loadoutDisplay;
            this.onResize();
            this.tryJoinTeam(false);
            Menu.setupModals(this.inputBinds, this.inputBindUi);
            this.onConfigModified();
            this.config.addModifiedListener(this.onConfigModified.bind(this));
            loadStaticDomImages();

            SDK.gameLoadComplete();
        }
    }

    onUnload() {
        this.teamMenu.leave();
    }

    onResize() {
        device.onResize();
        Menu.onResize();
        this.loadoutMenu.onResize();
        this.pixi?.renderer.resize(device.screenWidth, device.screenHeight);
        if (this.game?.initialized) {
            this.game.resize();
        }
        if (this.loadoutDisplay?.initialized) {
            this.loadoutDisplay.resize();
        }
        this.refreshUi();
    }

    startPingTest() {
        const regions = this.config.get("regionSelected")
            ? [this.config.get("region")!]
            : this.pingTest.getRegionList();
        this.pingTest.start(regions);
    }

    startSocialEvents() {
        if (this.socialEvents || !this.account.loggedIn || !("EventSource" in window)) {
            return;
        }

        const events = new EventSource(api.resolveUrl("/api/events"), {
            withCredentials: true,
        });
        events.addEventListener("friends_changed", () => {
            this.account.loadFriends(undefined, true);
        });
        events.addEventListener("clan_messages_changed", (event) => {
            const data = this.parseSocialEvent(event);
            if (
                data?.clanId &&
                this.clanUi.viewingClan?.id === data.clanId &&
                this.clanUi.clanPageModal.isVisible()
            ) {
                this.clanUi.loadNewClanMessages();
            }
        });
        events.addEventListener("clan_mentions_changed", (event) => {
            const data = this.parseSocialEvent(event);
            if (data?.clanId && this.clanUi.currentClan?.id === data.clanId) {
                this.clanUi.loadMentionNotifications(true);
            }
        });
        events.addEventListener("clan_join_requests_changed", (event) => {
            const data = this.parseSocialEvent(event);
            if (data?.clanId && this.clanUi.currentClan?.id === data.clanId) {
                this.clanUi.loadMyClan();
                if (
                    this.clanUi.viewingClan?.id === data.clanId &&
                    this.clanUi.clanPageModal.isVisible()
                ) {
                    this.clanUi.loadClanDetail(
                        data.clanId,
                        this.clanUi.getSelectedClanDetailSeason(),
                    );
                }
            }
        });
        events.onerror = () => {
            // EventSource reconnects automatically. The existing slow polling remains
            // as a fallback if the stream cannot be maintained.
        };
        this.socialEvents = events;
    }

    parseSocialEvent(event: Event) {
        try {
            return JSON.parse((event as MessageEvent).data || "{}") as {
                type?: string;
                clanId?: string;
            };
        } catch {
            return undefined;
        }
    }

    setAppActive(active: boolean) {
        if (!active) {
            const currentLoadout = this.config.get("loadout");
            if (currentLoadout?.crosshair) {
                setTimeout(() => {
                    crosshair.setGameCrosshair(currentLoadout.crosshair);
                }, 100);
            }
        }
        this.active = active;
        this.quickPlayPendingModeIdx = -1;
        this.refreshUi();

        // Certain systems, like the account, can throw errors
        // while the user is already in a game.
        // Seeing these errors when returning to the menu would be
        // confusing, so we'll hide the modal instead.
        if (active) {
            this.errorModal.hide();
        }
    }

    setPlayLockout(lock: boolean) {
        const delay = lock ? 0 : 1000;
        this.playButtons
            .stop()
            .delay(delay)
            .animate(
                {
                    opacity: lock ? 0.5 : 1,
                },
                250,
            );
        this.playLoading
            .stop()
            .delay(delay)
            .animate(
                {
                    opacity: lock ? 1 : 0,
                },
                {
                    duration: 250,
                    start: () => {
                        this.playLoading.css({
                            "pointer-events": lock ? "initial" : "none",
                        });
                    },
                },
            );
    }

    onTeamMenuJoinGame(data: FindGameMatchData) {
        // Team/private lobby joins should start immediately; delaying on account
        // requests can cause hidden-tab clients to miss the join window.
        this.joinGame(data);
    }

    onTeamMenuLeave(errTxt = "") {
        this.hidePrestigeArenaModal();
        if (errTxt && errTxt != "" && window.history) {
            window.history.replaceState("", "", "/");
        }
        this.showErrorModal(errTxt);

        this.errorMessage = errTxt;
        this.setDOMFromConfig();
        this.refreshUi();
    }

    // Config
    setConfigFromDOM() {
        const playerName = helpers.sanitizeNameInput(this.nameInput.val() as string);
        this.config.set("playerName", playerName);
        const region = this.serverSelect.find(":selected").val();
        this.config.set("region", region as string);
        const gameModeIdx = this.getSelectedGameModeIdx();
        if (gameModeIdx >= 0) {
            this.config.set("gameModeIdx", gameModeIdx);
        }
    }

    setDOMFromConfig() {
        if (SDK.isAnySDK && !this.config.get("playerName")) {
            SDK.getPlayerName().then((username) => {
                if (!username) return;
                this.config.set("playerName", username);
                this.nameInput.val(username);
            });
        }

        this.nameInput.val(this.config.get("playerName")!);
        this.serverSelect.find("option").each((_i, ele) => {
            const spellSyncLang = SDK.isSpellSync && window.spellSync.language;
            const configRegion = this.config.get("region");
            ele.selected = spellSyncLang
                ? ele.value === spellSyncLang
                : ele.value === configRegion;
        });
        this.gameModeSelect.val(String(this.getConfiguredGameModeIdx()));
        this.syncPrestigeArenaRegions();
        this.languageSelect.val(this.localization.getLocale());
    }

    getConfiguredGameModeIdx() {
        const modes = this.siteInfo.info.modes || [];
        const configuredMode = this.config.get("gameModeIdx")!;
        if (modes[configuredMode]?.enabled) {
            return configuredMode;
        }
        const firstEnabledMode = modes.findIndex((mode) => mode.enabled);
        return firstEnabledMode >= 0 ? firstEnabledMode : 0;
    }

    getSelectedGameModeIdx() {
        const selected = Number(this.gameModeSelect.val());
        if (Number.isFinite(selected)) {
            return selected;
        }
        return this.getConfiguredGameModeIdx();
    }

    isBattleRoyaleModeIdx(gameModeIdx: number) {
        const mapName = this.siteInfo.info.modes?.[gameModeIdx]?.mapName || "";
        return mapName.startsWith("br_");
    }

    canUseCombatLoadoutCategories() {
        const arenaModeIdx =
            this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined
                ? this.teamMenu.roomData.gameModeIdx
                : -1;
        const modeIdx =
            Number.isFinite(arenaModeIdx) && arenaModeIdx >= 0
                ? arenaModeIdx
                : this.getSelectedGameModeIdx();
        return !this.isBattleRoyaleModeIdx(modeIdx);
    }

    syncPrestigeArenaRegions() {
        this.prestigeArenaRegionOpts.empty();
        $("#server-opts")
            .children("option")
            .each((_i, sourceOption) => {
                this.prestigeArenaRegionOpts.append($(sourceOption).clone());
            });

        const configRegion = this.config.get("region");
        let foundSelected = false;
        this.prestigeArenaRegionSelect.find("option").each((_i, option) => {
            option.selected = option.value === configRegion;
            foundSelected = foundSelected || option.selected;
        });
        if (!foundSelected) {
            this.prestigeArenaRegionSelect.find("option").first().prop("selected", true);
        }
    }

    onConfigModified(key?: string) {
        const muteAudio = this.config.get("muteAudio")!;
        if (muteAudio != this.audioManager.mute) {
            this.muteBtns.removeClass(muteAudio ? "audio-on-icon" : "audio-off-icon");
            this.muteBtns.addClass(muteAudio ? "audio-off-icon" : "audio-on-icon");
            this.audioManager.setMute(muteAudio);
        }

        const masterVolume = this.config.get("masterVolume")!;
        this.masterSliders.val(masterVolume * 100);
        this.audioManager.setMasterVolume(masterVolume);

        const soundVolume = this.config.get("soundVolume")!;
        this.soundSliders.val(soundVolume * 100);
        this.audioManager.setSoundVolume(soundVolume);

        const musicVolume = this.config.get("musicVolume")!;
        this.musicSliders.val(musicVolume * 100);
        this.audioManager.setMusicVolume(musicVolume);

        if (key == "language") {
            const language = this.config.get("language")!;
            this.localization.setLocale(language);
            this.updateLogoBasedOnLanguage(language);
        }

        if (key == "region") {
            this.config.set("regionSelected", true);
            this.startPingTest();
        }

        if (key == "highResTex") {
            location.reload();
        }

        if (key === "debugHUD") {
            this.game?.debugHUD?.onConfigModified();
        }

        if (key === "anonPlayerNames" || key === "showClanTags" || key === undefined) {
            if (this.game?.m_playerBarn) {
                this.game.m_playerBarn.anonPlayerNames =
                    this.config.get("anonPlayerNames")!;
                this.game.m_playerBarn.showClanTags = this.config.get("showClanTags")!;
            }
        }

        if (key === "loadout" || key === undefined) {
            const currentLoadout = this.config.get("loadout");
            if (currentLoadout?.crosshair) {
                crosshair.setGameCrosshair(currentLoadout.crosshair);
            }
        }
    }

    refreshUi() {
        this.startMenuWrapper.css("display", this.active ? "flex" : "none");
        this.gameAreaWrapper.css({
            display: this.active ? "none" : "block",
            opacity: this.active ? 0 : 1,
        });
        if (this.active) {
            $("body").removeClass("user-select-none");
            document.removeEventListener("contextmenu", this.contextListener);
        } else {
            $("body").addClass("user-select-none");
            $("#start-main").stop(true);
            document.addEventListener("contextmenu", this.contextListener);
        }

        // Hide the left section if on mobile, oriented portrait, and viewing create team
        $("#ad-block-left").css(
            "display",
            !device.isLandscape && this.teamMenu.active ? "none" : "block",
        );

        $(".ad-rail").css("display", this.active ? "block" : "none");

        // Warning
        const hasError = this.active && this.errorMessage != "";
        this.serverWarning.css({
            display: "block",
            opacity: hasError ? 1 : 0,
        });
        this.serverWarning.html(this.errorMessage);

        const updateButton = (ele: JQuery<HTMLElement>, gameModeIdx: number) => {
            ele.html(
                this.quickPlayPendingModeIdx === gameModeIdx
                    ? '<div class="ui-spinner"></div>'
                    : this.localization.translate(ele.data("l10n")),
            );
        };

        updateButton(this.playMode0Btn, this.getSelectedGameModeIdx());

        const canShowArenaButton = this.active && !!this.siteInfo.info.modes?.length;
        $("#open-arena-button").css("display", canShowArenaButton ? "block" : "none");

        this.syncPrestigeArenaRoomUi();
    }

    syncPrestigeArenaCreatePaneVisibility() {
        const showCreatePane =
            !this.teamMenu.active || !this.teamMenu.arena || !this.teamMenu.joined;
        this.prestigeArenaCreatePane.toggleClass("hide", !showCreatePane);
        this.prestigeArenaWrapper.toggleClass("arena-has-create-panel", showCreatePane);
        this.prestigeArenaWrapper.toggleClass(
            "arena-joined-editor",
            showCreatePane &&
                this.teamMenu.active &&
                this.teamMenu.arena &&
                this.teamMenu.joined,
        );
    }

    setPrestigeArenaTab(_tab: "battle" | "create", preserveSelections = false) {
        this.prestigeArenaSummaryTab.addClass("hide");
        this.prestigeArenaSpectateTab.addClass("hide");
        this.prestigeArenaWrapper.addClass("arena-combined-shell arena-battle-tab");
        this.prestigeArenaWrapper.removeClass("arena-create-tab");
        this.prestigeArenaBattleTab.addClass("selected");
        this.prestigeArenaCreateTab.addClass("hide");
        this.prestigeArenaCreateTab.removeClass("selected");
        this.prestigeArenaBattlePane.removeClass("hide");
        this.syncPrestigeArenaCreatePaneVisibility();
        if (!preserveSelections) {
            this.prestigeArenaModeSelection.css("display", "none");
            this.prestigeArenaTypeSelection.css("display", "none");
            this.prestigeArenaMiniGameSelection.css("display", "none");
            this.prestigeArenaImpostorCountSelection.css("display", "none");
            this.hidePrestigeArenaBattleSelections();
        }
    }

    canEditPrestigeArenaLiveOptions() {
        return (
            this.teamMenu.active &&
            this.teamMenu.arena &&
            this.teamMenu.joined &&
            this.teamMenu.isLeader &&
            !this.teamMenu.roomData.findingGame &&
            !this.teamMenu.players.some((player) => player.inGame)
        );
    }

    hidePrestigeArenaBattleSelections() {
        this.prestigeArenaBattleModeSelection.removeClass("is-open").css("display", "");
        this.prestigeArenaBattleTypeSelection.removeClass("is-open").css("display", "");
        this.prestigeArenaBattleMiniGameSelection
            .removeClass("is-open")
            .css("display", "");
        this.prestigeArenaBattleImpostorCountSelection
            .removeClass("is-open")
            .css("display", "");
    }

    togglePrestigeArenaBattleSelection(
        selection: JQuery<HTMLElement>,
        anchor?: JQuery<HTMLElement>,
    ) {
        const visible = selection.hasClass("is-open");
        this.prestigeArenaModeSelection.css("display", "none");
        this.prestigeArenaTypeSelection.css("display", "none");
        this.prestigeArenaMiniGameSelection.css("display", "none");
        this.prestigeArenaImpostorCountSelection.css("display", "none");
        this.hidePrestigeArenaBattleSelections();
        selection.css("display", "");
        if (!visible && anchor?.length) {
            const position = anchor.position();
            selection.css({
                left: `${position.left}px`,
                right: "auto",
                top: `${position.top + anchor.outerHeight()! + 6}px`,
                width: `${anchor.outerWidth()}px`,
            });
        }
        selection.toggleClass("is-open", !visible);
    }

    syncPrestigeArenaCreateOptions() {
        const canEdit =
            !this.teamMenu.active ||
            !this.teamMenu.arena ||
            !this.teamMenu.joined ||
            this.teamMenu.isLeader;
        const isBattleRoyale = this.isBattleRoyaleMiniGame(
            this.teamMenu.roomData.miniGame || this.prestigeArenaSelectedMiniGame,
        );
        $("#modal-create-window .private-option-buttons").toggleClass(
            "hide",
            isBattleRoyale,
        );
        this.prestigeArenaBattleOptions.toggleClass(
            "hide",
            isBattleRoyale || !this.teamMenu.isLeader,
        );
        this.prestigeArenaDisableAirstrikesBtn.toggleClass(
            "active",
            !!this.teamMenu.roomData.disableAirstrikes,
        );
        this.prestigeArenaDisablePerksBtn.toggleClass(
            "active",
            !!this.teamMenu.roomData.disablePerks,
        );
        this.prestigeArenaBattleDisableAirstrikesBtn.toggleClass(
            "active",
            !!this.teamMenu.roomData.disableAirstrikes,
        );
        this.prestigeArenaBattleDisablePerksBtn.toggleClass(
            "active",
            !!this.teamMenu.roomData.disablePerks,
        );
        this.prestigeArenaDisableAirstrikesBtn.attr(
            "aria-pressed",
            String(!!this.teamMenu.roomData.disableAirstrikes),
        );
        this.prestigeArenaDisablePerksBtn.attr(
            "aria-pressed",
            String(!!this.teamMenu.roomData.disablePerks),
        );
        this.prestigeArenaBattleDisableAirstrikesBtn.attr(
            "aria-pressed",
            String(!!this.teamMenu.roomData.disableAirstrikes),
        );
        this.prestigeArenaBattleDisablePerksBtn.attr(
            "aria-pressed",
            String(!!this.teamMenu.roomData.disablePerks),
        );
        this.prestigeArenaDisableAirstrikesBtn.prop("disabled", !canEdit || isBattleRoyale);
        this.prestigeArenaDisablePerksBtn.prop("disabled", !canEdit || isBattleRoyale);
        this.prestigeArenaBattleDisableAirstrikesBtn.prop(
            "disabled",
            !canEdit || isBattleRoyale,
        );
        this.prestigeArenaBattleDisablePerksBtn.prop(
            "disabled",
            !canEdit || isBattleRoyale,
        );
    }

    setPrestigeArenaCreateOption(
        prop: "disableAirstrikes" | "disablePerks",
        value: boolean,
    ) {
        if (
            this.teamMenu.active &&
            this.teamMenu.arena &&
            this.teamMenu.joined &&
            !this.teamMenu.isLeader
        ) {
            return;
        }

        if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.isLeader) {
            this.teamMenu.setRoomProperty(prop, value);
        } else {
            this.teamMenu.roomData[prop] = value;
        }
        this.syncPrestigeArenaCreateOptions();
    }

    populatePrestigeArenaModes() {
        this.prestigeArenaModeSelection.empty();
        this.prestigeArenaTypeSelection.empty();
        this.prestigeArenaMiniGameSelection.empty();
        this.prestigeArenaImpostorCountSelection.empty();
        this.prestigeArenaBattleModeSelection.empty();
        this.prestigeArenaBattleTypeSelection.empty();
        this.prestigeArenaBattleMiniGameSelection.empty();
        this.prestigeArenaBattleImpostorCountSelection.empty();
        const modes = this.siteInfo.info.modes || [];
        const allowedPrivateDeathmatchMaps = new Set([
            "main",
            "snow",
            "cobalt",
            "perks",
            "desert",
            "valentine",
            "inferno",
            "woods",
        ]);
        const gameModeStyles = this.siteInfo.getGameModeStyles();
        const deathmatchArenaModes = modes.filter((m) =>
            allowedPrivateDeathmatchMaps.has(m.mapName),
        );
        const battleRoyaleArenaModes = modes.filter(
            (m) => m.mapName.startsWith("br_") && [1, 2, 4].includes(m.teamMode),
        );
        if (!deathmatchArenaModes.length && !battleRoyaleArenaModes.length) {
            return;
        }

        let arenaModes = deathmatchArenaModes.length
            ? deathmatchArenaModes
            : battleRoyaleArenaModes;
        const getArenaModesForMiniGame = (miniGame: PrivateLobbyMiniGame) => {
            if (this.isBattleRoyaleMiniGame(miniGame) && battleRoyaleArenaModes.length) {
                return battleRoyaleArenaModes;
            }
            return deathmatchArenaModes.length ? deathmatchArenaModes : arenaModes;
        };
        const getTeamModesForMiniGame = (miniGame: PrivateLobbyMiniGame) =>
            this.isBattleRoyaleMiniGame(miniGame) ? [1, 2, 4] : [1, 2, 4, 10, 15];
        const mapStyleByName = new Map<
            string,
            {
                icon: string;
                buttonCss: string;
            }
        >();
        for (let i = 0; i < modes.length; i++) {
            const mapName = modes[i].mapName;
            if (mapStyleByName.has(mapName)) continue;
            const style = gameModeStyles[i];
            mapStyleByName.set(mapName, {
                icon: style?.icon || "",
                buttonCss: style?.buttonCss || "",
            });
        }
        const findModeIdx = (mapName: string, teamMode: number) =>
            modes.findIndex((m) => m.mapName === mapName && m.teamMode === teamMode);

        const applySelection = (mapName: string, teamMode: number, syncRoom = true) => {
            if (
                syncRoom &&
                this.teamMenu.active &&
                this.teamMenu.arena &&
                !this.teamMenu.isLeader
            ) {
                return;
            }
            let idx = findModeIdx(mapName, teamMode);
            if (idx < 0) {
                idx = arenaModes.findIndex((m) => m.mapName === mapName);
                if (idx >= 0) {
                    idx = modes.findIndex(
                        (m) =>
                            m.mapName === arenaModes[idx].mapName &&
                            m.teamMode === arenaModes[idx].teamMode,
                    );
                }
            }
            if (idx < 0) {
                idx = modes.findIndex(
                    (m) =>
                        m.mapName === arenaModes[0].mapName &&
                        m.teamMode === arenaModes[0].teamMode,
                );
            }
            if (idx < 0) return;

            this.prestigeArenaSelectedModeIdx = idx;
            this.prestigeArenaSelectedMap = modes[idx].mapName;
            this.prestigeArenaSelectedTeamMode = modes[idx].teamMode;

            const mapLabel = this.getModeDisplayName(this.prestigeArenaSelectedMap);
            const teamLabel = this.getArenaTeamModeDisplayName(
                this.prestigeArenaSelectedTeamMode,
                this.prestigeArenaSelectedMiniGame,
            );
            const teamIcon = this.getTeamModeIcon(this.prestigeArenaSelectedTeamMode);
            this.prestigeArenaModeLabel.text(mapLabel);
            this.prestigeArenaBattleModeLabel.text(mapLabel);
            this.prestigeArenaTypeLabel.text(teamLabel);
            this.prestigeArenaBattleTypeLabel.text(teamLabel);
            this.prestigeArenaTypeLabel.css("background-image", `url(${teamIcon})`);
            this.prestigeArenaBattleTypeLabel.css("background-image", `url(${teamIcon})`);

            const selectedStyle = mapStyleByName.get(this.prestigeArenaSelectedMap);
            this.prestigeArenaModeSelection
                .add(this.prestigeArenaBattleModeSelection)
                .find(".selection-button-mode")
                .each((_idx, el) => {
                    const selected =
                        $(el).attr("data-map-name") === this.prestigeArenaSelectedMap;
                    $(el).toggleClass("selected", selected);
                    $(el).attr("aria-pressed", String(selected));
                });
            this.prestigeArenaTypeSelection
                .add(this.prestigeArenaBattleTypeSelection)
                .find(".selection-button-type")
                .each((_idx, el) => {
                    const selected =
                        Number($(el).attr("data-team-mode")) ===
                        this.prestigeArenaSelectedTeamMode;
                    $(el).toggleClass("selected", selected);
                    $(el).attr("aria-pressed", String(selected));
                });
            this.prestigeArenaModeDropdown.removeClass((_idx, className) => {
                return this.siteInfo.getModeButtonClasses(className);
            });
            if (selectedStyle?.buttonCss) {
                this.prestigeArenaModeDropdown.addClass(selectedStyle.buttonCss);
            }
            this.prestigeArenaModeDropdown.css("background-image", "none");
            this.prestigeArenaModeLabel.css(
                "background-image",
                selectedStyle?.icon ? `url(${selectedStyle.icon})` : "none",
            );
            this.prestigeArenaBattleModeLabel.css(
                "background-image",
                selectedStyle?.icon ? `url(${selectedStyle.icon})` : "none",
            );
            this.prestigeArenaBattleModeRow.removeClass((_idx, className) => {
                return this.siteInfo.getModeButtonClasses(className);
            });
            if (selectedStyle?.buttonCss) {
                this.prestigeArenaBattleModeRow.addClass(selectedStyle.buttonCss);
            }

            if (syncRoom) {
                if (this.teamMenu.active && this.teamMenu.arena) {
                    this.teamMenu.setRoomProperty("gameModeIdx", idx);
                } else {
                    this.teamMenu.roomData.gameModeIdx = idx;
                }
            }
        };

        const applyMiniGameSelection = (
            miniGame: PrivateLobbyMiniGame,
            syncRoom = true,
        ) => {
            if (
                syncRoom &&
                this.teamMenu.active &&
                this.teamMenu.arena &&
                !this.teamMenu.isLeader
            ) {
                return;
            }
            const miniGameDef = getPrivateLobbyMiniGameDef(miniGame);
            this.prestigeArenaSelectedMiniGame = miniGame;
            renderModeAndTypeOptions(miniGame);
            const nextMode =
                arenaModes.find(
                    (m) =>
                        m.mapName === this.prestigeArenaSelectedMap &&
                        m.teamMode === this.prestigeArenaSelectedTeamMode,
                ) || arenaModes[0];
            if (nextMode) {
                applySelection(nextMode.mapName, nextMode.teamMode, syncRoom);
            }
            this.prestigeArenaMiniGameSelection
                .add(this.prestigeArenaBattleMiniGameSelection)
                .find(".selection-button-minigame")
                .each((_idx, el) => {
                    const selected = $(el).attr("data-minigame") === miniGame;
                    $(el).toggleClass("selected", selected);
                    $(el).attr("aria-pressed", String(selected));
                });
            this.prestigeArenaMiniGameLabel.text(miniGameDef.name);
            this.prestigeArenaMiniGameLabel.css(
                "background-image",
                "url(/img/gui/emote.svg)",
            );
            this.applyBattleMiniGameStyle(miniGame);
            if (syncRoom && this.teamMenu.active && this.teamMenu.arena) {
                this.teamMenu.setRoomProperty("miniGame", miniGame);
            } else {
                this.teamMenu.roomData.miniGame = miniGame;
            }
            this.renderPrestigeArenaTeams();
        };

        const applyImpostorCountSelection = (count: number, syncRoom = true) => {
            if (
                syncRoom &&
                this.teamMenu.active &&
                this.teamMenu.arena &&
                !this.teamMenu.isLeader
            ) {
                return;
            }
            this.setPrestigeArenaImpostorCount(count, syncRoom);
        };

        const renderModeAndTypeOptions = (miniGame: PrivateLobbyMiniGame) => {
            arenaModes = getArenaModesForMiniGame(miniGame);
            const maps = Array.from(new Set(arenaModes.map((m) => m.mapName)));
            const teamModes = getTeamModesForMiniGame(miniGame);
            this.prestigeArenaModeSelection.empty();
            this.prestigeArenaTypeSelection.empty();
            this.prestigeArenaBattleModeSelection.empty();
            this.prestigeArenaBattleTypeSelection.empty();

            for (let i = 0; i < maps.length; i++) {
                const mapName = maps[i];
                const mapLabel = this.getModeDisplayName(mapName);
                const style = mapStyleByName.get(mapName);
                const createButton = () => {
                    const btn = $("<div>", {
                        class: "selection-button-mode arena-mode-option",
                        "data-map-name": mapName,
                        role: "button",
                        "aria-pressed": "false",
                        text: mapLabel,
                    });
                    if (style?.buttonCss) {
                        btn.addClass(style.buttonCss);
                    }
                    if (style?.icon) {
                        btn.css("background-image", `url(${style.icon})`);
                    }
                    btn.on("click", () => {
                        applySelection(mapName, this.prestigeArenaSelectedTeamMode);
                        this.prestigeArenaModeSelection.css("display", "none");
                        this.prestigeArenaImpostorCountSelection.css("display", "none");
                        this.hidePrestigeArenaBattleSelections();
                    });
                    return btn;
                };
                this.prestigeArenaModeSelection.append(createButton());
                this.prestigeArenaBattleModeSelection.append(createButton());
            }

            for (let i = 0; i < teamModes.length; i++) {
                const teamMode = teamModes[i];
                const teamLabel = this.getArenaTeamModeDisplayName(teamMode, miniGame);
                const teamIcon = this.getTeamModeIcon(teamMode);
                const createButton = () => {
                    const btn = $("<div>", {
                        class: "selection-button-type",
                        "data-team-mode": String(teamMode),
                        role: "button",
                        "aria-pressed": "false",
                        text: teamLabel,
                    });
                    btn.css("background-image", `url(${teamIcon})`);
                    btn.on("click", () => {
                        applySelection(this.prestigeArenaSelectedMap, teamMode);
                        this.prestigeArenaTypeSelection.css("display", "none");
                        this.prestigeArenaImpostorCountSelection.css("display", "none");
                        this.hidePrestigeArenaBattleSelections();
                    });
                    return btn;
                };
                this.prestigeArenaTypeSelection.append(createButton());
                this.prestigeArenaBattleTypeSelection.append(createButton());
            }
        };

        for (const miniGame of PrivateLobbyMiniGameIds) {
            const miniGameDef = PrivateLobbyMiniGameDefs[miniGame];
            const createButton = () => {
                const btn = $("<div>", {
                    class: "selection-button-minigame",
                    "data-minigame": miniGame,
                    role: "button",
                    "aria-pressed": "false",
                    text: miniGameDef.name,
                });
                btn.css("background-image", "url(/img/gui/emote.svg)");
                btn.on("click", () => {
                    applyMiniGameSelection(miniGame);
                    this.prestigeArenaMiniGameSelection.css("display", "none");
                    this.prestigeArenaImpostorCountSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                });
                return btn;
            };
            this.prestigeArenaMiniGameSelection.append(createButton());
            this.prestigeArenaBattleMiniGameSelection.append(createButton());
        }

        for (const count of AmongUsImpostorCounts) {
            const createButton = () => {
                const btn = $("<div>", {
                    class: "selection-button-impostors",
                    "data-impostors": String(count),
                    role: "button",
                    "aria-pressed": "false",
                    text: this.getAmongUsImpostorCountLabel(count),
                });
                btn.on("click", () => {
                    applyImpostorCountSelection(count);
                    this.prestigeArenaImpostorCountSelection.css("display", "none");
                    this.hidePrestigeArenaBattleSelections();
                });
                return btn;
            };
            this.prestigeArenaImpostorCountSelection.append(createButton());
            this.prestigeArenaBattleImpostorCountSelection.append(createButton());
        }

        const configuredMode =
            this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined
                ? this.teamMenu.roomData.gameModeIdx
                : this.config.get("gameModeIdx");
        const initialMiniGame =
            this.teamMenu.roomData.miniGame || DefaultPrivateLobbyMiniGame;
        arenaModes = getArenaModesForMiniGame(initialMiniGame);
        const configuredArenaMode =
            configuredMode !== undefined &&
            modes[configuredMode] &&
            arenaModes.some(
                (m) =>
                    m.mapName === modes[configuredMode].mapName &&
                    m.teamMode === modes[configuredMode].teamMode,
            )
                ? modes[configuredMode]
                : arenaModes[0];
        if (configuredArenaMode) {
            this.prestigeArenaSelectedMap = configuredArenaMode.mapName;
            this.prestigeArenaSelectedTeamMode = configuredArenaMode.teamMode;
        }
        applyMiniGameSelection(initialMiniGame, false);
        applyImpostorCountSelection(
            this.teamMenu.roomData.amongUsImpostorCount ||
                this.prestigeArenaSelectedImpostorCount,
            false,
        );
        this.syncPrestigeArenaCreateOptions();
    }

    updatePrestigeJoinButtonState() {
        const codeInput = (this.prestigeArenaCodeInput.val() || "").trim();
        const parsed = this.parseInviteTarget(codeInput, true);
        this.prestigeArenaJoinBtn.toggleClass("active", parsed.roomUrl.length === 6);
    }

    applyBattleModeStyleByIdx(modeIdx: number) {
        const mode = this.siteInfo.info.modes?.[modeIdx];
        if (!mode) return;
        this.prestigeArenaBattleModeLabel.text(this.getModeDisplayName(mode.mapName));
        this.prestigeArenaBattleTypeLabel.text(
            this.getArenaTeamModeDisplayName(
                mode.teamMode,
                this.teamMenu.roomData.miniGame || this.prestigeArenaSelectedMiniGame,
            ),
        );
        this.prestigeArenaBattleTypeLabel.css(
            "background-image",
            `url(${this.getTeamModeIcon(mode.teamMode)})`,
        );

        const modeStyle = this.siteInfo.getGameModeStyles()[modeIdx];
        this.prestigeArenaBattleModeLabel.css(
            "background-image",
            modeStyle?.icon ? `url(${modeStyle.icon})` : "none",
        );
        this.prestigeArenaBattleModeRow.removeClass((_idx, className) => {
            return this.siteInfo.getModeButtonClasses(className);
        });
        if (modeStyle?.buttonCss) {
            this.prestigeArenaBattleModeRow.addClass(modeStyle.buttonCss);
        }
    }

    applyBattleMiniGameStyle(miniGame?: PrivateLobbyMiniGame) {
        const miniGameDef = getPrivateLobbyMiniGameDef(miniGame);
        this.prestigeArenaBattleMiniGameLabel.text(miniGameDef.name);
        this.prestigeArenaBattleMiniGameLabel.css(
            "background-image",
            "url(/img/gui/emote.svg)",
        );
        this.syncPrestigeArenaAmongUsOptions();
    }

    getAmongUsImpostorCountLabel(count: number) {
        return `${count} Impostor${count === 1 ? "" : "s"}`;
    }

    getPrestigeArenaStartErrorText() {
        const error = this.teamMenu.roomData.lastError;
        if (!error) return "";

        const miniGame = this.teamMenu.roomData.miniGame;
        if (
            miniGame === "among_us" &&
            (error === "waiting_for_players" || error === "arena_need_teams")
        ) {
            const impostorCount = normalizeAmongUsImpostorCount(
                this.teamMenu.roomData.amongUsImpostorCount,
            );
            const requiredPlayers = impostorCount * 2 + 1;
            const activePlayers = this.teamMenu.players.filter(
                (player) => player.team === "A" && !player.spectator,
            ).length;

            if (activePlayers < requiredPlayers) {
                const teamName = getPrivateLobbyMiniGameDef(miniGame).teamNames.A;
                return `Need ${requiredPlayers} players on ${teamName} for ${this.getAmongUsImpostorCountLabel(impostorCount)} (${activePlayers}/${requiredPlayers}).`;
            }

            return "";
        }

        const errorTextByType: Record<string, string> = {
            arena_need_teams: this.localization.translate("index-arena-need-teams"),
            game_in_progress: this.localization.translate("index-game-in-progress"),
            waiting_for_players: this.localization.translate("game-waiting-for-players"),
            find_game_error: this.localization.translate("index-failed-finding-game"),
            find_game_full: this.localization.translate("index-failed-finding-game"),
            find_game_invalid_protocol: this.localization.translate(
                "index-invalid-protocol",
            ),
            find_game_invalid_captcha: this.localization.translate(
                "index-invalid-captcha",
            ),
        };

        return (
            errorTextByType[error] ||
            this.localization.translate("index-failed-finding-game")
        );
    }

    setPrestigeArenaImpostorCount(count: number, syncRoom = true) {
        const impostorCount = normalizeAmongUsImpostorCount(count);
        this.prestigeArenaSelectedImpostorCount = impostorCount;
        this.prestigeArenaImpostorCountLabel.text(
            this.getAmongUsImpostorCountLabel(impostorCount),
        );
        this.prestigeArenaBattleImpostorCountLabel.text(
            this.getAmongUsImpostorCountLabel(impostorCount),
        );
        this.prestigeArenaImpostorCountSelection
            .add(this.prestigeArenaBattleImpostorCountSelection)
            .find(".selection-button-impostors")
            .each((_idx, el) => {
                const selected = Number($(el).attr("data-impostors")) === impostorCount;
                $(el).toggleClass("selected", selected);
                $(el).attr("aria-pressed", String(selected));
            });

        if (syncRoom && this.teamMenu.active && this.teamMenu.arena) {
            this.teamMenu.setRoomProperty("amongUsImpostorCount", impostorCount);
        } else {
            this.teamMenu.roomData.amongUsImpostorCount = impostorCount;
        }
        this.syncPrestigeArenaAmongUsOptions();
    }

    syncPrestigeArenaAmongUsOptions() {
        const miniGame = this.prestigeArenaSelectedMiniGame;
        const isAmongUs = miniGame === "among_us";
        const isBattleRoyale = this.isBattleRoyaleMiniGame(miniGame);
        const impostorCount = normalizeAmongUsImpostorCount(
            this.teamMenu.roomData.amongUsImpostorCount ||
                this.prestigeArenaSelectedImpostorCount,
        );
        this.prestigeArenaSelectedImpostorCount = impostorCount;
        this.prestigeArenaImpostorCountLabel.text(
            this.getAmongUsImpostorCountLabel(impostorCount),
        );
        this.prestigeArenaBattleImpostorCountLabel.text(
            this.getAmongUsImpostorCountLabel(impostorCount),
        );
        this.prestigeArenaImpostorCountSelection
            .add(this.prestigeArenaBattleImpostorCountSelection)
            .find(".selection-button-impostors")
            .each((_idx, el) => {
                const selected = Number($(el).attr("data-impostors")) === impostorCount;
                $(el).toggleClass("selected", selected);
                $(el).attr("aria-pressed", String(selected));
            });
        this.prestigeArenaImpostorCountGroup.toggleClass("hide", !isAmongUs);
        this.prestigeArenaBattleImpostorCountRow.toggleClass("hide", !isAmongUs);
        this.prestigeArenaCreatePane.toggleClass("arena-among-us", isAmongUs);
        this.prestigeArenaBattlePane.toggleClass("arena-among-us", isAmongUs);
        this.prestigeArenaCreatePane.toggleClass("arena-battle-royale", isBattleRoyale);
        this.prestigeArenaBattlePane.toggleClass("arena-battle-royale", isBattleRoyale);
        if (!isAmongUs) {
            this.prestigeArenaImpostorCountSelection.css("display", "none");
            this.prestigeArenaBattleImpostorCountSelection
                .removeClass("is-open")
                .css("display", "");
        }
    }

    updatePrestigeArenaJoinPreview() {
        if (this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined) {
            return;
        }
        const codeInput = (this.prestigeArenaCodeInput.val() || "").trim();
        const parsedInvite = this.parseInviteTarget(codeInput, true);
        if (parsedInvite.roomUrl.length !== 6) {
            this.prestigeArenaJoinBtn.text(
                this.localization.translate("index-join-team"),
            );
            this.applyBattleModeStyleByIdx(this.prestigeArenaSelectedModeIdx);
            this.applyBattleMiniGameStyle(this.prestigeArenaSelectedMiniGame);
            this.prestigeArenaPreviewReqId++;
            return;
        }
        const reqId = ++this.prestigeArenaPreviewReqId;
        $.ajax({
            type: "GET",
            url: api.resolveUrl(
                `/api/team_preview?roomUrl=${encodeURIComponent(parsedInvite.roomUrl)}&arena=1`,
            ),
            dataType: "json",
            success: (data: {
                exists?: boolean;
                gameModeIdx?: number;
                mapName?: string;
                teamMode?: number;
                miniGame?: PrivateLobbyMiniGame;
            }) => {
                if (reqId !== this.prestigeArenaPreviewReqId) return;
                if (!data?.exists || !Number.isFinite(data.gameModeIdx)) {
                    this.prestigeArenaJoinBtn.text(
                        this.localization.translate("index-join-team"),
                    );
                    this.applyBattleModeStyleByIdx(this.prestigeArenaSelectedModeIdx);
                    this.applyBattleMiniGameStyle(this.prestigeArenaSelectedMiniGame);
                    return;
                }
                const modeIdx = data.gameModeIdx as number;
                const mode = this.siteInfo.info.modes?.[modeIdx];
                if (!mode) return;
                this.applyBattleModeStyleByIdx(modeIdx);
                const miniGameDef = getPrivateLobbyMiniGameDef(data.miniGame);
                this.applyBattleMiniGameStyle(data.miniGame);
                const joinTarget = miniGameDef.battleRoyale
                    ? "Join"
                    : parsedInvite.preferredTeam
                      ? miniGameDef.teamNames[parsedInvite.preferredTeam]
                      : "Spectate";
                this.prestigeArenaJoinBtn.text(
                    `${joinTarget} ${this.getModeDisplayName(mode.mapName)} ${this.getArenaTeamModeDisplayName(mode.teamMode, data.miniGame)} ${miniGameDef.name}`,
                );
            },
            error: () => {
                if (reqId !== this.prestigeArenaPreviewReqId) return;
                this.prestigeArenaJoinBtn.text(
                    this.localization.translate("index-join-team"),
                );
                this.applyBattleModeStyleByIdx(this.prestigeArenaSelectedModeIdx);
                this.applyBattleMiniGameStyle(this.prestigeArenaSelectedMiniGame);
            },
        });
    }

    showCopyToast(left: number, top: number) {
        const toast = $("<div/>", {
            class: "copy-toast",
            html: "Copied!",
        });
        $("#start-menu-wrapper").append(toast);
        toast.css({
            left: left - parseInt(toast.css("width")) / 2,
            top,
        });
        toast.animate(
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
    }

    setPrestigeArenaUnjoinedUi() {
        this.prestigeArenaWrapper.addClass("arena-unjoined-shell");
        this.prestigeArenaWrapper.removeClass("arena-joined-shell");
        this.syncPrestigeArenaCreatePaneVisibility();
        this.prestigeArenaBattleInputGroup.css("display", "inline-flex");
        this.prestigeArenaPlayerCounter.css("display", "none");
        this.prestigeArenaCodeRow.css("display", "none");
        this.prestigeArenaSpectatorCodeNote.addClass("hide");
        this.prestigeArenaRoomCode.text("");
        this.prestigeArenaTeamsBoard.addClass("hide");
        this.prestigeArenaWrapper.removeClass("arena-large-teams");
        this.prestigeArenaBattlePane.removeClass("arena-large-teams");
        this.prestigeArenaBattlePane.removeClass("arena-joined-layout");
        this.prestigeArenaTeamsBoard.removeClass(
            "arena-large-teams arena-single-team arena-battle-royale-summary",
        );
        this.prestigeArenaSpectatorsBoard.addClass("hide");
        this.prestigeArenaBattleOptions.addClass("hide");
        this.hidePrestigeArenaBattleSelections();
        this.prestigeArenaTeamAList.empty();
        this.prestigeArenaTeamBList.empty();
        this.prestigeArenaSpectatorList.empty();
        this.prestigeArenaPlayerCounter.removeClass("active");
        this.prestigeArenaGameStatus.addClass("hide").removeClass("error");
        this.prestigeArenaGameStatusStarted.addClass("hide");
        this.prestigeArenaGameStatusToStart.removeClass("hide");
        this.prestigeArenaJoinBtn.text(this.localization.translate("index-join-team"));
        this.prestigeArenaPreviewReqId++;
        this.applyBattleModeStyleByIdx(this.prestigeArenaSelectedModeIdx);
        this.applyBattleMiniGameStyle(this.prestigeArenaSelectedMiniGame);
        this.syncPrestigeArenaCreateOptions();
        this.updatePrestigeJoinButtonState();
    }

    renderPrestigeArenaTeams() {
        this.prestigeArenaTeamAList.empty();
        this.prestigeArenaTeamBList.empty();
        this.prestigeArenaSpectatorList.empty();
        if (!(this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined)) {
            this.prestigeArenaTeamsBoard.addClass("hide");
            this.prestigeArenaWrapper.removeClass("arena-large-teams");
            this.prestigeArenaBattlePane.removeClass("arena-large-teams");
            this.prestigeArenaTeamsBoard.removeClass(
                "arena-large-teams arena-single-team arena-battle-royale-summary",
            );
            this.prestigeArenaSpectatorsBoard.addClass("hide");
            return;
        }

        const mode = this.siteInfo.info.modes?.[this.teamMenu.roomData.gameModeIdx];
        const teamSize = Math.max(1, mode?.teamMode ?? 2);
        const miniGameDef = getPrivateLobbyMiniGameDef(this.teamMenu.roomData.miniGame);
        const battleRoyaleLobby = !!miniGameDef.battleRoyale;
        const singleTeam = !!miniGameDef.singleTeam;
        if (battleRoyaleLobby) {
            const players = this.teamMenu.players;
            const owner = players.find((p) => p.isLeader) || players[0];
            const maxPlayers = this.teamMenu.roomData.maxPlayers || 80;
            this.prestigeArenaWrapper.removeClass("arena-large-teams");
            this.prestigeArenaBattlePane.removeClass("arena-large-teams");
            this.prestigeArenaTeamsBoard
                .removeClass("arena-large-teams arena-single-team")
                .addClass("arena-battle-royale-summary");
            this.prestigeArenaTeamBList.empty();
            this.prestigeArenaSpectatorList.empty();
            $(".arena-team-b").addClass("hide");
            this.prestigeArenaSpectatorsBoard.addClass("hide");
            this.setPrestigeArenaMobilePanel("chat");

            $("#arena-team-a-title")
                .empty()
                .append($("<span>", { class: "arena-team-name", text: "Battle Royale" }))
                .append(
                    $("<span>", {
                        class: "arena-team-count",
                        text: `${players.length}/${maxPlayers}`,
                    }),
                );
            this.prestigeArenaTeamAList.append(
                $("<div>", { class: "arena-br-lobby-card" })
                    .append(
                        $("<div>", { class: "arena-br-lobby-hero" })
                            .append(
                                $("<div>", {
                                    class: "arena-br-lobby-mode",
                                    text: "Private Battle Royale",
                                }),
                            )
                            .append(
                                $("<div>", {
                                    class: "arena-br-lobby-sub",
                                    text: `${this.getArenaTeamModeDisplayName(
                                        teamSize,
                                        this.teamMenu.roomData.miniGame,
                                    )} lobby`,
                                }),
                            ),
                    )
                    .append(
                        $("<div>", { class: "arena-br-lobby-row arena-br-lobby-owner" })
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-label",
                                    text: "Owner",
                                }),
                            )
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-value",
                                    html: owner
                                        ? owner.clanName
                                            ? `${helpers.getClanTagHtml(owner.clanName, owner.clanTagColor || "")} ${helpers.htmlEscape(owner.name)}`
                                            : helpers.htmlEscape(owner.name)
                                        : "Waiting",
                                }),
                            ),
                    )
                    .append(
                        $("<div>", { class: "arena-br-lobby-row arena-br-lobby-players" })
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-label",
                                    text: "Players",
                                }),
                            )
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-value",
                                    text: `${players.length}/${maxPlayers}`,
                                }),
                            ),
                    )
                    .append(
                        $("<div>", { class: "arena-br-lobby-row arena-br-lobby-type" })
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-label",
                                    text: "Type",
                                }),
                            )
                            .append(
                                $("<span>", {
                                    class: "arena-br-lobby-value",
                                    text: this.getArenaTeamModeDisplayName(
                                        teamSize,
                                        this.teamMenu.roomData.miniGame,
                                    ),
                                }),
                            ),
                    ),
            );
            this.prestigeArenaTeamsBoard.removeClass("hide");
            return;
        }
        this.prestigeArenaTeamsBoard.removeClass("arena-battle-royale-summary");
        const largeTeams = teamSize >= 10;
        const largeTeamColumns = largeTeams ? 2 : 1;
        const largeTeamRows = largeTeams
            ? Math.ceil(teamSize / largeTeamColumns)
            : Math.min(teamSize, 5);
        this.prestigeArenaWrapper.toggleClass("arena-large-teams", largeTeams);
        this.prestigeArenaBattlePane.toggleClass("arena-large-teams", largeTeams);
        this.prestigeArenaTeamsBoard.toggleClass("arena-large-teams", largeTeams);
        this.prestigeArenaTeamsBoard.toggleClass("arena-single-team", singleTeam);
        this.prestigeArenaTeamsBoard.css({
            "--arena-single-team-columns": String(Math.min(teamSize, 5)),
            "--arena-team-columns": String(largeTeamColumns),
            "--arena-team-rows": String(largeTeamRows),
        });
        this.applyBattleModeStyleByIdx(this.teamMenu.roomData.gameModeIdx);
        this.applyBattleMiniGameStyle(this.teamMenu.roomData.miniGame);
        const teamA = this.teamMenu.players.filter((p) => p.team === "A" && !p.spectator);
        const teamB = this.teamMenu.players.filter((p) => p.team === "B" && !p.spectator);
        const spectators = this.teamMenu.players.filter(
            (p) => p.spectator || (!p.team && this.teamMenu.arena),
        );
        const canManage = this.teamMenu.isLeader;
        const teamsLocked = !!this.teamMenu.roomData.teamsLocked;
        const localArenaPlayer = this.teamMenu.players.find(
            (p) => p.playerId === this.teamMenu.localPlayerId,
        );
        const localTarget = localArenaPlayer?.spectator
            ? "spectator"
            : localArenaPlayer?.team;
        const teamChangingBlocked =
            this.teamMenu.roomData.findingGame ||
            this.teamMenu.players.some((p) => p.inGame);
        const hostCanAssign = canManage && teamsLocked && !teamChangingBlocked;
        const formatArenaPlayerName = (
            playerName: string,
            clanName?: string,
            clanTagColor?: string,
        ) =>
            clanName
                ? `${helpers.getClanTagHtml(clanName, clanTagColor || "")} ${helpers.htmlEscape(playerName)}`
                : helpers.htmlEscape(playerName);

        const buildJoinButton = (target: "A" | "B" | "spectator", label: string) => {
            const selected = localTarget === target;
            const lockedForPlayer = teamsLocked && !canManage;
            const button = $("<button>", {
                class: `arena-team-join btn-darken${selected ? " selected" : ""}`,
                type: "button",
                text: lockedForPlayer ? "Locked" : selected ? "Joined" : label,
                disabled: teamChangingBlocked || selected || lockedForPlayer,
            });
            button.on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (teamChangingBlocked || selected || lockedForPlayer) return;
                this.teamMenu.swapPlayerTeam(this.teamMenu.localPlayerId, target);
            });
            return button;
        };

        const buildLockButton = () => {
            const lockHelp = "Lock teams: owner can drag people and put them in a team";
            const button = $("<button>", {
                id: "arena-team-lock",
                class: `arena-team-lock btn-darken${teamsLocked ? " locked" : ""}`,
                type: "button",
                title: teamsLocked ? `Unlock teams. ${lockHelp}` : lockHelp,
                "aria-label": teamsLocked ? "Unlock teams" : lockHelp,
                disabled: !canManage || teamChangingBlocked,
            });
            button.on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!canManage || teamChangingBlocked) return;
                this.teamMenu.setRoomProperty("teamsLocked", !teamsLocked);
            });
            return button;
        };

        const renderHeading = (
            titleEl: JQuery<HTMLElement>,
            title: string,
            target: "A" | "B" | "spectator",
            count: number,
            capacity?: number,
            label = "Join",
        ) => {
            titleEl.empty();
            titleEl.append($("<span>", { class: "arena-team-name", text: title }));
            titleEl.append(
                $("<span>", {
                    class: "arena-team-count",
                    text: capacity === undefined ? String(count) : `${count}/${capacity}`,
                }),
            );
            if (target === "A") {
                titleEl.append(buildLockButton());
            }
            titleEl.append(buildJoinButton(target, label));
        };

        renderHeading(
            $("#arena-team-a-title"),
            miniGameDef.teamNames.A,
            "A",
            teamA.length,
            teamSize,
        );
        $(".arena-team-b").toggleClass("hide", singleTeam);
        if (!singleTeam) {
            renderHeading(
                $("#arena-team-b-title"),
                miniGameDef.teamNames.B,
                "B",
                teamB.length,
                teamSize,
            );
        }
        renderHeading(
            $("#arena-spectators-title"),
            "Spectators",
            "spectator",
            spectators.length,
            undefined,
            "Spectate",
        );

        const buildSlot = (
            list: JQuery<HTMLElement>,
            player: (typeof teamA)[number] | undefined,
            target: "A" | "B",
        ) => {
            const slot = $("<div>", {
                class: `arena-team-slot${player ? "" : " empty"}`,
                "data-team-target": target,
            });
            if (!player) {
                slot.append($("<div>", { class: "arena-player-name", text: "Empty" }));
                list.append(slot);
                return;
            }
            if (hostCanAssign) {
                slot.attr("draggable", "true");
                slot.attr("data-playerid", String(player.playerId));
            }
            slot.append(
                $("<div>", {
                    class: "arena-player-name",
                    html: formatArenaPlayerName(
                        player.name,
                        player.clanName,
                        player.clanTagColor,
                    ),
                }),
            );
            if (player.isLeader) {
                slot.append(
                    $("<div>", {
                        class: "icon icon-leader",
                        title: "Host",
                        "aria-label": "Host",
                    }),
                );
            }

            if (player.inGame) {
                slot.append(
                    $("<div>", {
                        class: "icon icon-in-game",
                    }),
                );
            }

            if (canManage && player.playerId !== this.teamMenu.localPlayerId) {
                const kick = $("<div>", {
                    class: "icon icon-kick",
                    "aria-label": "Kick player",
                    role: "button",
                    tabindex: 0,
                });
                kick.on("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.teamMenu.kickPlayer(player.playerId);
                });
                kick.on("keydown", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        this.teamMenu.kickPlayer(player.playerId);
                    }
                });
                slot.append(kick);
            }
            list.append(slot);
        };

        for (let i = 0; i < teamSize; i++) {
            buildSlot(this.prestigeArenaTeamAList, teamA[i], "A");
            if (!singleTeam) {
                buildSlot(this.prestigeArenaTeamBList, teamB[i], "B");
            }
        }
        this.prestigeArenaTeamsBoard.removeClass("hide");
        this.prestigeArenaSpectatorList.empty();
        if (!spectators.length) {
            const emptySpectatorSlots = largeTeams ? 5 : 1;
            for (let i = 0; i < emptySpectatorSlots; i++) {
                this.prestigeArenaSpectatorList.append(
                    $("<div>", {
                        class: "arena-spectator-item empty",
                    }).append(
                        $("<div>", {
                            class: "arena-player-name",
                            text: "Empty",
                        }),
                    ),
                );
            }
        } else {
            for (let i = 0; i < spectators.length; i++) {
                const spec = spectators[i];
                const row = $("<div>", {
                    class: "arena-spectator-item",
                    "data-team-target": "spectator",
                });
                if (hostCanAssign) {
                    row.attr("draggable", "true");
                    row.attr("data-playerid", String(spec.playerId));
                }
                row.append(
                    $("<div>", {
                        class: "arena-player-name",
                        html: formatArenaPlayerName(
                            spec.name || "Spectator",
                            spec.clanName,
                            spec.clanTagColor,
                        ),
                    }),
                );
                if (spec.isLeader) {
                    row.append(
                        $("<div>", {
                            class: "icon icon-leader",
                            title: "Host",
                            "aria-label": "Host",
                        }),
                    );
                }
                if (spec.inGame) {
                    row.append(
                        $("<div>", {
                            class: "icon icon-in-game",
                        }),
                    );
                }
                if (canManage && spec.playerId !== this.teamMenu.localPlayerId) {
                    const kick = $("<div>", {
                        class: "icon icon-kick",
                        "aria-label": "Kick player",
                        role: "button",
                        tabindex: 0,
                    });
                    kick.on("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.teamMenu.kickPlayer(spec.playerId);
                    });
                    kick.on("keydown", (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            this.teamMenu.kickPlayer(spec.playerId);
                        }
                    });
                    row.append(kick);
                }
                this.prestigeArenaSpectatorList.append(row);
            }
        }
        this.prestigeArenaSpectatorsBoard.removeClass("hide");

        const dropTargets = singleTeam
            ? $(".arena-team-a, #arena-spectators-board")
            : $(".arena-team-a, .arena-team-b, #arena-spectators-board");
        dropTargets.toggleClass("arena-drop-enabled", hostCanAssign);
        if (hostCanAssign) {
            $(
                ".arena-team-slot[draggable=true], .arena-spectator-item[draggable=true]",
            ).on("dragstart", (e) => {
                const playerId = $(e.currentTarget).attr("data-playerid") || "";
                e.originalEvent?.dataTransfer?.setData("text/plain", playerId);
                e.originalEvent?.dataTransfer?.setData(
                    "application/x-player-id",
                    playerId,
                );
                e.originalEvent?.dataTransfer?.setDragImage(e.currentTarget, 12, 12);
                $(e.currentTarget).addClass("dragging");
            });
            $(
                ".arena-team-slot[draggable=true], .arena-spectator-item[draggable=true]",
            ).on("dragend", (e) => {
                $(e.currentTarget).removeClass("dragging");
                dropTargets.removeClass("drag-over");
            });
            dropTargets.on("dragover", (e) => {
                e.preventDefault();
                $(e.currentTarget).addClass("drag-over");
            });
            dropTargets.on("dragleave", (e) => {
                $(e.currentTarget).removeClass("drag-over");
            });
            dropTargets.on("drop", (e) => {
                e.preventDefault();
                dropTargets.removeClass("drag-over");
                const playerId = Number(
                    e.originalEvent?.dataTransfer?.getData("application/x-player-id") ||
                        e.originalEvent?.dataTransfer?.getData("text/plain"),
                );
                if (!Number.isFinite(playerId)) return;

                const targetEl = $(e.currentTarget);
                const id = e.currentTarget.id;
                const target =
                    id === "arena-team-a-list" || targetEl.hasClass("arena-team-a")
                        ? "A"
                        : id === "arena-team-b-list" || targetEl.hasClass("arena-team-b")
                          ? "B"
                          : "spectator";
                this.teamMenu.swapPlayerTeam(playerId, target);
            });
        }
    }

    showPrestigeArenaModal() {
        if (!this.account.loggedIn) {
            this.profileUi.showLoginMenu({
                modal: true,
            });
            return;
        }
        this.prestigeArenaModalRequestedOpen = true;
        this.prestigeArenaSummaryTab.addClass("hide");
        this.prestigeArenaSpectateTab.addClass("hide");
        this.prestigeArenaBattleTab.removeClass("hide");
        this.prestigeArenaCreateTab.addClass("hide");
        this.syncPrestigeArenaRegions();
        this.setPrestigeArenaTab("battle");
        this.populatePrestigeArenaModes();
        this.prestigeArenaCodeInput.val("");
        this.prestigeArenaCreateBtn.text(
            this.localization.translate("prestige-create-battle"),
        );
        this.setPrestigeArenaUnjoinedUi();
        this.setPrestigeArenaModalVisible(true);
    }

    hidePrestigeArenaModal() {
        this.prestigeArenaModalRequestedOpen = false;
        this.setPrestigeArenaMobilePanel("spectators");
        this.prestigeArenaModeSelection.css("display", "none");
        this.prestigeArenaTypeSelection.css("display", "none");
        this.prestigeArenaMiniGameSelection.css("display", "none");
        this.prestigeArenaImpostorCountSelection.css("display", "none");
        this.hidePrestigeArenaBattleSelections();
        this.setPrestigeArenaModalVisible(false);
    }

    setPrestigeArenaMobilePanel(panel: "spectators" | "chat") {
        const chatActive = panel === "chat";
        this.prestigeArenaModal.toggleClass("arena-mobile-chat-active", chatActive);
        this.prestigeArenaModal.toggleClass("arena-mobile-spectators-active", !chatActive);
        $("#arena-mobile-chat-tab").toggleClass("selected", chatActive);
        $("#arena-mobile-spectators-tab").toggleClass("selected", !chatActive);
    }

    setPrestigeArenaModalVisible(visible: boolean) {
        this.prestigeArenaModal.toggleClass("is-open", visible);
        this.prestigeArenaModal.css({
            display: visible ? "block" : "none",
            "pointer-events": visible ? "auto" : "none",
        });
        this.prestigeArenaWrapper.css({
            display: visible ? "block" : "none",
            "pointer-events": visible ? "auto" : "none",
        });
    }

    syncPrestigeArenaRoomUi() {
        if (!(this.teamMenu.active && this.teamMenu.arena)) {
            this.prestigeArenaBattlePane.removeClass("arena-joined-layout");
            this.prestigeArenaWrapper.removeClass("arena-joined-shell");
            this.prestigeArenaWrapper.removeClass("arena-unjoined-shell");
            this.prestigeArenaWrapper.removeClass("arena-large-teams");
            this.prestigeArenaBattlePane.removeClass("arena-large-teams");
            this.prestigeArenaTeamsBoard.removeClass(
                "arena-large-teams arena-single-team arena-battle-royale-summary",
            );
            this.lastArenaPreloadedMapName = "";
            this.prestigeArenaModalRequestedOpen = false;
            this.setPrestigeArenaModalVisible(false);
            return;
        }

        if (!this.prestigeArenaModalRequestedOpen) {
            this.setPrestigeArenaModalVisible(false);
            return;
        }

        this.setPrestigeArenaModalVisible(true);
        this.prestigeArenaSummaryTab.addClass("hide");
        this.prestigeArenaSpectateTab.addClass("hide");

        if (!this.teamMenu.joined) {
            this.prestigeArenaBattlePane.removeClass("arena-joined-layout");
            this.prestigeArenaWrapper.removeClass("arena-joined-shell");
            this.prestigeArenaWrapper.addClass("arena-unjoined-shell");
            this.prestigeArenaWrapper.removeClass("arena-large-teams");
            this.prestigeArenaBattlePane.removeClass("arena-large-teams");
            this.prestigeArenaTeamsBoard.removeClass(
                "arena-large-teams arena-single-team arena-battle-royale-summary",
            );
            this.prestigeArenaBattleTab.removeClass("hide");
            this.prestigeArenaCreateTab.addClass("hide");
            if (this.teamMenu.create) {
                this.setPrestigeArenaTab("battle");
                this.prestigeArenaCreateBtn.text(
                    this.localization.translate("index-creating-team"),
                );
            } else {
                this.setPrestigeArenaTab("battle");
                this.prestigeArenaCreateBtn.text(
                    this.localization.translate("prestige-create-battle"),
                );
            }
            this.setPrestigeArenaUnjoinedUi();
            this.lastArenaPreloadedMapName = "";
            return;
        }

        const code = this.teamMenu.roomData.roomUrl?.replace("#", "") ?? "";
        if (code.length) {
            this.prestigeArenaCodeInput.val(code);
        }
        this.prestigeArenaRoomCode.text(code);
        this.prestigeArenaSelectedMiniGame =
            this.teamMenu.roomData.miniGame || DefaultPrivateLobbyMiniGame;
        this.prestigeArenaSelectedImpostorCount = normalizeAmongUsImpostorCount(
            this.teamMenu.roomData.amongUsImpostorCount,
        );
        this.prestigeArenaMiniGameLabel.text(
            getPrivateLobbyMiniGameDef(this.prestigeArenaSelectedMiniGame).name,
        );
        this.prestigeArenaMiniGameLabel.css(
            "background-image",
            "url(/img/gui/emote.svg)",
        );
        this.applyBattleMiniGameStyle(this.prestigeArenaSelectedMiniGame);
        this.syncPrestigeArenaAmongUsOptions();
        this.prestigeArenaCodeRow.css("display", code.length ? "flex" : "none");
        this.prestigeArenaSpectatorCodeNote.toggleClass("hide", !code.length);
        this.prestigeArenaWrapper.addClass("arena-joined-shell");
        this.prestigeArenaWrapper.removeClass("arena-unjoined-shell");
        this.prestigeArenaBattlePane.addClass("arena-joined-layout");
        this.syncPrestigeArenaCreatePaneVisibility();
        this.prestigeArenaBattleInputGroup.css("display", "none");
        this.prestigeArenaPlayerCounter.css("display", "flex");
        this.prestigeArenaBattleOptions.toggleClass("hide", !this.teamMenu.isLeader);
        if (
            this.teamMenu.isLeader &&
            !this.prestigeArenaBattleModeSelection.children().length
        ) {
            this.populatePrestigeArenaModes();
        }
        this.warmupArenaLobbyMapAssets();
        this.renderPrestigeArenaTeams();
        const mode = this.siteInfo.info.modes?.[this.teamMenu.roomData.gameModeIdx];
        const lobbyRegion =
            this.teamMenu.roomData.region || this.config.get("region") || "";
        if (mode && lobbyRegion) {
            this.prestigeArenaBattleModeLabel.html(
                `${helpers.htmlEscape(this.getModeDisplayName(mode.mapName))} <span class="battle-mode-region">(${helpers.htmlEscape(lobbyRegion.toUpperCase())})</span>`,
            );
        }
        const joinedCount = this.teamMenu.players.length;
        const maxPlayers = this.teamMenu.roomData.maxPlayers || 80;
        this.prestigeArenaPlayerCount.text(String(joinedCount));
        this.prestigeArenaPlayerMax.text(String(maxPlayers));
        this.prestigeArenaPlayerCounter.toggleClass("active", joinedCount > 0);
        const hasInGamePlayers = this.teamMenu.players.some((player) => player.inGame);
        const started = this.teamMenu.roomData.findingGame || hasInGamePlayers;
        const startErrorText = this.getPrestigeArenaStartErrorText();
        if (hasInGamePlayers && !this.teamMenu.roomData.findingGame) {
            this.prestigeArenaGameStatusStarted.text(
                `${this.localization.translate("game-waiting-for-players")}...`,
            );
        } else {
            this.prestigeArenaGameStatusStarted.text(
                this.localization.translate("game-status-started"),
            );
        }
        this.prestigeArenaGameStatusToStart.text(
            startErrorText || this.localization.translate("index-ready-to-start"),
        );
        this.prestigeArenaGameStatus.toggleClass("error", !!startErrorText);
        this.prestigeArenaGameStatusStarted.toggleClass(
            "hide",
            !!startErrorText || !started,
        );
        this.prestigeArenaGameStatusToStart.toggleClass(
            "hide",
            !startErrorText && started,
        );
        this.prestigeArenaGameStatus.toggleClass("hide", false);

        this.prestigeArenaCreateBtn.text(
            this.localization.translate("prestige-create-battle"),
        );
        this.prestigeArenaBattleTab.removeClass("hide");
        this.prestigeArenaCreateTab.addClass("hide");
        this.setPrestigeArenaTab("battle", true);
        this.syncPrestigeArenaCreateOptions();
        const localArenaPlayer = this.teamMenu.players.find(
            (p) => p.playerId === this.teamMenu.localPlayerId,
        );
        const localIsSpectator = !!localArenaPlayer?.spectator;
        if (this.teamMenu.isLeader) {
            const label = this.teamMenu.roomData.findingGame
                ? this.localization.translate("index-joining-game")
                : this.localization.translate("index-play");
            this.prestigeArenaJoinBtn.text(label);
            this.prestigeArenaJoinBtn.toggleClass(
                "active",
                !this.teamMenu.roomData.findingGame,
            );
        } else {
            this.prestigeArenaJoinBtn.text(
                localIsSpectator
                    ? this.localization.translate("index-arena-spectator")
                    : this.localization.translate("index-waiting-for-leader"),
            );
            this.prestigeArenaJoinBtn.removeClass("active");
        }
    }

    waitOnAccount(cb: () => void) {
        if (this.account.requestsInFlight == 0) {
            cb();
        } else {
            // Wait some maximum amount of time for pending account requests
            const timeout = setTimeout(() => {
                runOnce();
                errorLogManager.storeGeneric("account", "wait_timeout");
            }, 2500);
            const runOnce = () => {
                cb();
                clearTimeout(timeout);
                this.account.removeEventListener("requestsComplete", runOnce);
            };
            this.account.addEventListener("requestsComplete", runOnce);
        }
    }

    parseInviteTarget(rawUrlOrCode: string, fallbackArena = false) {
        let source = (rawUrlOrCode || "").trim();
        let arena = fallbackArena;
        let roomUrl = "";
        let preferredTeam: "A" | "B" | undefined;
        let spectator: boolean | undefined;

        if (!source) {
            return { roomUrl, arena, preferredTeam, spectator };
        }

        const tryParseCode = (rawCode: string) => {
            let code = rawCode.trim();
            const lowered = code.toLowerCase();
            if (lowered.startsWith("arena:") || lowered.startsWith("a:")) {
                code = code.slice(code.indexOf(":") + 1);
                arena = true;
            } else if (lowered.startsWith("arena-") || lowered.startsWith("a-")) {
                code = code.slice(code.indexOf("-") + 1);
                arena = true;
            }
            code = code.replace(/^#/, "").trim();
            const suffixIdx = code.indexOf("?");
            if (suffixIdx >= 0) {
                const suffix = code
                    .slice(suffixIdx + 1)
                    .trim()
                    .toUpperCase();
                code = code.slice(0, suffixIdx).trim();
                if (suffix === "S" || suffix === "SPEC") {
                    spectator = true;
                } else if (suffix === "A" || suffix === "TEAM_A") {
                    preferredTeam = "A";
                    spectator = false;
                } else if (suffix === "B" || suffix === "TEAM_B") {
                    preferredTeam = "B";
                    spectator = false;
                }
            }
            return code;
        };

        if (/^https?:\/\//i.test(source) || source.includes("#")) {
            try {
                const url = /^https?:\/\//i.test(source)
                    ? new URL(source)
                    : new URL(source, window.location.href);
                const paramCode =
                    url.searchParams.get("roomID") ||
                    url.searchParams.get("lobbycode") ||
                    url.searchParams.get("code") ||
                    "";
                const hashCode = url.hash ? url.hash.slice(1) : "";
                source = paramCode || hashCode;
                const arenaParam = (url.searchParams.get("arena") || "").toLowerCase();
                if (
                    arenaParam === "1" ||
                    arenaParam === "true" ||
                    arenaParam === "arena"
                ) {
                    arena = true;
                }
            } catch {
                // fall through to plain-code parsing
            }
        }

        roomUrl = tryParseCode(source);
        if (!arena && roomUrl.length === 6) {
            // Arena room codes are six chars; team codes are shorter.
            arena = true;
        }
        if (arena && spectator === undefined && !preferredTeam) {
            // Plain arena code joins as spectator by default.
            spectator = true;
        }

        return { roomUrl, arena, preferredTeam, spectator };
    }

    tryJoinTeam(
        create: boolean,
        url?: string,
        arena = false,
        joinPrefs?: {
            preferredTeam?: "A" | "B";
            spectator?: boolean;
        },
    ) {
        if (this.active && this.quickPlayPendingModeIdx === -1) {
            if (create && arena) {
                // Arena create must always create a fresh arena room, never infer from URL/hash.
                if (this.teamMenu.active && !this.teamMenu.joined) {
                    this.teamMenu.leave();
                }
                this.prestigeArenaModalRequestedOpen = true;
                const arenaModeIdx = this.prestigeArenaSelectedModeIdx;
                const createRegion = this.prestigeArenaRegionSelect
                    .find(":selected")
                    .val();
                this.setConfigFromDOM();
                if (Number.isFinite(arenaModeIdx) && arenaModeIdx >= 0) {
                    this.config.set("gameModeIdx", arenaModeIdx);
                }
                if (createRegion) {
                    this.config.set("region", createRegion as string);
                }
                this.teamMenu.connect(true, "", true, { spectator: true });
                this.teamMenu.roomData.miniGame = this.prestigeArenaSelectedMiniGame;
                this.teamMenu.roomData.amongUsImpostorCount =
                    this.prestigeArenaSelectedImpostorCount;
                this.refreshUi();
                return;
            }

            // Join team if the url contains a team address
            let roomUrlRaw = url || window.location.hash.slice(1);
            const urlArenaParam = (
                helpers.getParameterByName("arena") || ""
            ).toLowerCase();
            let targetArena =
                arena ||
                urlArenaParam === "1" ||
                urlArenaParam === "true" ||
                urlArenaParam === "arena";

            const sdkRoom = SDK.getRoomInviteParam();
            if (sdkRoom) {
                roomUrlRaw = sdkRoom;
                create = false;
            }

            const parsed = this.parseInviteTarget(roomUrlRaw, targetArena);
            const roomUrl = parsed.roomUrl;
            targetArena = parsed.arena;
            const effectiveJoinPrefs = joinPrefs || {
                preferredTeam: parsed.preferredTeam,
                spectator: parsed.spectator,
            };

            if (create || roomUrl != "") {
                // The main menu and squad menus have separate
                // DOM elements for input, such as player name and
                // selected region. We will stash the menu values
                // into the config so the team menu can read them.
                this.prestigeArenaModalRequestedOpen = targetArena;
                this.setConfigFromDOM();
                this.teamMenu.connect(create, roomUrl, targetArena, effectiveJoinPrefs);
                this.refreshUi();
            }
        }
    }

    warmupArenaLobbyMapAssets() {
        if (!(this.teamMenu.active && this.teamMenu.arena && this.teamMenu.joined))
            return;
        if (!this.resourceManager) return;
        const mode = this.siteInfo.info.modes?.[this.teamMenu.roomData.gameModeIdx];
        const mapName = mode?.mapName;
        if (!mapName) return;
        if (mapName === this.lastArenaPreloadedMapName) return;
        this.lastArenaPreloadedMapName = mapName;
        this.resourceManager.loadMapAssets(mapName);
    }

    tryQuickStartGame(gameModeIdx: number) {
        if (this.quickPlayPendingModeIdx === -1) {
            // Update UI to display a spinner on the play button
            this.errorMessage = "";
            this.quickPlayPendingModeIdx = gameModeIdx;
            this.setConfigFromDOM();
            this.refreshUi();

            // Wait some amount of time if we've recently attempted to
            // find a game to prevent spamming the server
            let delay = 0;
            if (this.findGameAttempts > 0 && Date.now() - this.findGameTime < 30000) {
                delay = Math.min(this.findGameAttempts * 2.5 * 1000, 7500);
            } else {
                this.findGameAttempts = 0;
            }
            this.findGameTime = Date.now();
            this.findGameAttempts++;

            const version = GameConfig.protocolVersion;
            let region = this.config.get("region")!;
            const paramRegion = helpers.getParameterByName("region");
            if (paramRegion !== undefined && paramRegion.length > 0) {
                region = paramRegion;
            }
            let zones = this.pingTest.getZones(region);
            const paramZone = helpers.getParameterByName("zone");
            if (paramZone !== undefined && paramZone.length > 0) {
                zones = [paramZone];
            }

            const matchArgs: FindGameBody = {
                version,
                region,
                zones,
                playerCount: 1,
                autoFill: true,
                gameModeIdx,
            };

            const tryQuickStartGameImpl = () => {
                this.waitOnAccount(() => {
                    this.findGame(matchArgs, (err, matchData, ban) => {
                        if (err) {
                            this.onJoinGameError(err);
                            return;
                        }
                        if (ban) {
                            this.showIpBanModal(ban);
                            return;
                        }
                        this.joinGame(matchData!);
                    });
                });
            };

            if (delay == 0) {
                // We can improve findGame responsiveness by ~30 ms by skipping
                // the 0ms setTimeout
                tryQuickStartGameImpl();
            } else {
                setTimeout(() => {
                    tryQuickStartGameImpl();
                }, delay);
            }
        }
    }

    findGame(
        matchArgs: FindGameBody,
        cb: (
            err?: FindGameError | null,
            matchData?: FindGameMatchData,
            ban?: FindGameResponse & { banned: true },
        ) => void,
    ) {
        const findGameImpl = (iter: number, maxAttempts: number, token: string) => {
            if (iter >= maxAttempts) {
                cb("full");
                return;
            }
            const retry = () => {
                setTimeout(() => {
                    helpers.verifyTurnstile(
                        this.siteInfo.info.captchaEnabled && !this.account.loggedIn,
                        (token) => {
                            findGameImpl(iter + 1, maxAttempts, token);
                        },
                    );
                }, 500);
            };
            matchArgs.turnstileToken = token;

            $.ajax({
                type: "POST",
                url: api.resolveUrl("/api/find_game"),
                data: JSON.stringify(matchArgs),
                contentType: "application/json; charset=utf-8",
                timeout: 10 * 1000,
                xhrFields: {
                    withCredentials: proxy.anyLoginSupported(),
                },
                success: (data: FindGameResponse) => {
                    if (data.error === "invalid_captcha") {
                        // captch may have failed because the enabled state has changed since site info was loaded
                        // so force it to true
                        this.siteInfo.info.captchaEnabled = true;
                        retry();
                        return;
                    }

                    if (data.error && data.error != "full") {
                        cb(data.error);
                        return;
                    }

                    if (data.banned) {
                        cb(null, undefined, data as FindGameResponse & { banned: true });
                        return;
                    }

                    const matchData = data.res ? data.res[0] : null;
                    if (matchData?.hosts && matchData.addrs) {
                        cb(null, matchData);
                    } else {
                        retry();
                    }
                },
                error: function (_e) {
                    retry();
                },
            });
        };
        helpers.verifyTurnstile(
            this.siteInfo.info.captchaEnabled && !this.account.loggedIn,
            (token) => {
                findGameImpl(0, 2, token);
            },
        );
    }

    joinGame(matchData: FindGameMatchData) {
        if (!this.game) {
            setTimeout(() => {
                this.joinGame(matchData);
            }, 250);
            return;
        }

        // Team/private-lobby joins can arrive while a previous Game instance is
        // still flagged as initialized/connected. In that case tryJoinGame()
        // would silently no-op and leave the menu spinner stuck forever.
        if (this.game.initialized || this.game.connected || this.game.connecting) {
            this.game.free();
        }

        const hosts = matchData.hosts || [];
        const urls: string[] = [];
        for (let i = 0; i < hosts.length; i++) {
            urls.push(
                `ws${matchData.useHttps ? "s" : ""}://${hosts[i]}/play?gameId=${
                    matchData.gameId
                }`,
            );
        }
        const joinGameImpl = (urls: string[], matchData: FindGameMatchData) => {
            const url = urls.shift();
            if (!url) {
                this.onJoinGameError("join_game_failed");
                return;
            }
            const onFailure = function () {
                joinGameImpl(urls, matchData);
            };
            this.game!.tryJoinGame(
                url,
                matchData.data,
                this.account.questPriv,
                onFailure,
                !this.canUseCombatLoadoutCategories(),
            );
        };
        joinGameImpl(urls, matchData);
    }

    onJoinGameError(err: FindGameError) {
        const errMap: Partial<Record<FindGameError, string>> = {
            full: this.localization.translate("index-failed-finding-game"),
            invalid_protocol: this.localization.translate("index-invalid-protocol"),
            invalid_captcha: this.localization.translate("index-invalid-captcha"),
            join_game_failed: this.localization.translate("index-failed-joining-game"),
            rate_limited: this.localization.translate("index-rate-limited"),
        };
        if (err == "invalid_protocol") {
            this.showInvalidProtocolModal();
        }

        // Forcefully set captcha to enabled if we fail the captcha
        // This can happen if it was disabled when the page loaded which would meant it was sending an empty token
        // And we only fetch the state when the page loads...
        if (err === "invalid_captcha") {
            this.siteInfo.info.captchaEnabled = true;
        }
        this.showErrorModal(err);

        this.errorMessage = errMap[err] || errMap.full!;
        this.quickPlayPendingModeIdx = -1;
        this.teamMenu.leave("join_game_failed");
        this.refreshUi();
    }

    showInvalidProtocolModal() {
        this.refreshModal.show(true);
    }

    showIpBanModal(ban: FindGameResponse & { banned: true }) {
        $("#modal-ip-banned-reason").text(`Reason: ${ban.reason}`);

        let expiration = "Duration: indefinite";
        if (!ban.permanent) {
            const expiresIn = new Date(ban.expiresIn);
            const timeLeft = expiresIn.getTime() - Date.now();

            const daysLeft = Math.round(timeLeft / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.round(timeLeft / (1000 * 60 * 60));

            if (daysLeft > 1) {
                expiration = `Expires in: ${daysLeft} days`;
            } else if (hoursLeft > 1) {
                expiration = `Expires in: ${hoursLeft} hours`;
            } else {
                expiration = `Expires in: less than an hour`;
            }
        }

        $("#modal-ip-banned-expiration").text(expiration);

        this.ipBanModal.show(true);

        this.quickPlayPendingModeIdx = -1;
        this.teamMenu.leave("banned");
        this.refreshUi();
    }

    showErrorModal(err: string) {
        const typeText: Record<string, string> = {
            // TODO: translate those?
            behind_proxy: this.localization.translate("index-behind-proxy"),
            ip_banned: this.localization.translate("index-ip-banned"),
        };

        const text = typeText[err];

        if (text) {
            this.errorModal.selector.find(".modal-body-text").html(text);
            this.errorModal.show();
        }
    }

    update() {
        const dt = math.clamp(this.pixi!.ticker.elapsedMS / 1000, 0.001, 1 / 8);
        this.pingTest.update(dt);
        if (!this.checkedPingTest && this.pingTest.isComplete()) {
            if (!this.config.get("regionSelected")) {
                const region = this.pingTest.getRegion();

                if (region) {
                    this.config.set("region", region);
                    this.setDOMFromConfig();
                }
            }
            this.checkedPingTest = true;
        }
        this.resourceManager!.update(dt);
        this.audioManager.update(dt);
        this.ambience.update(dt, this.audioManager, !this.active);

        // Game update
        if (this.game?.initialized && this.game.m_playing) {
            if (this.active) {
                this.setAppActive(false);
                this.setPlayLockout(true);
            }
            this.game.update(dt);
        }

        // LoadoutDisplay update
        if (this.active && this.loadoutDisplay && this.game && !this.game.initialized) {
            if (this.loadoutMenu.active) {
                if (!this.loadoutDisplay.initialized) {
                    this.loadoutDisplay.init();
                }
                this.loadoutDisplay.show();
                this.loadoutDisplay.update(dt, this.hasFocus);
            } else {
                this.loadoutDisplay.hide();
            }
        }
        if (!this.active && this.loadoutMenu.active) {
            this.loadoutMenu.hide();
        }
        if (this.active) {
            this.pass?.update(dt);
        }
        this.input!.flush();
    }
}

const App = new Application();

function onPageLoad() {
    App.domContentLoaded = true;
    App.tryLoad();
}

document.addEventListener("DOMContentLoaded", onPageLoad);
window.addEventListener("load", onPageLoad);
window.addEventListener("unload", (_e) => {
    App.onUnload();
});
if (window.location.hash == "#_=_") {
    window.location.hash = "";
    history.pushState("", document.title, window.location.pathname);
}
window.addEventListener("resize", () => {
    App.onResize();
});
window.addEventListener("orientationchange", () => {
    App.onResize();
});
window.addEventListener("hashchange", () => {
    App.tryJoinTeam(false);
});
window.addEventListener("beforeunload", (e) => {
    if (App.game?.warnPageReload()) {
        // In new browsers, dialogText is overridden by a generic string
        const dialogText = "Do you want to reload the game?";
        e.returnValue = dialogText;
        return dialogText;
    }
});
window.addEventListener("focus", () => {
    App.hasFocus = true;
});
window.addEventListener("blur", () => {
    App.hasFocus = false;
});

const reportedErrors: string[] = [];
window.onerror = function (msg, url, lineNo, columnNo, error) {
    msg = msg || "undefined_error_msg";
    const stacktrace = error ? error.stack : "";

    // don't report useless errors lol
    if (!url && !lineNo && !columnNo) return;

    const errObj = {
        msg,
        id: App.sessionId,
        url,
        line: lineNo,
        column: columnNo,
        stacktrace,
        browser: navigator.userAgent,
        protocol: GameConfig.protocolVersion,
        clientGitVersion: GIT_VERSION,
        serverGitVersion: App.siteInfo.info.gitRevision,
    };
    const errStr = JSON.stringify(errObj);

    // Don't report the same error multiple times
    if (!reportedErrors.includes(errStr)) {
        reportedErrors.push(errStr);
        errorLogManager.logWindowOnError(errObj);
    }
};

navigator.serviceWorker?.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
        registration.unregister();
    }
});
