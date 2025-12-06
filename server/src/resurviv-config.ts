import type { ConfigType, DeepPartial } from "../../configType";
import type { MapDefs } from "../../shared/defs/mapDefs";
import { GameConfig } from "../../shared/gameConfig";
import { THIS_REGION } from "./region";

const BACKPACK_LEVEL = 3;

const mapName: Record<typeof THIS_REGION, keyof typeof MapDefs> = {
    local: "main",
    na: "main",
    eu: "main",
};

const serverDataConfig = {
    local: {},
    na: {},
    eu: {},
};

export const CustomConfig: DeepPartial<ConfigType> = {
    ...serverDataConfig[THIS_REGION],
    clientTheme: "main",
    modes: [
        {
            mapName: "main",
            teamMode: 1,
            enabled: false,
        },
        {
            mapName: mapName[THIS_REGION],
            teamMode: 2,
            enabled: true,
        },
        {
            mapName: "main",
            teamMode: 4,
            enabled: false,
        },
    ],
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
            snow: 3,
            bandage: GameConfig.bagSizes["bandage"][BACKPACK_LEVEL],
            healthkit: GameConfig.bagSizes["healthkit"][BACKPACK_LEVEL],
            soda: GameConfig.bagSizes["soda"][BACKPACK_LEVEL],
            painkiller: GameConfig.bagSizes["painkiller"][BACKPACK_LEVEL],
            "1xscope": 1,
            "2xscope": 1,
            "4xscope": 1,
        },
    },
};
