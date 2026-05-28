import type { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { MapDefs } from "../../../shared/defs/mapDefs";
import { TeamMode } from "../../../shared/gameConfig";
import type { SiteInfoRes } from "../../../shared/types/api";
import { Config } from "../config";
import { TeamMenu } from "../teamMenu";
import { GIT_VERSION } from "../utils/gitRevision";
import { defaultLogger, ServerLogger } from "../utils/logger";
import type { FindGamePrivateBody, FindGamePrivateRes } from "../utils/types";

export type SocialEventType =
    | "friends_changed"
    | "clan_messages_changed"
    | "clan_mentions_changed"
    | "clan_join_requests_changed";

export interface SocialEvent {
    type: SocialEventType;
    clanId?: string;
}

class Region {
    data: (typeof Config)["regions"][string];
    playerCount = 0;

    lastUpdateTime = Date.now();

    constructor(readonly id: string) {
        this.data = Config.regions[this.id];
    }

    async fetch<Data extends object>(endPoint: string, body: object) {
        const url = `http${this.data.https ? "s" : ""}://${this.data.address}/${endPoint}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "survev-api-key": Config.secrets.SURVEV_API_KEY,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                return (await res.json()) as Data;
            }
        } catch (err) {
            defaultLogger.error(`Error fetching region ${this.id}`, err);
            return undefined;
        }
    }

    async findGame(body: FindGamePrivateBody): Promise<FindGamePrivateRes> {
        for (let attempt = 0; attempt < 3; attempt++) {
            const data = await this.fetch<FindGamePrivateRes>("api/find_game", body);
            if (data) {
                return data;
            }

            if (attempt < 2) {
                defaultLogger.warn(
                    `Retrying region ${this.id} find_game request (attempt ${attempt + 2}/3)`,
                );
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }

        return { error: "find_game_failed" };
    }

    async setBattleRoyaleMode(enabled: boolean) {
        return await this.fetch<{ success: boolean }>("api/set_battle_royale_mode", {
            enabled,
        });
    }
}

interface RegionData {
    playerCount: number;
}

export class ApiServer {
    readonly logger = new ServerLogger("Server");

    teamMenu = new TeamMenu(this);

    regions: Record<string, Region> = {};

    modes = expandConfiguredModes(Config.modes, Config.battleRoyaleMode);
    privateLobbyMaps = new Set<(typeof Config.modes)[number]["mapName"]>();
    clientTheme = Config.clientTheme;

    captchaEnabled = Config.captchaEnabled;
    battleRoyaleMode = Config.battleRoyaleMode;

    private readonly socialEventClients = new Map<
        string,
        Set<(event: SocialEvent) => void>
    >();

    constructor() {
        const forcedPrivateMaps: Array<(typeof Config.modes)[number]["mapName"]> = [
            "main",
            "snow",
            "cobalt",
            "perks",
            "desert",
            "valentine",
            "inferno",
            "woods",
        ];

        for (const mapName of forcedPrivateMaps) {
            this.privateLobbyMaps.add(mapName);
        }
        if (Config.battleRoyaleMode) {
            for (const mapName of Object.keys(MapDefs)) {
                if (mapName.startsWith("br_")) {
                    this.privateLobbyMaps.add(
                        mapName as (typeof Config.modes)[number]["mapName"],
                    );
                }
            }
        }

        this.ensurePrivateLobbyModes();

        for (const region in Config.regions) {
            this.regions[region] = new Region(region);
        }
    }

    private ensurePrivateLobbyModes() {
        const privateDeathmatchTeamModes = [
            TeamMode.Solo,
            TeamMode.Duo,
            TeamMode.Squad,
            TeamMode.Ten,
            TeamMode.Fifteen,
        ] as const;
        const privateBattleRoyaleTeamModes = [
            TeamMode.Solo,
            TeamMode.Duo,
            TeamMode.Squad,
        ] as const;
        const hasMode = (
            mapName: (typeof Config.modes)[number]["mapName"],
            teamMode: (typeof Config.modes)[number]["teamMode"],
        ) => this.modes.some((m) => m.mapName === mapName && m.teamMode === teamMode);

        for (const mapName of this.privateLobbyMaps) {
            const privateTeamModes = mapName.startsWith("br_")
                ? privateBattleRoyaleTeamModes
                : privateDeathmatchTeamModes;
            for (const teamMode of privateTeamModes) {
                if (hasMode(mapName, teamMode)) continue;
                this.modes.push({
                    mapName,
                    teamMode,
                    enabled: false,
                });
            }
        }
    }

    setMode(index: number, mode: (typeof Config.modes)[number]) {
        this.modes[index] = mode;
        this.modes = expandConfiguredModes(this.modes, this.battleRoyaleMode);
        this.ensurePrivateLobbyModes();
        Config.modes = this.modes;
    }

    init(app: Hono<any>, upgradeWebSocket: UpgradeWebSocket) {
        this.teamMenu.init(app, upgradeWebSocket);
    }

    subscribeSocialEvents(userId: string, send: (event: SocialEvent) => void) {
        let clients = this.socialEventClients.get(userId);
        if (!clients) {
            clients = new Set();
            this.socialEventClients.set(userId, clients);
        }
        clients.add(send);

        return () => {
            clients.delete(send);
            if (clients.size === 0) {
                this.socialEventClients.delete(userId);
            }
        };
    }

    notifyUserSocialEvent(userId: string, event: SocialEvent) {
        const clients = this.socialEventClients.get(userId);
        if (!clients) return;

        for (const send of [...clients]) {
            send(event);
        }
    }

    notifyUsersSocialEvent(userIds: Iterable<string>, event: SocialEvent) {
        for (const userId of new Set(userIds)) {
            this.notifyUserSocialEvent(userId, event);
        }
    }

    getSiteInfo(): SiteInfoRes {
        const data: SiteInfoRes = {
            modes: this.modes,
            pops: {},
            youtube: this.getFeaturedYoutuber(),
            twitch: [],
            country: "US",
            gitRevision: GIT_VERSION,
            captchaEnabled: this.captchaEnabled,
            clientTheme: this.clientTheme,
        };

        for (const region in this.regions) {
            data.pops[region] = {
                playerCount: this.regions[region].playerCount,
                l10n: Config.regions[region].l10n,
            };
        }
        return data;
    }

    private getFeaturedYoutuber() {
        const youtubers = Config.featuredYoutubers.filter(
            (youtuber) => youtuber.name.trim() && youtuber.link.trim(),
        );
        if (youtubers.length === 0) {
            return null;
        }

        const youtuber = youtubers[Math.floor(Math.random() * youtubers.length)];
        return {
            ...youtuber,
            img: youtuber.img || this.getYouTubeAvatarUrl(youtuber.link),
        };
    }

    private getYouTubeAvatarUrl(link: string) {
        try {
            const url = new URL(link);
            const handle = url.pathname.match(/\/@([^/?#]+)/)?.[1];
            if (handle) {
                return `https://unavatar.io/youtube/${encodeURIComponent(handle)}`;
            }
        } catch {}

        return "/img/yt_icon_rgb.png";
    }

    updateRegion(regionId: string, regionData: RegionData) {
        const region = this.regions[regionId];
        if (!region) {
            this.logger.warn("updateRegion: Invalid region", regionId);
            return;
        }
        region.playerCount = regionData.playerCount;
        region.lastUpdateTime = Date.now();
    }

    async setBattleRoyaleMode(enabled: boolean) {
        this.battleRoyaleMode = enabled;
        Config.battleRoyaleMode = enabled;
        this.modes = expandConfiguredModes(this.modes, enabled);
        this.ensurePrivateLobbyModes();
        Config.modes = this.modes;

        const results = await Promise.allSettled(
            Object.values(this.regions).map((region) =>
                region.setBattleRoyaleMode(enabled),
            ),
        );

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const region = Object.values(this.regions)[i];
            if (result.status === "rejected" || !result.value?.success) {
                this.logger.warn(
                    `Failed to sync Battle Royale mode to region ${region.id}`,
                    result.status === "rejected" ? result.reason : result.value,
                );
            }
        }
    }

    async findGame(body: FindGamePrivateBody): Promise<FindGamePrivateRes> {
        if (body.region in this.regions) {
            return await this.regions[body.region].findGame(body);
        }
        return { error: "find_game_failed" };
    }
}

function expandConfiguredModes(modes: typeof Config.modes, battleRoyaleMode: boolean) {
    const expandedModes: typeof Config.modes = [];
    const addedModes = new Map<string, number>();

    const addMode = (mode: (typeof Config.modes)[number]) => {
        const key = `${mode.mapName}:${mode.teamMode}`;
        const existingIndex = addedModes.get(key);
        if (existingIndex !== undefined) {
            if (mode.enabled && !expandedModes[existingIndex].enabled) {
                expandedModes[existingIndex] = mode;
            }
            return;
        }
        addedModes.set(key, expandedModes.length);
        expandedModes.push(mode);
    };

    for (const mode of modes) {
        if (!battleRoyaleMode && mode.mapName.startsWith("br_")) continue;

        addMode(mode);

        if (mode.mapName.startsWith("br_") || !battleRoyaleMode) continue;

        const battleRoyaleMapName = `br_${mode.mapName}` as keyof typeof MapDefs;
        addMode({
            ...mode,
            mapName: MapDefs[battleRoyaleMapName] ? battleRoyaleMapName : "br_main",
        });
    }

    return expandedModes;
}

export const server = new ApiServer();
