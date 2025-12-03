import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main } from "../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: 225,
    spawnDensity: 60,
} as const;

const mapDef = {
    desc: {
        name: "Snow",
        icon: "img/loot/loot-throwable-snowball.svg",
        buttonCss: "btn-mode-snow",
    },
    assets: {
        audio: [
            { name: "snowball_01", channel: "sfx" },
            { name: "snowball_02", channel: "sfx" },
            { name: "plane_02", channel: "sfx" },
            { name: "bells_01", channel: "ui" },
            { name: "snowball_pickup_01", channel: "ui" },
        ],
        atlases: ["gradient", "loadout", "shared", "snow", "woods"],
    },
    biome: {
        colors: {
            background: 603705,
            water: 806225,
            waterRipple: 11792639,
            beach: 13480795,
            riverbank: 9461284,
            grass: 12434877,
            underground: 1772803,
            playerSubmerge: 2854052,
        },
        particles: { camera: "falling_snow_fast" },
        airdrop: {
            planeImg: "map-plane-01x.img",
            planeSound: "plane_02",
            airdropImg: "map-chute-01x.img",
        },
        frozenSprites: ["player-snow-01.img", "player-snow-02.img", "player-snow-03.img"],
    },
    gameMode: { maxPlayers: 80, woodsMode: true },
    gameConfig: {
        /* STRIP_FROM_PROD_CLIENT:START */
        gameConfig: {
            planes: {
                timings: [
                    {
                        circleIdx: 0,
                        wait: 2,
                        options: { type: GameConfig.Plane.Airdrop },
                    },
                ],
            },
        },
        /* STRIP_FROM_PROD_CLIENT:END */
        bagSizes: {
            frag: [6, 12, 15, 18],
            smoke: [6, 12, 15, 18],
            snowball: [6, 12, 18],
        },
    },
    /* STRIP_FROM_PROD_CLIENT:START */
    lootTable: {
        tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
        tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
        tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
        tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
        tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
        tier_chrys_case: [
            // { name: "tier_katanas", count: 1, weight: 3 },
            { name: "naginata", count: 1, weight: 1 },
        ],
        tier_police: [
            { name: "saiga", count: 1, weight: 1 },
            // { name: "flare_gun", count: 1, weight: 0.1 }
        ],
        tier_eye_02: [{ name: "stonehammer", count: 1, weight: 1 }],
        tier_eye_block: [
            { name: "m9", count: 1, weight: 1 },
            { name: "ots38_dual", count: 1, weight: 1 },
            { name: "flare_gun", count: 1, weight: 1 },
            { name: "colt45", count: 1, weight: 1 },
            { name: "45acp", count: 1, weight: 1 },
            { name: "painkiller", count: 1, weight: 1 },
            { name: "m4a1", count: 1, weight: 1 },
            { name: "m249", count: 1, weight: 1 },
            { name: "awc", count: 1, weight: 1 },
            { name: "pkp", count: 1, weight: 1 },
        ],
        tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
        tier_chest_04: [
            { name: "p30l", count: 1, weight: 40 },
            { name: "p30l_dual", count: 1, weight: 1 },
        ],
        tier_woodaxe: [{ name: "woodaxe", count: 1, weight: 1 }],
        tier_club_melee: [{ name: "machete_taiga", count: 1, weight: 1 }],
        tier_pirate_melee: [{ name: "hook", count: 1, weight: 1 }],
        tier_hatchet_melee: [
            { name: "fireaxe", count: 1, weight: 5 },
            { name: "tier_katanas", count: 1, weight: 3 },
            { name: "stonehammer", count: 1, weight: 1 },
        ],
        tier_airdrop_uncommon: [
            { name: "sv98", count: 1, weight: 1 },
            { name: "outfitGhillie", count: 1, weight: 1 },
        ],
        tier_airdrop_rare: [
            { name: "sv98", count: 1, weight: 1 },
            { name: "outfitGhillie", count: 1, weight: 1 },
        ],
        tier_throwables: [
            { name: "frag", count: 2, weight: 1 },
            { name: "smoke", count: 1, weight: 1 },
            { name: "mirv", count: 2, weight: 0.05 },
        ],
        tier_hatchet: [
            { name: "pan", count: 1, weight: 1 },
            { name: "pkp", count: 1, weight: 1 },
            { name: "usas", count: 1, weight: 1 },
        ],
    },
    mapGen: {
        map: {
            baseWidth: config.mapWidth,
            baseHeight: config.mapWidth,
            shoreInset: 20,
            grassInset: 10,
            rivers: {
                lakes: [],
                weights: [],
                // weights: [{ weight: 1, widths: [2.7, 2] }],
                // smoothness: 0.8,
                // spawnCabins: false,
                masks: [],
            },
        },
        places: Main.mapGen
            ? Array(config.places)
                  .fill(false)
                  .map(() => {
                      return Main.mapGen?.places[
                          Math.floor(Math.random() * Main.mapGen.places.length)
                      ];
                  })
            : {},
        densitySpawns: Main.mapGen
                    ? Main.mapGen.densitySpawns.reduce(
                        (array, item) => {
                            let object: Record<string, number> = {};
                            for (const [key, value] of Object.entries(item)) {
                                object[key] = (value * config.spawnDensity) / 100;
                            }
                            array.push(object);
                            return array;
                        },
                        [] as Record<string, number>[],
                    )
                    : [],
        fixedSpawns: [
            {
                cache_01: 1,
                cache_02: 1, // mosin tree
                cache_07: 1,
                bunker_structure_02: 1,
                bunker_structure_05: 1,
                chest_01: 1,
                chest_03: { odds: 0.2 },
                stone_04: 2,
                stone_05: 2,
                stone_03: 5,
                tree_02: 3,
                teahouse_complex_01su: 1,
                shack_03b: 3,
                shack_01: 2,
                mansion_structure_01: 1,
                police_01: 1,
                bank_01: 1,
                greenhouse_01: 1,
                house_red_02: 1,
                hut_01: 2,
                hut_02: 1, // spas hut
                hut_03: 1, // scout hut
            },
        ],
        importantSpawns: ["logging_complex_01sn", "club_complex_01"],
        customSpawnRules: {
            locationSpawns: [],
        },
        randomSpawns: [
            {
                spawns: ["logging_complex_01sn", "club_complex_01"],
                choose: 1,
            },
            {
                spawns: [
                    // vector bunker
                    "bunker_structure_03",
                    // ak bunker
                    "bunker_structure_01",
                ],
                choose: 1,
            },
            {
                spawns: ["warehouse_01", "house_red_01"],
                choose: 1,
            },
            {
                spawns: ["mil_crate_02", "mil_crate_03"],
                choose: 1,
            },
            {
                spawns: ["barn_02", "barn_01"],
                choose: 1,
            },
        ],
        spawnReplacements: [
            {
                barn_01: "barn_01x",
                bridge_lg_01: "bridge_lg_01x",
                cabin_01: "cabin_01x",
                container_01: "container_01x",
                greenhouse_01: "greenhouse_02",
                house_red_01: "house_red_01x",
                house_red_02: "house_red_02x",
                hut_01: "hut_01x",
                hut_02: "hut_02x",
                outhouse_01: "outhouse_01x",
                shack_01: "shack_01x",
                shack_02: "shack_02x",
                shack_03a: "shack_03x",
                warehouse_01: "warehouse_01x",
                warehouse_02: "warehouse_02x",
                bush_01: "bush_01x",
                bush_07: "bush_07x",
                chest_03: "chest_03x",
                crate_01: "crate_01x",
                crate_02: "crate_02x",
                stone_01: "stone_01x",
                stone_03: "stone_03x",
                table_01: "table_01x",
                table_02: "table_02x",
                table_03: "table_03x",
                tree_01: "tree_10",
                mil_crate_02: "mil_crate_03",
                tree_07: "tree_10",
            },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};
export const DeatchmatchSnow = util.mergeDeep({}, Main, mapDef) as MapDef;

DeatchmatchSnow["lootTable"] = {
    tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
    tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
    tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
    tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
    tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
    tier_chrys_case: [
        // { name: "tier_katanas", count: 1, weight: 3 },
        { name: "naginata", count: 1, weight: 1 },
    ],
    tier_police: [
        { name: "saiga", count: 1, weight: 1 },
        // { name: "flare_gun", count: 1, weight: 0.1 }
    ],
    tier_eye_02: [{ name: "stonehammer", count: 1, weight: 1 }],
    tier_eye_block: [
        { name: "m9", count: 1, weight: 1 },
        { name: "ots38_dual", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "colt45", count: 1, weight: 1 },
        { name: "45acp", count: 1, weight: 1 },
        { name: "painkiller", count: 1, weight: 1 },
        { name: "m4a1", count: 1, weight: 1 },
        { name: "m249", count: 1, weight: 1 },
        { name: "awc", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
    tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
    tier_chest_04: [
        { name: "p30l", count: 1, weight: 40 },
        { name: "p30l_dual", count: 1, weight: 1 },
    ],
    tier_woodaxe: [{ name: "woodaxe", count: 1, weight: 1 }],
    tier_club_melee: [{ name: "machete_taiga", count: 1, weight: 1 }],
    tier_pirate_melee: [{ name: "hook", count: 1, weight: 1 }],
    tier_hatchet_melee: [
        { name: "fireaxe", count: 1, weight: 5 },
        { name: "tier_katanas", count: 1, weight: 3 },
        { name: "stonehammer", count: 1, weight: 1 },
    ],
    tier_airdrop_uncommon: [{ name: "outfitGhillie", count: 1, weight: 1 }],
    tier_airdrop_rare: [{ name: "outfitGhillie", count: 1, weight: 1 }],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "mirv", count: 2, weight: 0.05 },
    ],
    tier_hatchet: [
        { name: "pan", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
};
