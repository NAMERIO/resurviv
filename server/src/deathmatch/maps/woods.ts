import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Woods } from "../../../../shared/defs/maps/woodsDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { loadAirstrike } from "../helpers";
import { DeatchmatchMain } from "./main";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: { large: 270, small: 250 },
    spawnDensity: { large: 44, small: 37 },
} as const;
// export const DeatchmatchWoods = Woods;
export const DeatchmatchWoods: MapDef = util.mergeDeep(structuredClone(Woods), {
    gameConfig: {
        planes: {
            timings: [
                {
                    circleIdx: 0,
                    wait: 10,
                    options: { type: GameConfig.Plane.Airdrop },
                },
                ...Array.from({ length: 7 }, (_, idx) => loadAirstrike(idx * 50)),
            ],
        },
    },
    mapGen: {
        map: {
            baseWidth: config.mapWidth[config.mapSize],
            baseHeight: config.mapWidth[config.mapSize],
            shoreInset: 10,
            rivers: {
                lakes: [],
                weights: [],
            },
        },
        places: Woods.mapGen
            ? Array(config.places)
                  .fill(false)
                  .map(() => {
                      return Woods.mapGen?.places[
                          Math.floor(Math.random() * Woods.mapGen.places.length)
                      ];
                  })
            : {},
        densitySpawns: Woods.mapGen
            ? Woods.mapGen.densitySpawns.reduce(
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
                logging_complex_01: 1,
                logging_complex_02: 1,
                // logging_complex_03: 3,
                teapavilion_01w: 1,
                warehouse_01: 1,
                house_red_01: 1,
                barn_01: 1,
                cache_03: 48,
                cache_01: 1,
                cache_02: 1,
                bunker_structure_01b: 1,
                bunker_structure_03: 1,
                bunker_structure_07: 1,
                chest_03: { odds: 0.5 },
                crate_19: 12,
                stone_04: 6,
                tree_02: 6,
                tree_07: 1100 / 2,
                tree_08: 1100 / 2,
                tree_08b: 150 / 1.2,
                tree_09: 84 / 1.2,
            },
        ],
    },
});

DeatchmatchWoods["lootTable"] = {
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
        { name: "stonehammer", count: 1, weight: 1 },
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
    tier_airdrop_uncommon: [{ name: "helmet03_forest", count: 1, weight: 1 }],
    tier_airdrop_rare: [{ name: "helmet03_forest", count: 1, weight: 1 }],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "poison_gas", count: 1, weight: 0.35 },
        { name: "mirv", count: 2, weight: 0.05 },
    ],
    tier_hatchet: [{ name: "usas", count: 1, weight: 2 }],
};

/* STRIP_FROM_PROD_CLIENT:START */
Object.assign(DeatchmatchWoods.lootTable, structuredClone(DeatchmatchMain.lootTable));
/* STRIP_FROM_PROD_CLIENT:END */
