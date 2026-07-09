import { GameConfig } from "../../gameConfig";
import { util } from "../../utils/util";
import { v2 } from "../../utils/v2";
import type { MapDef } from "../mapDefs";
import { Main, type PartialMapDef } from "./baseDefs";

const mapWidth = 225;

export const CaptureTheFlagMapDef: PartialMapDef = {
    desc: {
        name: "Capture the Flag",
        icon: "img/loot/loot-perk-leadership.svg",
        buttonCss: "btn-mode-faction",
        buttonText: "CTF",
        backgroundImg: "img/main_splash.png",
    },
    gameMode: {
        maxPlayers: 30,
        killLeaderEnabled: false,
        captureTheFlag: {
            redSpawn: v2.create(mapWidth * 0.18, mapWidth * 0.5),
            blueSpawn: v2.create(mapWidth * 0.82, mapWidth * 0.5),
            redFlag: v2.create(mapWidth * 0.13, mapWidth * 0.5),
            blueFlag: v2.create(mapWidth * 0.87, mapWidth * 0.5),
            spawnRadius: 18,
            flagPickupRadius: 2.6,
            captureRadius: 4,
            captureZoneSize: v2.create(16, 24),
        },
        disableGas: true,
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main", "cobalt", "woods", "faction"],
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
        places: Main.mapGen?.places?.slice(0, 3) ?? [],
        densitySpawns: [
            {
                loot_tier_1: 30,
                loot_tier_2: 16,
                crate_01: 18,
                barrel_01: 12,
                bush_01: 18,
                tree_01: 18,
                stone_01: 8,
            },
        ],
        fixedSpawns: [
            {
                mil_crate_02: 6,
                mil_crate_03: 6,
            },
        ],
        randomSpawns: [],
        spawnReplacements: [{}],
        importantSpawns: [],
        customSpawnRules: {
            locationSpawns: [
                {
                    type: "ctf_town_01",
                    pos: v2.create(0.5, 0.5),
                    rad: 0,
                    retryOnFailure: false,
                },
            ],
            placeSpawns: [],
        },
    },
};

export const DeathmatchCaptureTheFlag = util.mergeDeep(
    {},
    Main,
    CaptureTheFlagMapDef,
) as MapDef;

DeathmatchCaptureTheFlag.gameConfig.bagSizes = GameConfig.bagSizes;
