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
        icon: "img/loot/loot-perk-phoenix.svg",
        buttonCss: "btn-mode-perks",
        backgroundImg: "img/main_splash_cobalt.png",
    },
    assets: {
        audio: [
            { name: "pumpkin_break_01", channel: "sfx" },
            { name: "spawn_01", channel: "ui" },
            { name: "ambient_lab_01", channel: "ambient" },
            { name: "log_13", channel: "sfx" },
            { name: "log_14", channel: "sfx" },
        ],
        atlases: ["gradient", "loadout", "shared", "perks"],
    },
    biome: {
        colors: {
            background: 3818586,
            water: 4016234,
            waterRipple: 4213882,
            beach: 4213882,
            riverbank: 4016234,
            grass: 3818586,
            underground: 3818586,
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
            airdropImg: "airdrop_crate",
        },
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
                police_01p: 1,
            },
        ]
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};
export const DeatchmatchPerks = util.mergeDeep({}, Main, mapDef) as MapDef;

DeatchmatchPerks["lootTable"] = {
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
        { name: "sv98", count: 1, weight: 0.9 },
        { name: "outfitGhillie", count: 1, weight: 0.1 },
        { name: "ap_rounds", count: 1, weight: 1 },
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
};
