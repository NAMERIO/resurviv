import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: { large: 280, small: 240 },
    spawnDensity: 77,
} as const;

export const mapDef: PartialMapDef = {
    biome: {
        colors: {
            background: 0x4a3a5c,
            water: 0x2a1a3c,
            waterRipple: 0x6a5a7c,
            beach: 0x3a3540,
            riverbank: 0x2a2530,
            grass: 0x4a4550,
            underground: 0x1a1520,
            playerSubmerge: 0x8a7a9c,
            playerGhillie: 0x4a4550,
        },
        particles: { camera: "falling_leaf_spring" },
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main"],
    },
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
    mapGen: {
        map: {
            baseWidth: 290,
            baseHeight: 290,
            shoreInset: 30,
            grassInset: 10,
            rivers: {
                weights: [],
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
            : [],
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
                club_complex_01: 1,
                // small is spawn count for solos and duos, large is spawn count for squads
                warehouse_01: { odds: 0.5 },
                house_red_01: { odds: 0.5 },
                house_red_02: 1,
                barn_02: 1,
                barn_01: { odds: 0.5 },
                greenhouse_01: 1,
                cache_01: 1,
                cache_02: { odds: 0.8 }, // mosin tree
                cache_07: 1,
                bunker_structure_01: 1,
                bunker_structure_02: 1,
                bunker_structure_03: 1,
                bunker_structure_04: 1,
                bunker_structure_05: 1,
                // warehouse_complex_01: 1,
                chest_01: 1,
                chest_03: { odds: 0.2 },
                mil_crate_02: { odds: 0.5 },
                mil_crate_03: { odds: 0.5 },
                stone_04: 2,
                stone_05: 2,
                tree_02: 3,
                teahouse_complex_01su: 1,
                shack_03b: 3,
                shack_01: 2,
            },
        ],
        randomSpawns: [
            {
                spawns: [
                    "mansion_structure_01",
                    // "warehouse_complex_01",
                    "police_01",
                    "bank_01",
                ],
                choose: config.mapSize === "large" ? 2 : 1,
            },
        ],
        spawnReplacements: [
            {
                tree_01: "tree_01tw",
            },
        ],
    },
};

export const DeatchmatchMain: MapDef = util.mergeDeep(Main, mapDef);

DeatchmatchMain["lootTable"] = {
    tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
    tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
    tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
    tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
    tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
    tier_chrys_case: [
        // { name: "tier_katanas", count: 1, weight: 3 },
        { name: "naginata", count: 1, weight: 1 },
        { name: "m134", count: 1, weight: 1 },
        { name: "rainbow_blaster", count: 1, weight: 1.3 },
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
        { name: "lasr_gun", count: 1, weight: 1 },
        { name: "lasr_gun_dual", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
    ],
    tier_airdrop_rare: [
        { name: "sv98", count: 1, weight: 1 },
        { name: "outfitGhillie", count: 1, weight: 1 },
        { name: "lasr_gun_dual", count: 1, weight: 1 },
        { name: "lasr_gun", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
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
};
