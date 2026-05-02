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
}

interface RegionData {
    playerCount: number;
}

export class ApiServer {
    readonly logger = new ServerLogger("Server");

    teamMenu = new TeamMenu(this);

    regions: Record<string, Region> = {};

    modes = expandConfiguredModes(Config.modes);
    privateLobbyMaps = new Set<(typeof Config.modes)[number]["mapName"]>();
    clientTheme = Config.clientTheme;

    captchaEnabled = Config.captchaEnabled;

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

        const privateTeamModes = [TeamMode.Solo, TeamMode.Duo, TeamMode.Squad] as const;
        const hasMode = (
            mapName: (typeof Config.modes)[number]["mapName"],
            teamMode: (typeof Config.modes)[number]["teamMode"],
        ) => this.modes.some((m) => m.mapName === mapName && m.teamMode === teamMode);

        for (const mapName of this.privateLobbyMaps) {
            for (const teamMode of privateTeamModes) {
                if (hasMode(mapName, teamMode)) continue;
                this.modes.push({
                    mapName,
                    teamMode,
                    enabled: false,
                });
            }
        }

        for (const region in Config.regions) {
            this.regions[region] = new Region(region);
        }
    }

    init(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
        this.teamMenu.init(app, upgradeWebSocket);
    }

    getSiteInfo(): SiteInfoRes {
        const data: SiteInfoRes = {
            modes: this.modes,
            pops: {},
            youtube: { name: "", link: "" },
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

    updateRegion(regionId: string, regionData: RegionData) {
        const region = this.regions[regionId];
        if (!region) {
            this.logger.warn("updateRegion: Invalid region", regionId);
            return;
        }
        region.playerCount = regionData.playerCount;
        region.lastUpdateTime = Date.now();
    }

    async findGame(body: FindGamePrivateBody): Promise<FindGamePrivateRes> {
        if (body.region in this.regions) {
            return await this.regions[body.region].findGame(body);
        }
        return { error: "find_game_failed" };
    }
}

function expandConfiguredModes(modes: typeof Config.modes) {
    const expandedModes: typeof Config.modes = [];
    const addedModes = new Set<string>();

    const addMode = (mode: (typeof Config.modes)[number]) => {
        const key = `${mode.mapName}:${mode.teamMode}`;
        if (addedModes.has(key)) return;
        addedModes.add(key);
        expandedModes.push(mode);
    };

    for (const mode of modes) {
        addMode(mode);

        if (mode.mapName.startsWith("br_")) continue;

        const battleRoyaleMapName = `br_${mode.mapName}` as keyof typeof MapDefs;
        addMode({
            ...mode,
            mapName: MapDefs[battleRoyaleMapName] ? battleRoyaleMapName : "br_main",
        });
    }

    return expandedModes;
}

export const server = new ApiServer();
