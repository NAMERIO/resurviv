import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { MapId } from "../../../../shared/defs/types/misc";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";

const valentineDef: PartialMapDef = {
    mapId: 19,
    desc: {
        name: "Valentine",
        icon: "img/gui/loot-medical-chocolateBox.svg",
        buttonCss: "btn-mode-valentine",
        backgroundImg: "img/valentine_splash.png",
    },
    assets: {
        audio: [],
        atlases: [
            "gradient",
            "loadout",
            "shared",
            "valentine",
            "main",
            "woods",
            "desert",
        ],
    },
    biome: {
        colors: {
            background: 2118510,
            water: 3310251,
            waterRipple: 9892086,
            beach: 13480795,
            riverbank: 9461284,
            grass: 8433481,
            underground: 1772803,
            playerSubmerge: 12633565,
            playerGhillie: 8433481,
        },
        particles: {},
    },
};

const Valentine = util.mergeDeep({}, Main, valentineDef);

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

        randomSpawns: [
            {
                spawns: ["logging_complex_01v", "desert_town_02v"],
                choose: 2,
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
                spawns: ["bank_01", "police_01"],
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
                candy_store_n_basement: 1,
                tree_07sp: 70,
                tree_08sp: 30,
                stone_01: 20,
                barrel_01: 10,
                silo_01: 2,
                crate_01: 8,
                crate_02: 2,
                crate_03: 4,
                bush_01: 28,
                cache_06: 1,
                hedgehog_01: 4,
                container_01: 1,
                container_02: 1,
                shack_01: 2,
                outhouse_01: 2,
                tree_01: 10,
                house_red_01: 1,
                club_complex_01: 1,
            },
        ],
        spawnReplacements: [
            {
                tree_01: "tree_13",
                bush_07: "bush_rose",
                bush_01: "bush_13",
                tree_07: "tree_13",
                tree_03sv: "tree_13",
                vending_01: "vending_01v",
            },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};

export const DeatchmatchValentine = util.mergeDeep({}, Valentine, mapDef) as MapDef;

DeatchmatchValentine["lootTable"] = {
    ...DeatchmatchValentine["lootTable"],
    tier_valentine_box: [{ name: "heart_cannon", count: 1, weight: 1 }],
};
