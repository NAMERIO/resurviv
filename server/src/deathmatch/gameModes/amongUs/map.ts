import type { MapDef } from "../../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../../shared/gameConfig";
import { util } from "../../../../../shared/utils/util";
import { v2 } from "../../../../../shared/utils/v2";
import { DeatchmatchMain } from "../../maps/main";

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
        maxPlayers: 15,
        killLeaderEnabled: false,
        amongUsMode: true,
        amongUsVisionRadius: 24,
        amongUsSpawnOffsets: [
            v2.create(-3.453, 3.434),
            v2.create(-0.5, 4.528),
            v2.create(1.644, 6.956),
            v2.create(1.491, 10.15),
            v2.create(-0.238, 12.731),
            v2.create(-3.125, 13.059),
            v2.create(-6.363, 4.375),
            v2.create(-7.916, 7.219),
            v2.create(-8.003, 10.281),
            v2.create(-6.122, 12.644),
            v2.create(4.55, 4.48),
            v2.create(6.6, 6.95),
            v2.create(6.52, 10.18),
            v2.create(4.44, 12.7),
            v2.create(-3.2, 7.95),
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

/* STRIP_FROM_PROD_CLIENT:START */
Object.assign(DeathmatchAmongUs.lootTable, structuredClone(DeatchmatchMain.lootTable));
/* STRIP_FROM_PROD_CLIENT:END */

DeathmatchAmongUs.gameConfig.bagSizes = GameConfig.bagSizes;
