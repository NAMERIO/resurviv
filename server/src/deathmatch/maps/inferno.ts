import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { MapId } from "../../../../shared/defs/types/misc";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { v2 } from "../../../../shared/utils/v2";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: 270,
    spawnDensity: 60,
} as const;

const mapDef: PartialMapDef = {
    mapId: MapId.Inferno,
    desc: {
        name: "Inferno",
        icon: "img/gui/inferno.svg",
        buttonCss: "btn-mode-inferno",
    },
    assets: {
        audio: [
            { name: "vault_change_02", channel: "sfx" },
            { name: "footstep_08", channel: "sfx" },
            { name: "footstep_09", channel: "sfx" },
        ],
        atlases: ["gradient", "loadout", "shared", "desert", "main", "inferno", "woods"],
    },
    biome: {
        colors: {
            background: 0x20536e,
            water: 0xfe8438,
            waterRipple: 0xfe8438,
            beach: 0x534d45,
            riverbank: 0x252525,
            grass: 0x3c3c3c,
            underground: 0x1b0d03,
            playerSubmerge: 0xffffff,
            playerGhillie: 0x83af50,
        },
    },
    gameMode: { maxPlayers: 40, infernoMode: true },
    gameConfig: {
        planes: {
            timings: [
                {
                    circleIdx: 1,
                    wait: 10,
                    options: { type: GameConfig.Plane.Airdrop },
                },
                {
                    circleIdx: 3,
                    wait: 2,
                    options: { type: GameConfig.Plane.Airdrop },
                },
            ],
            crates: [
                { name: "airdrop_crate_01", weight: 10 },
                { name: "airdrop_crate_02", weight: 1 },
            ],
        },
        bagSizes: {
            frag: [6, 12, 15, 18],
            smoke: [6, 12, 15, 18],
        },
    },

    mapGen: {
        map: {
            baseWidth: config.mapWidth,
            baseHeight: config.mapWidth,
            shoreInset: 40,
            grassInset: 10,
            rivers: {
                lakes: [
                    {
                        odds: 1,
                        innerRad: 20,
                        outerRad: 40,
                        circular: true,
                        spawnBound: {
                            pos: v2.create(0.5, 0.75),
                            rad: 30,
                        },
                    },
                ],
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
            ? (Main.mapGen.densitySpawns.reduce(
                  (array, item) => {
                      let object: Record<string, number> = {};
                      for (const [key, value] of Object.entries(item)) {
                          object[key] = (value * config.spawnDensity) / 150;
                      }
                      array.push(object);
                      return array;
                  },
                  [] as Record<string, number>[],
              ) as [Record<string, number>?])
            : [],

        fixedSpawns: [
            {
                teapavilion_01w: 1,
                silo_01: 2,
                cache_06: 1,
                house_red_01: 1,
                club_complex_01: 1,
                barrel_01: 10,
                crate_01: 18,
                crate_30: 4,
                hedgehog_01: 4,
                container_03: 1,
                container_04: 1,
                shack_01: 1,
                outhouse_01: 1,
                loot_tier_1: 5,
                loot_tier_beach: 3,
                tree_01: 0,
            },
        ],
        randomSpawns: [
            {
                spawns: ["logging_complex_01i", "desert_town_02i"],
                choose: 2,
            },
            {
                spawns: ["bunker_structure_03", "bunker_structure_01"],
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
        spawnReplacements: [
            {
                tree_01: "tree_20",
                bush_01: "bush_14b",            
                bush_07: "bush_14b",
                tree_07: "tree_20",
                tree_03sv: "tree_20",
            },
        ],
    },
};
export const DeathmatchInferno = util.mergeDeep({}, Main, mapDef) as MapDef;

DeathmatchInferno["lootTable"] = {
    ...DeathmatchInferno["lootTable"],
    tier_forest_helmet: [{ name: "helmet03", count: 1, weight: 1 }],
    tier_perks_inferno: [
        { name: "pyro", count: 1, weight: 1 },
        { name: "phoenix", count: 1, weight: 1 },
    ],
};
