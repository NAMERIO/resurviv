import { util } from "../../utils/util";
import { v2 } from "../../utils/v2";
import type { MapDef } from "../mapDefs";
import { Main, type PartialMapDef } from "./baseDefs";

const mapWidth = 225;

export const BedWarMapDef: PartialMapDef = {
    desc: {
        name: "Bed War",
        icon: "img/loot/loot-perk-leadership.svg",
        buttonCss: "btn-mode-faction",
        buttonText: "BED WAR",
        backgroundImg: "img/main_splash.png",
    },
    gameMode: {
        maxPlayers: 80,
        killLeaderEnabled: false,
        bedWar: {
            redSpawn: v2.create(316, 269),
            blueSpawn: v2.create(57, 108),
            spawnRadius: 4,
        },
        plantTheBomb: {
            redSpawn: v2.create(316, 269),
            blueSpawn: v2.create(57, 108),
            sites: [v2.create(169, 255), v2.create(209, 125)],
            spawnRadius: 4,
            siteZoneSize: v2.create(14, 14),
        },
        disableGas: true,
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main", "bed_war"],
    },
    gameConfig: {
        planes: {
            timings: [],
            crates: [],
        },
    },
    mapGen: {
        map: {
            baseWidth: mapWidth,
            baseHeight: mapWidth,
            shoreInset: 18,
            grassInset: 10,
            rivers: {
                lakes: [],
                weights: [],
                masks: [],
                smoothness: 0,
                spawnCabins: false,
            },
        },
        places: [],
        densitySpawns: [{}],
        fixedSpawns: [{}],
        randomSpawns: [],
        spawnReplacements: [
            {
                tree_02: "tree_01",
                tree_02h: "tree_01",
                tree_09: "tree_01",
                tree_10: "tree_01",
            },
        ],
        importantSpawns: [],
        customSpawnRules: {
            locationSpawns: [
                {
                    type: "mode_arena_01",
                    pos: v2.create(0.5, 0.5),
                    rad: 0,
                    retryOnFailure: false,
                },
            ],
            placeSpawns: [],
        },
    },
};

export const DeathmatchBedWar = util.mergeDeep({}, Main, BedWarMapDef) as MapDef;
