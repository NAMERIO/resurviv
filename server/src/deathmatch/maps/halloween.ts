import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main } from "../../../../shared/defs/maps/baseDefs";
import { Halloween } from "../../../../shared/defs/maps/halloweenDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { DeatchmatchMain } from "./main";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: { large: 270, small: 230 },
    spawnDensity: { large: 37, small: 27 },
} as const;

const mapDef = {
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
    lootTable: {
        tier_throwables: [
            { name: "frag", count: 2, weight: 0.5 },
            { name: "smoke", count: 1, weight: 1 },
            { name: "mirv", count: 2, weight: 0.05 },
        ],
        tier_airdrop_outfits: [
            { name: "", count: 1, weight: 4 },
            { name: "outfitAirdrop", count: 1, weight: 1 },
        ],
        tier_toilet: [
            { name: "tier_guns", count: 1, weight: 0.1 },
            { name: "tier_scopes", count: 1, weight: 0.05 },
            { name: "tier_medical", count: 1, weight: 0.6 },
            {
                name: "tier_throwables",
                count: 1,
                weight: 0.05,
            },
            { name: "tier_outfits", count: 1, weight: 0 },
        ],
        tier_container: [
            { name: "tier_guns", count: 1, weight: 0.29 },
            { name: "tier_ammo", count: 1, weight: 0.04 },
            { name: "tier_scopes", count: 1, weight: 0.15 },
            { name: "tier_armor", count: 1, weight: 0.1 },
            {
                name: "tier_medical",
                count: 1,
                weight: 0.17,
            },
            {
                name: "tier_throwables",
                count: 1,
                weight: 0.05,
            },
            { name: "tier_packs", count: 1, weight: 0.09 },
            { name: "tier_outfits", count: 1, weight: 0 },
        ],
        tier_scopes: [
            { name: "2xscope", count: 1, weight: 24 },
            { name: "4xscope", count: 1, weight: 5 },
        ],
        tier_airdrop_scopes: [
            { name: "", count: 1, weight: 18 },
            { name: "4xscope", count: 1, weight: 0 },
        ],
        tier_airdrop_uncommon: [
            { name: "sv98", count: 1, weight: 1 },
            { name: "outfitGhillie", count: 1, weight: 1 },
        ],
        tier_airdrop_rare: [
            { name: "sv98", count: 1, weight: 1 },
            { name: "outfitGhillie", count: 1, weight: 1 },
        ],
        tier_outfits: [
            { name: "outfitBarrel", count: 1, weight: 1 },
            { name: "outfitWoodBarrel", count: 1, weight: 1 },
            { name: "outfitStone", count: 1, weight: 1 },
            { name: "outfitTree", count: 1, weight: 1 },
            { name: "outfitStump", count: 1, weight: 1 },
            { name: "outfitBush", count: 1, weight: 1 },
            { name: "outfitLeafPile", count: 1, weight: 1 },
            { name: "outfitCrate", count: 1, weight: 1 },
            { name: "outfitTable", count: 1, weight: 1 },
            { name: "outfitSoviet", count: 1, weight: 1 },
            { name: "outfitOven", count: 1, weight: 1 },
            { name: "outfitRefrigerator", count: 1, weight: 1 },
            { name: "outfitVending", count: 1, weight: 1 },
            { name: "outfitPumpkin", count: 1, weight: 1 },
            { name: "outfitWoodpile", count: 1, weight: 1 },
            { name: "outfitToilet", count: 1, weight: 1 },
            { name: "outfitBushRiver", count: 1, weight: 1 },
            { name: "outfitCrab", count: 1, weight: 1 },
            { name: "outfitStumpAxe", count: 1, weight: 1 },
        ],
        // seems to be unused? so adding this to suppress the warning
        tier_pumpkin_candy: [{ name: "halloween_mystery", weight: 1, count: 1 }],
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
                junkyard_01: 1,
                warehouse_01h: 1,
                house_red_01h: 3,
                cache_03: 10,
                cache_01: 1,
                cache_02: 1,
                mansion_structure_02: 1,
                mil_crate_02: { odds: 0.25 },
                tree_05: 30,
                tree_08: 20,
                tree_09: 10,
                barrel_02: 5,
                oven_01: 5,
                refrigerator_01: 5,
                table_01: 5,
                vending_01: 5,
                woodpile_01: 5,
                cache_pumpkin_02: 40,
            },
        ],
        randomSpawns: [],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};

export const DeatchmatchHalloween = util.mergeDeep({}, Halloween, mapDef) as MapDef;

/* STRIP_FROM_PROD_CLIENT:START */
Object.assign(DeatchmatchHalloween.lootTable, structuredClone(DeatchmatchMain.lootTable));
/* STRIP_FROM_PROD_CLIENT:END */
