import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { MapId } from "../../../../shared/defs/types/misc";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { v2 } from "../../../../shared/utils/v2";
import { DeatchmatchMain } from "./main";

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
        backgroundImg: "img/main_splash_infernos_01.png",
    },
    assets: {
        audio: [
            { name: "club_music_01", channel: "ambient" },
            { name: "club_music_02", channel: "ambient" },
            { name: "ambient_steam_01", channel: "ambient" },
            { name: "vault_change_02", channel: "sfx" },
            { name: "footstep_08", channel: "sfx" },
            { name: "footstep_09", channel: "sfx" },
        ],
        atlases: ["gradient", "loadout", "shared", "inferno"],
    },
    biome: {
        colors: {
            background: 0x661c07,
            water: 0xfe8438,
            waterRipple: 0xffc39e,
            beach: 0x534d45,
            riverbank: 0x252525,
            grass: 0x3c3c3c,
            underground: 0x1b0d03,
            playerSubmerge: 0xa44f2b,
            playerGhillie: 0x303030,
        },
        particles: { camera: "falling_volcanic_ash" },
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
                        centerObj: "teapavilion_01w",
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


        importantSpawns: [
            "memorial_park",
            "desert_town_02i",
            "logging_complex_01i",
        ],

        fixedSpawns: [
            {
                silo_01: 2,
                cache_06: 1,
                house_red_01: 1,
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
            },
        ],
        randomSpawns: [
            {
                spawns: [ "memorial_park"],
                choose: 1,
            },
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
                tree_01: "tree_05i",
                bush_01: "bush_05i",
                bush_04: "bush_04i",
                bush_07: "bush_05i",
                tree_06: "tree_05i",
                tree_07: "tree_05i",
                tree_03sv: "tree_05i",
                tree_13: "tree_13i",
                stone_01: "stone_01i",
                stone_03: "stone_03i",
            },
        ],
    },
};
export const DeathmatchInferno = util.mergeDeep({}, Main, mapDef) as MapDef;

DeathmatchInferno["lootTable"] = {
    ...DeathmatchInferno["lootTable"],
    tier_forest_helmet: [{ name: "helmet03_lava", count: 1, weight: 1 }],
    tier_perks_inferno: [
        { name: "pyro", count: 1, weight: 1 },
        { name: "phoenix", count: 1, weight: 1 },
    ],
    tier_ring_case: [
        { name: "sv98", count: 1, weight: 0.75 },
        { name: "usas", count: 1, weight: 0.15 },
    ],
    tier_airdrop_uncommon: [
        { name: "saiga", count: 1, weight: 1 },
        { name: "sv98", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 0.9 },
        { name: "m249", count: 1, weight: 0.1 },
    ],
    tier_airdrop_rare: [
        { name: "garand", count: 1, weight: 6 },
        { name: "awc", count: 1, weight: 3 },
        { name: "pkp", count: 1, weight: 0.08 },
        { name: "m249", count: 1, weight: 0.1 },
        { name: "m4a1", count: 1, weight: 4 },
        { name: "scorpion", count: 1, weight: 5 },
        { name: "scarssr", count: 1, weight: 4.5 },
    ],
    tier_airdrop_mythic: [
        { name: "scarssr", count: 1, weight: 1 },
        { name: "usas", count: 1, weight: 0.5 },
        { name: "awc", count: 1, weight: 0.1 },
        { name: "pkp", count: 1, weight: 0.3 },
        { name: "m249", count: 1, weight: 0.3 },
    ],
    tier_guns: [
        { name: "flare_gun", count: 1, weight: 0.5 },
        { name: "flare_gun_dual", count: 1, weight: 0.25 },
        { name: "nitroLace", count: 2, weight: 0.8 },
        { name: "machete_taiga", count: 1, weight: 0.6 },
        { name: "lasr_gun", count: 1, weight: 0.7 },
        { name: "lasr_gun_dual", count: 1, weight: 0.6 },
        { name: "garand", count: 1, weight: 0.9 },
    ],
};

/* STRIP_FROM_PROD_CLIENT:START */
Object.assign(DeathmatchInferno.lootTable, structuredClone(DeatchmatchMain.lootTable));
/* STRIP_FROM_PROD_CLIENT:END */
