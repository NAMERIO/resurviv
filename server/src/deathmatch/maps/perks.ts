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
        name: "Perks",
        icon: "img/loot/loot-perk-armor_master.svg",
        buttonCss: "btn-mode-perks",
        backgroundImg: "img/main_splash_perks_01.png",
    },
    assets: {
        audio: [
            { name: "pumpkin_break_01", channel: "sfx" },
            { name: "spawn_01", channel: "ui" },
            { name: "ambient_lab_01", channel: "ambient" },
            { name: "log_13", channel: "sfx" },
            { name: "log_14", channel: "sfx" },
        ],
        atlases: ["gradient", "loadout", "shared", "perks", "woods"],
    },
    biome: {
        colors: {
            background: 3818586,
            water: 4016234,
            waterRipple: 4213882,
            beach: 4213882,
            riverbank: 4016234,
            grass: 3818586,
            underground: 0x1a1520,
            playerSubmerge: 4016234,
            playerGhillie: 3818586,
        },
        particles: { camera: "falling_leaf_spring" },
        valueAdjust: 1,
        sound: {
            riverShore: "falling_river",
        },
        tracerColors: {},
        airdrop: {
            planeImg: "airdrop_plane",
            planeSound: "airdrop_plane",
            airdropImg: "map-chute-01-perk.img",
            tint: 0xffffff,
        },
    },
    gameMode: { maxPlayers: 80, allowLoadoutPerks: true },
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
                crates: [
                    { name: "airdrop_crate_01p", weight: 1 },
                    { name: "airdrop_crate_02p", weight: 1 },
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
        importantSpawns: ["logging_complex_01p", "desert_town_02p"],
        randomSpawns: [
            {
                spawns: ["logging_complex_01p", "desert_town_02p"],
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
        fixedSpawns: [
            {
                police_01p: 1,
                reactor_01: 1,
                bush_01p: 20,
                bush_07p: 7,
                silo_09: 5,
                house_red_02: 1,
                house_red_01: 1,
                teahouse_complex_01p: 1,
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
                shack_03b: 3,
                shack_01: 2,
                mansion_structure_01: 1,
                bank_01: 1,
                greenhouse_02: 1,
            },
        ],
        spawnReplacements: [
            {
                tree_07: "tree_01p",
                tree_01: "tree_01p",
                crate_01: "crate_01p",
                silo_01: "silo_09",
                bush_01: "bush_01p",
                bush_04: "bush_07p",
                tree_06: "tree_01p",
                crate_18: "crate_02p",
                carte_02: "crate_02p",
            },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};
export const DeatchmatchPerks = util.mergeDeep({}, Main, mapDef) as MapDef;

DeatchmatchPerks["lootTable"] = {
    tier_scopes: [
        { name: "", count: 1, weight: 1 },
        { name: "8x", count: 1, weight: 0.5 },
    ],
    tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
    tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
    tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
    tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
    tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
    tier_chrys_case: [
        // { name: "tier_katanas", count: 1, weight: 3 },
        { name: "naginata", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 0.5 },
        { name: "pkp", count: 1, weight: 0.7 },
        { name: "pan", count: 1, weight: 1 },
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
        { name: "sv98", count: 1, weight: 0.9 },
        { name: "outfitGhillie", count: 1, weight: 0.1 },
        { name: "ap_rounds", count: 1, weight: 0.9 },
    ],
    tier_airdrop_rare: [
        { name: "sv98", count: 1, weight: 0.9 },
        { name: "outfitGhillie", count: 1, weight: 0.1 },
        { name: "ap_rounds", count: 1, weight: 1 },
    ],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "mirv", count: 2, weight: 0.05 },
    ],
    tier_hatchet: [
        { name: "pan", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
    tier_guns: [
        { name: "vector", count: 1, weight: 0.5 },
        { name: "mirv", count: 1, weight: 1 },
        { name: "vector45", count: 1, weight: 0.9 },
        { name: "mk12", count: 1, weight: 0.01 },
        { name: "pkp", count: 1, weight: 0.01 },
        { name: "garand", count: 1, weight: 0.5 },
        { name: "lasr_gun_dual", count: 1, weight: 0.2 },
        { name: "ap_rounds", count: 1, weight: 0.09 },
        { name: "scarssr", count: 1, weight: 0.1 },
        { name: "lasr_gun", count: 1, weight: 1 },
        { name: "m9", count: 1, weight: 1 },
        { name: "flux_rifle", count: 1, weight: 0.4 },
        { name: "sv98", count: 1, weight: 0.009 },
        { name: "small_arms", count: 1, weight: 0.04 },
        { name: "splinter", count: 1, weight: 0.01 },
        { name: "small_arms", count: 1, weight: 0.04 },
        { name: "splinter", count: 1, weight: 0.01 },
        { name: "lasr_swrd", count: 1, weight: 0.1 },
        { name: "lasr_swrd_02", count: 1, weight: 0.09 },
        { name: "lasr_swrd_03", count: 1, weight: 0.07 },
    ],
    tier_toilet: [
        { name: "tier_guns", count: 1, weight: 0.1 },
        { name: "tier_scopes", count: 1, weight: 0.05 },
        { name: "tier_medical", count: 1, weight: 0.6 },
        { name: "tier_throwables", count: 1, weight: 0.05 },
    ],
    tier_soviet: [
        { name: "tier_guns", count: 1, weight: 3 }, // ?
        { name: "tier_medical", count: 1, weight: 1 },
    ],
    tier_medical: [
        { name: "bandage", count: 5, weight: 16 },
        { name: "healthkit", count: 1, weight: 4 },
        { name: "soda", count: 1, weight: 15 },
        { name: "painkiller", count: 1, weight: 5 },
    ],
};
