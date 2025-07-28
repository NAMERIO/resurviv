import { getConfig } from "../../config";
import { ConfigType, DeepPartial } from "../../configType";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { util } from "../../shared/utils/util";

const isProd = process.env["NODE_ENV"] === "production";
export const serverConfigPath = isProd ? "../../" : "";
// to remove "server/dist" from the path to load the config from...
export const Config = getConfig(isProd, serverConfigPath);

const BACKPACK_LEVEL = 3;

util.mergeDeep(Config, {
    modes: [
        { mapName: "main", teamMode: TeamMode.Solo, enabled: false },
        { mapName: "main", teamMode: TeamMode.Duo, enabled: true },
        { mapName: "main", teamMode: TeamMode.Squad, enabled: false },
    ],
    debug: {
        spawnMode: process.env.NODE_ENV !== "production" ? "fixed" : "default",
    },
    defaultItems: {
        backpack: "backpack03",
        helmet: "helmet03",
        chest: "chest03",
        scope: "4xscope",
        inventory: {
            frag: 3,
            smoke: 1,
            strobe: 1,
            mine: 0,
            mirv: 1,
            bandage: GameConfig.bagSizes["bandage"][BACKPACK_LEVEL],
            healthkit: GameConfig.bagSizes["healthkit"][BACKPACK_LEVEL],
            soda: GameConfig.bagSizes["soda"][BACKPACK_LEVEL],
            painkiller: GameConfig.bagSizes["painkiller"][BACKPACK_LEVEL],
            "1xscope": 1,
            "2xscope": 1,
            "4xscope": 1,
        },
    },
} satisfies DeepPartial<ConfigType>);
