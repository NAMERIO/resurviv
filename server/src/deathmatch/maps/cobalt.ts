import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Cobalt } from "../../../../shared/defs/maps/cobaltDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";
import { loadAirstrike } from "../helpers";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: { large: 280, small: 240 },
    spawnDensity: { large: 44, small: 37 },
} as const;

export const DeatchmatchCobalt: MapDef = util.mergeDeep(structuredClone(Cobalt), {
    biome: {
        particles: { camera: "falling_leaf_spring" },
    },
    assets: {
        audio: [
            { name: "spawn_01", channel: "ui" },
            { name: "ping_unlock_01", channel: "ui" },
            { name: "ambient_lab_01", channel: "ambient" },
            { name: "log_13", channel: "sfx" },
            { name: "log_14", channel: "sfx" },
        ],
        atlases: ["gradient", "loadout", "shared", "main", "cobalt", "woods", "desert"],
    },
    gameConfig: {
        planes: {
            timings: [
                {
                    circleIdx: 0,
                    wait: 2,
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
                weights: [],
            },
        },
        places: Cobalt.mapGen
            ? Array(config.places)
                  .fill(false)
                  .map(() => {
                      return Cobalt.mapGen?.places[
                          Math.floor(Math.random() * Cobalt.mapGen.places.length)
                      ];
                  })
            : {},
        randomSpawns: [
            {
                spawns: ["logging_complex_01c", "desert_town_02c"],
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
                tree_01: "tree_01cb",
                stone_01: "stone_01cb",
                bush_01: "bush_01cb",
                bush_04: "bush_04cb",
                stone_03: "stone_03cb",
                bush_07: "bush_04cb",
                tree_07: "tree_01cb",
                tree_03sv: "tree_01cb",
            },
        ],
    },
});

DeatchmatchCobalt.lootTable = {
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
        { name: "nitoLace", count: 2, weight: 0.8 },
        { name: "machete_taiga", count: 1, weight: 0.6 },
        { name: "lasr_gun", count: 1, weight: 0.7 },
        { name: "lasr_gun_dual", count: 1, weight: 0.6 },
        { name: "garand", count: 1, weight: 0.9 },
    ],
    tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
    tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
    tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
    tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
    tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
    tier_chrys_case: [
        // { name: "tier_katanas", count: 1, weight: 3 },
        { name: "naginata", count: 1, weight: 1 },
        { name: "m134", count: 1, weight: 1 },
        // { name: "rainbow_blaster", count: 1, weight: 1.3 },
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
