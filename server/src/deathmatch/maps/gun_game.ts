import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main } from "../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { DeatchmatchMain } from "./main";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: { large: 280, small: 240 },
    spawnDensity: { large: 44, small: 37 },
} as const;

export const gun_game: MapDef = util.mergeDeep(structuredClone(Main), {
    biome: {
        particles: { camera: "falling_leaf_spring" },
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
            baseWidth: config.mapWidth[config.mapSize],
            baseHeight: config.mapWidth[config.mapSize],
            shoreInset: 40,
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
            : {},
        densitySpawns: Main.mapGen
            ? Main.mapGen.densitySpawns.reduce(
                  (array, item) => {
                      let object: Record<string, number> = {};
                      for (const [key, value] of Object.entries(item)) {
                          object[key] =
                              (value * config.spawnDensity[config.mapSize]) / 100;
                      }
                      array.push(object);
                      return array;
                  },
                  [] as Record<string, number>[],
              )
            : {},
        fixedSpawns: [
            {
                club_complex_01: 1,
                // small is spawn count for solos and duos, large is spawn count for squads
                warehouse_01: { odds: 0.5 },
                house_red_01: config.mapSize === "large" ? 1 : { odds: 0.5 },
                // house_red_02: 1,
                // barn_01: { small: 1, large: 3 },
                // barn_02: 1,
                hut_01: 2,
                hut_02: 1, // spas hut
                hut_03: 1, // scout hut
                greenhouse_01: 1,
                cache_01: 1,
                cache_02: { odds: 0.8 }, // mosin tree
                cache_07: 1,
                // bunker_structure_01: { odds: 0.05 },
                bunker_structure_02: config.mapSize === "large" ? 1 : 0,
                // bunker_structure_03: 1,
                // bunker_structure_04: 1,
                // bunker_structure_05: 1,
                // warehouse_complex_01: 1,
                chest_01: 1,
                chest_03: { odds: 0.2 },
                mil_crate_02: { odds: 0.4 },
                mil_crate_03: config.mapSize === "large" ? { odds: 0.4 } : 0,
                stone_04: 1,
                tree_02: 3,
                teahouse_complex_01su: { odds: 0.5 },
                // stone_04: 1,
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
    },
});

gun_game["lootTable"] = {
    tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
    tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
    tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
    tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
    tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
    tier_chrys_case: [
        // { name: "tier_katanas", count: 1, weight: 3 },
        { name: "naginata", count: 1, weight: 1 },
    ],
    tier_police: [{ name: "flare_gun", count: 1, weight: 0.1 }],
    tier_eye_02: [{ name: "stonehammer", count: 1, weight: 1 }],
    tier_eye_block: [{ name: "awc", count: 1, weight: 1 }],
    tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
    tier_woodaxe: [{ name: "woodaxe", count: 1, weight: 1 }],
    tier_club_melee: [{ name: "machete_taiga", count: 1, weight: 1 }],
    tier_pirate_melee: [{ name: "hook", count: 1, weight: 1 }],
    tier_hatchet_melee: [
        { name: "fireaxe", count: 1, weight: 5 },
        { name: "tier_katanas", count: 1, weight: 3 },
        { name: "stonehammer", count: 1, weight: 1 },
    ],
    tier_airdrop_uncommon: [
        { name: "outfitGhillie", count: 1, weight: 0.9 },
        { name: "stonehammer", count: 1, weight: 1 },
    ],
    tier_airdrop_rare: [
        { name: "outfitGhillie", count: 1, weight: 0.9 },
        { name: "stonehammer", count: 1, weight: 1 },
    ],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "poison_gas", count: 1, weight: 0.35 },
        { name: "mirv", count: 2, weight: 0.05 },
    ],
    tier_hatchet: [
        { name: "pan", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
};

/* STRIP_FROM_PROD_CLIENT:START */
Object.assign(gun_game.lootTable, structuredClone(DeatchmatchMain.lootTable));
/* STRIP_FROM_PROD_CLIENT:END */
