import type { MapDefs } from "../../shared/defs/mapDefs";
import { type GameConfig, TeamMode } from "../../shared/gameConfig";
import { util } from "../../shared/utils/util";
import type { Vec2 } from "../../shared/utils/v2";
import { CustomConfig } from "./resurviv-config";

/**
 * Default server config
 */

export const Config = {
    devServer: {
        host: "127.0.0.1",
        port: 8001,
    },

    apiServer: {
        host: "0.0.0.0",
        port: 8000,
    },

    gameServer: {
        host: "0.0.0.0",
        port: 8001,
        apiServerUrl: "http://127.0.0.1:8000",
    },

    apiKey: "Kongregate Sucks",

    modes: [
        { mapName: "main", teamMode: TeamMode.Solo, enabled: true },
        { mapName: "main", teamMode: TeamMode.Duo, enabled: true },
        { mapName: "main", teamMode: TeamMode.Squad, enabled: true },
    ],

    regions: {},

    debug: {
        spawnMode: "default",
    },

    thisRegion: "local",

    gameTps: 100,
    netSyncTps: 33,

    processMode: process.env.NODE_ENV === "production" ? "multi" : "single",

    perfLogging: {
        enabled: true,
        time: 10,
    },

    gameConfig: {},
} satisfies ConfigType as ConfigType;

util.mergeDeep(Config, CustomConfig);

export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

interface ServerConfig {
    host: string;
    port: number;

    /**
     * HTTPS/SSL options. Not used if running locally or with nginx.
     */
    ssl?: {
        keyFile: string;
        certFile: string;
    };
}
export interface ConfigType {
    devServer: ServerConfig;

    apiServer: ServerConfig;
    gameServer: ServerConfig & {
        apiServerUrl: string;
    };
    /**
     * API key used for game server and API server to communicate
     */
    apiKey: string;

    regions: Record<
        string,
        {
            https: boolean;
            address: string;
            l10n: string;
        }
    >;

    thisRegion: string;

    modes: Array<{
        mapName: keyof typeof MapDefs;
        teamMode: TeamMode;
        enabled: boolean;
    }>;

    /**
     * Server tick rate
     */
    gameTps: number;
    netSyncTps: number;

    /**
     * If games should all run in the same process
     * Or spawn a new process for each game
     * Defaults to single in development and multi in production
     */
    processMode: "single" | "multi";

    /**
     * Server logging
     */
    perfLogging: {
        enabled: boolean;
        /**
         * Seconds between each game performance log
         */
        time: number;
    };

    debug: {
        spawnMode: "default" | "fixed";
        // spawn pos for fixed, defaults to map center if not set
        spawnPos?: Vec2;
    };

    /**
     * Game config overrides
     * @NOTE don't modify values used by client since this only applies to server
     */
    gameConfig: DeepPartial<typeof GameConfig>;
}
