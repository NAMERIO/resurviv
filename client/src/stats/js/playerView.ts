import $ from "jquery";
import { GameObjectDefs } from "../../../../shared/defs/gameObjectDefs";
import { EmotesDefs } from "../../../../shared/defs/gameObjects/emoteDefs";
import type { AmmoDef } from "../../../../shared/defs/gameObjects/gearDefs";
import type { GunDef } from "../../../../shared/defs/gameObjects/gunDefs";
import { TeamModeToString } from "../../../../shared/defs/types/misc";
import type { TeamMode } from "../../../../shared/gameConfig";
import {
    ALL_GAME_MODE_STATUS,
    ALL_MAPS,
    ALL_TEAM_MODES,
    type GameModeStatus,
    type LeaderboardRequest,
    type MatchData,
    type MatchDataRequest,
    type MatchDataResponse,
    type MatchHistory,
    type MatchHistoryParams,
    type MatchHistoryResponse,
    type UserStatsRequest,
    type UserStatsResponse,
    type WeaponHistoryParams,
    type WeaponHistoryResponse,
} from "../../../../shared/types/stats";
import { api } from "../../api";
import { device } from "../../device";
import { helpers } from "../../helpers";
import type { App } from "./app";
import loading from "./templates/loading.ejs";
import matchData from "./templates/matchData.ejs";
import matchHistory from "./templates/matchHistory.ejs";
import player from "./templates/player.ejs";
import playerCards from "./templates/playerCards.ejs";
import weaponHistory from "./templates/weaponHistory.ejs";

const templates = {
    loading,
    matchData,
    matchHistory,
    player,
    playerCards,
    weaponHistory,
};

const STATS_TEAM_MODES: TeamMode[] = [1, 2, 4] as TeamMode[];

export interface TeamModes {
    teamMode: TeamMode;
    gameMode: GameModeStatus;
    games: number;
    name: string;
    gameName: string;
    shortName: string;
    teamName: string;
    botStats: { name: string; val: string }[];
    midStats: { name: string; val: string }[];
}

function getPlayerCardData(
    userData: UserStatsResponse,
    error: boolean,
    teamModeFilter: number,
    gameModeFilter: UserStatsRequest["gameModeFilter"],
    extraView: "matches" | "weapons",
) {
    // get_user_stats currently returns data rows for all teamModes;
    // transform the data a bit for the player card.
    if (error || !userData) {
        return {
            profile: {},
            teamModes: [],
            error: error,
        };
    }

    const emoteDef = EmotesDefs[userData.player_icon];
    const texture = emoteDef
        ? helpers.emoteImgToSvg(emoteDef.texture)
        : "/img/gui/player-gui.svg";

    let tmpSlug = userData.slug.toLowerCase();
    tmpSlug = tmpSlug.replace(userData.username.toLowerCase(), "");

    const tmpslugToShow =
        tmpSlug != "" ? `${userData.username}#${tmpSlug}` : userData.username;

    const profile = {
        username: userData.username,
        slugToShow: tmpslugToShow,
        banned: userData.banned,
        avatarTexture: texture,
        wins: userData.wins,
        kills: userData.kills,
        games: userData.games,
        kpg: userData.kpg,
    };

    // Gather card data
    const addStat = function addStat(
        arr: { name: string; val: number | string }[],
        name: string,
        val: number | string,
    ) {
        arr.push({
            name: name,
            val: val,
        });
    };
    const teamModes: Partial<TeamModes>[] = [];
    for (let i = 0; i < userData.modes.length; i++) {
        const mode = userData.modes[i];

        // Overall rank / rating not available yet
        const mid: { name: string; val: string }[] = [];
        addStat(mid, "Rating", "-");
        addStat(mid, "Rank", "-");

        const bot: { name: string; val: string }[] = [];
        addStat(bot, "Wins", mode.wins);
        addStat(bot, "Win %", mode.winPct);
        addStat(bot, "Kills", mode.kills);
        addStat(bot, "Avg Survived", helpers.formatTime(mode.avgTimeAlive));
        addStat(bot, "Most kills", mode.mostKills);
        addStat(bot, "K/G", mode.kpg);
        addStat(bot, "Most damage", mode.mostDamage);
        addStat(bot, "Avg Damage", mode.avgDamage);

        teamModes.push({
            teamMode: mode.teamMode,
            gameMode: mode.gameMode,
            games: mode.games,
            midStats: mid,
            botStats: bot,
        });
    }

    // Insert blank cards for all teammodes
    const gameModes =
        gameModeFilter === ALL_GAME_MODE_STATUS
            ? (["deathmatch", "battleroyale"] as GameModeStatus[])
            : ([gameModeFilter] as GameModeStatus[]);

    for (const gameMode of gameModes) {
        for (let i = 0; i < STATS_TEAM_MODES.length; i++) {
            const teamMode = STATS_TEAM_MODES[i];
            if (
                !teamModes.find((x) => x.teamMode == teamMode && x.gameMode == gameMode)
            ) {
                teamModes.push({
                    teamMode,
                    gameMode,
                    games: 0,
                });
            }
        }
    }
    teamModes.sort((a, b) => {
        if (a.gameMode !== b.gameMode) {
            return a.gameMode === "deathmatch" ? -1 : 1;
        }
        return a.teamMode! - b.teamMode!;
    });
    for (let i = 0; i < teamModes.length; i++) {
        const teamMode = teamModes[i].teamMode!;
        const teamName = TeamModeToString[teamMode];
        const gameName =
            teamModes[i].gameMode === "battleroyale" ? "Battle Royale" : "Deathmatch";
        const gameShortName = teamModes[i].gameMode === "battleroyale" ? "BR" : "DM";
        teamModes[i].teamName = teamName;
        teamModes[i].gameName = gameName;
        teamModes[i].shortName = `${gameShortName} ${teamName}`;
        teamModes[i].name = `${gameName} ${teamName}`;
    }

    return {
        profile: profile,
        error: error,
        teamModes: teamModes,
        teamModeFilter: teamModeFilter,
        gameModes: helpers.getGameModes(),
        extraView,
    };
}

//
// Query
//

class Query<T> {
    inProgress = false;
    dataValid = false;
    error = false;
    args = {};
    data: T | null = null;

    query(
        url: string,
        args: Record<string, unknown>,
        debugTimeout: number,
        onComplete: (err: any, res: any) => void,
    ) {
        if (this.inProgress) {
            return;
        }

        this.inProgress = true;
        this.error = false;

        $.ajax({
            url: api.resolveUrl(url),
            type: "POST",
            data: JSON.stringify(args),
            contentType: "application/json; charset=utf-8",
            timeout: 10 * 1000,
            success: (data, _status, _xhr) => {
                this.data = data;
                this.dataValid = !!data;
            },
            error: () => {
                this.error = true;
                this.dataValid = false;
            },
            complete: () => {
                setTimeout(() => {
                    this.inProgress = false;
                    onComplete(this.error, this.data);
                }, debugTimeout);
            },
        });
    }
}

//
// PlayerView
//
export class PlayerView {
    games: {
        expanded: boolean;
        dataError: boolean;
        data: MatchData[] | null;
        summary: MatchHistory;
    }[] = [];
    moreGamesAvailable = true;
    teamModeFilter = ALL_TEAM_MODES;
    userStats = new Query<UserStatsResponse>();
    userStatsCache = {} as Record<string, { error: boolean; data: UserStatsResponse }>;
    matchHistory = new Query<MatchHistoryResponse>();
    matchHistoryCache = {} as Record<number, typeof this.games>;
    matchData = new Query<MatchDataResponse>();
    weaponHistory = new Query<WeaponHistoryResponse>();
    extraView: "matches" | "weapons" = "matches";
    el = $(
        templates.player({
            phoneDetected: device.mobile && !device.tablet,
        }),
    );
    constructor(readonly app: App) {}
    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("slug") || "";
        const interval = params.get("time") || "alltime";
        const mapId = params.get("mapId") || ALL_MAPS;
        const gameMode = params.get("gameMode") || ALL_GAME_MODE_STATUS;
        const gameId = params.get("gameId") || "";

        return {
            slug,
            interval,
            mapId,
            gameMode,
            gameId,
        };
    }
    getGameByGameId(gameId: string) {
        return this.games.find((x) => x.summary.guid == gameId);
    }
    load() {
        const getUrlParams = this.getUrlParams();
        const slug = getUrlParams.slug;
        const interval = getUrlParams.interval as UserStatsRequest["interval"];
        const mapId = getUrlParams.mapId;
        const gameMode = getUrlParams.gameMode as UserStatsRequest["gameModeFilter"];

        this.loadUserStats(slug, interval, mapId, gameMode);
        this.loadMatchHistory(slug, 0, 7);

        this.render();
    }
    loadUserStats(
        slug: string,
        interval: UserStatsRequest["interval"],
        mapIdFilter: string,
        gameModeFilter: UserStatsRequest["gameModeFilter"],
    ) {
        const args: UserStatsRequest = {
            slug: slug,
            interval: interval,
            mapIdFilter: mapIdFilter,
            gameModeFilter: gameModeFilter,
        };

        const cacheKey = `${interval}${mapIdFilter}${gameModeFilter}`;
        if (this.userStatsCache[cacheKey]) {
            const { error, data } = this.userStatsCache[cacheKey];
            this.userStats.data = data;
            this.userStats.error = error;
            this.render();
            return;
        }
        this.userStats.query("/api/user_stats", args, 0, (error, data) => {
            this.userStatsCache[cacheKey] = {
                error,
                data,
            };
            this.render();
        });
    }
    loadMatchHistory(slug: string, offset: number, teamModeFilter: number) {
        const count = 10;
        const args: MatchHistoryParams = {
            slug: slug,
            offset: offset,
            count: count,
            teamModeFilter: teamModeFilter,
        };
        if (offset === 0 && this.matchHistoryCache[teamModeFilter]) {
            this.games = this.matchHistoryCache[teamModeFilter];

            this.moreGamesAvailable = this.games.length >= count;
            this.render();
            return;
        }
        this.matchHistory.query(
            "/api/match_history",
            args,
            0,
            (_err, data: (MatchHistoryResponse[number] & { icon: string })[]) => {
                const gameModes = helpers.getGameModes();

                const games = data || [];

                for (let i = 0; i < games.length; i++) {
                    // @ts-expect-error string or number, IT STILL WORKS
                    games[i].team_mode =
                        TeamModeToString[games[i].team_mode as unknown as TeamMode];

                    const gameMode = gameModes.find((x) => x.mapId == games[i].map_id);
                    games[i].icon = gameMode ? gameMode.desc.icon : "";

                    this.games.push({
                        expanded: false,
                        summary: games[i],
                        data: null,
                        dataError: false,
                    });
                }
                if (offset === 0 && !this.matchHistoryCache[teamModeFilter]) {
                    this.matchHistoryCache[teamModeFilter] = this.games;
                }
                this.moreGamesAvailable = games.length >= count;

                const gameId = this.getUrlParams().gameId;
                if (gameId) {
                    for (const game of this.games) {
                        if (!game.expanded && game.summary.guid === gameId) {
                            game.expanded = true;
                            this.loadMatchData(gameId);
                            break;
                        }
                    }
                }

                this.render();
            },
        );
    }
    loadMatchData(gameId: string) {
        const args: MatchDataRequest = {
            gameId: gameId,
        };
        this.matchData.query(
            "/api/match_data",
            args,
            0,
            (err, data: MatchDataResponse) => {
                const game = this.getGameByGameId(gameId);
                if (game) {
                    game.data = data;
                    game.dataError = err || !data;
                }
                this.render();
            },
        );
    }
    loadWeaponHistory(slug: string) {
        const args: WeaponHistoryParams = { slug };
        this.weaponHistory.query("/api/weapon_history", args, 0, (_err, data) => {
            this.weaponHistory.data = (data || []).map(
                (weapon: WeaponHistoryResponse[number]) => {
                    const weaponDef = GameObjectDefs[weapon.type] as GunDef | undefined;
                    const ammoDef = weaponDef?.ammo
                        ? (GameObjectDefs[weaponDef.ammo] as AmmoDef | undefined)
                        : undefined;

                    return {
                        ...weapon,
                        icon: helpers.getSvgFromGameType(weapon.type),
                        category: GameObjectDefs[weapon.type]?.type,
                        accentColor:
                            ammoDef?.lootImg.tintDark !== undefined
                                ? helpers.colorToHexString(ammoDef.lootImg.tintDark)
                                : "",
                        name: weaponDef?.name ?? weapon.type,
                    };
                },
            );
            this.render();
        });
    }
    toggleMatchData(gameId: string) {
        const game = this.getGameByGameId(gameId);
        if (!game) {
            return;
        }

        const wasExpanded = game.expanded;
        for (let i = 0; i < this.games.length; i++) {
            this.games[i].expanded = false;
        }
        game.expanded = !wasExpanded;

        if (!game.data && !game.dataError) {
            this.loadMatchData(gameId);
        }

        this.render();
        this.updateSearchParams();
    }

    updateSearchParams() {
        const slug = this.getUrlParams().slug;
        const time = $("#player-time").val();
        const mapId = $("#player-map-id").val();
        const gameMode = $("#player-game-mode").val();

        let searchP = new URLSearchParams();
        searchP.set("slug", slug);
        searchP.set("time", time as string);
        searchP.set("mapId", mapId as string);
        searchP.set("gameMode", gameMode as string);

        const selectedGame = this.games.find((g) => g.expanded);
        if (selectedGame) {
            searchP.set("gameId", selectedGame.summary.guid);
        }

        window.history.pushState("", "", `?${searchP.toString()}`);
    }

    onChangedParams() {
        this.updateSearchParams();

        const params = this.getUrlParams();
        this.loadUserStats(
            params.slug,
            params.interval as LeaderboardRequest["interval"],
            params.mapId,
            params.gameMode as UserStatsRequest["gameModeFilter"],
        );
    }
    render() {
        const params = this.getUrlParams();

        // User stats
        let content = "";
        if (this.userStats.inProgress) {
            content = templates.loading({
                type: "player",
            });
        } else {
            const cardData = getPlayerCardData(
                this.userStats.data!,
                this.userStats.error,
                this.teamModeFilter,
                params.gameMode as UserStatsRequest["gameModeFilter"],
                this.extraView,
            );
            content = templates.playerCards(cardData);
        }
        this.el.find(".content").html(content);

        const timeSelector = this.el.find("#player-time");
        if (timeSelector) {
            timeSelector.val(params.interval);
            timeSelector.on("change", () => {
                this.onChangedParams();
            });
        }

        const mapIdSelector = this.el.find("#player-map-id");
        if (mapIdSelector) {
            mapIdSelector.val(params.mapId);
            mapIdSelector.on("change", () => {
                this.onChangedParams();
            });
        }

        const gameModeSelector = this.el.find("#player-game-mode");
        if (gameModeSelector) {
            gameModeSelector.val(params.gameMode);
            gameModeSelector.on("change", () => {
                this.onChangedParams();
            });
        }

        // Match history
        let historyContent = "";
        if (this.extraView === "weapons" && this.weaponHistory.inProgress) {
            historyContent = templates.loading({
                type: "match_history",
            });
        } else if (this.extraView === "weapons") {
            historyContent = templates.weaponHistory({
                weapons: this.weaponHistory.data || [],
                error: this.weaponHistory.error,
            });
        } else if (this.games.length == 0 && this.matchHistory.inProgress) {
            historyContent = templates.loading({
                type: "match_history",
            });
        } else {
            historyContent = templates.matchHistory({
                games: this.games,
                moreGamesAvailable: this.moreGamesAvailable,
                loading: this.matchHistory.inProgress,
                error: this.matchHistory.error,
                formatTime: helpers.formatTime,
            });
        }

        const historySelector = this.el.find("#match-history");
        if (historySelector) {
            historySelector.html(historyContent);

            $("#selector-extra-matches").on("click", () => {
                this.extraView = "matches";
                this.render();
            });

            $("#selector-extra-weapons").on("click", () => {
                this.extraView = "weapons";
                if (!this.weaponHistory.dataValid && !this.weaponHistory.inProgress) {
                    this.loadWeaponHistory(params.slug);
                }
                this.render();
            });

            $(".js-match-data").on("click", (e) => {
                if (!$(e.target).is("a")) {
                    this.toggleMatchData($(e.currentTarget).data("game-id"));
                }
            });

            $(".js-match-load-more").on("click", (_e) => {
                const params = this.getUrlParams();
                this.loadMatchHistory(
                    params.slug,
                    this.games.length,
                    this.teamModeFilter,
                );
                this.render();
            });

            $(".extra-team-mode-filter").on("click", (e) => {
                if (!this.matchHistory.inProgress) {
                    const _params = this.getUrlParams();
                    this.games = [];
                    this.teamModeFilter = $(e.currentTarget).data("filter");
                    this.loadMatchHistory(_params.slug, 0, this.teamModeFilter);
                    this.render();
                }
            });

            const params = this.getUrlParams();

            // Match data
            let matchDataContent = "";
            const expandedGame = this.games.find((x) => x.expanded);
            if (expandedGame) {
                let localId = 0;
                // Get this player's player_id in this match
                if (expandedGame.data) {
                    for (let i = 0; i < expandedGame.data.length; i++) {
                        const d = expandedGame.data[i];
                        if (params.slug == d.slug) {
                            localId = d.player_id || 0;
                            break;
                        }
                    }
                }

                matchDataContent = templates.matchData({
                    data: expandedGame.data,
                    error: expandedGame.dataError,
                    loading: this.matchData.inProgress,
                    localId: localId,
                    formatTime: helpers.formatTime,
                });
            }

            $("#match-data").html(matchDataContent);

            if (expandedGame && expandedGame.summary.guid === params.gameId) {
                const elm = document.querySelector(
                    `div[data-game-id="${params.gameId}"]`,
                );
                if (elm) {
                    elm.scrollIntoView();
                }
            }
        }

        this.app.localization.localizeIndex();
    }
}
