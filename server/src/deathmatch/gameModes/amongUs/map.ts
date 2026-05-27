import type { MapDef } from "../../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../../shared/gameConfig";
import { util } from "../../../../../shared/utils/util";
import { v2 } from "../../../../../shared/utils/v2";

const cafeteriaMapWidth = 184;
const cafeteriaMapHeight = 96;

export const AmongUsMapDef: PartialMapDef = {
    desc: {
        name: "Among Us",
        icon: "img/loot/loot-perk-windwalk.svg",
        buttonCss: "btn-mode-cobalt",
        buttonText: "AMONG US",
        backgroundImg: "img/main_splash.png",
    },
    gameMode: {
        maxPlayers: 24,
        killLeaderEnabled: false,
        amongUsMode: true,
        amongUsVisionRadius: 24,
        amongUsSpawnOffsets: [
            v2.create(-3.594, 1.25),
            v2.create(0.625, 2.813),
            v2.create(3.688, 6.281),
            v2.create(3.469, 10.844),
            v2.create(1, 14.531),
            v2.create(-3.125, 15),
            v2.create(-7.75, 2.594),
            v2.create(-9.969, 6.656),
            v2.create(-10.094, 11.031),
            v2.create(-7.406, 14.406),
        ],
        disableGas: true,
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main"],
    },
    gameConfig: {
        planes: {
            timings: [],
            crates: [],
        },
    },
    mapGen: {
        map: {
            baseWidth: cafeteriaMapWidth,
            baseHeight: cafeteriaMapHeight,
            scale: {
                small: 1,
                large: 1,
            },
            extension: 0,
            shoreInset: 0,
            grassInset: 0,
            rivers: {
                lakes: [],
                weights: [],
                smoothness: 0,
                masks: [],
                spawnCabins: false,
            },
        },
        places: [
            {
                name: "Cafeteria",
                pos: v2.create(0.5, 0.5),
                dontSpawnObjects: true,
            },
        ],
        customSpawnRules: {
            locationSpawns: [
                {
                    type: "cafetria_01",
                    pos: v2.create(0.5, 0.5),
                    rad: 0,
                    retryOnFailure: true,
                },
            ],
            placeSpawns: [],
        },
        densitySpawns: [
            {
                loot_tier_1: 8,
                crate_01: 4,
            },
        ],
        fixedSpawns: [{}],
        randomSpawns: [],
        spawnReplacements: [{}],
        importantSpawns: ["cafetria_01"],
    },
};

export const DeathmatchAmongUs: MapDef = util.mergeDeep({}, Main, AmongUsMapDef);

DeathmatchAmongUs.lootTable = {
    ...DeathmatchAmongUs.lootTable,
    tier_world: [
        { name: "tier_medical", count: 1, weight: 1 },
        { name: "tier_throwables", count: 1, weight: 1 },
        { name: "tier_guns", count: 1, weight: 0.5 },
    ],
    tier_surviv: [
        { name: "tier_medical", count: 1, weight: 1 },
        { name: "tier_throwables", count: 1, weight: 1 },
    ],
    tier_guns: [
        { name: "m9", count: 1, weight: 3 },
        { name: "mp5", count: 1, weight: 1 },
        { name: "mac10", count: 1, weight: 1 },
    ],
    tier_throwables: [
        { name: "smoke", count: 1, weight: 2 },
        { name: "frag", count: 1, weight: 1 },
    ],
    tier_medical: [
        { name: "bandage", count: 5, weight: 2 },
        { name: "soda", count: 1, weight: 1 },
    ],
};

DeathmatchAmongUs.gameConfig.bagSizes = GameConfig.bagSizes;
