import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Main, type PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";

const switchToSmallMap = false;

const config = {
    mapSize: switchToSmallMap ? "small" : "large",
    places: 3,
    mapWidth: 225,
    spawnDensity: 60,
} as const;

export const mapDef: PartialMapDef = {
    desc: {
        icon: "img/loot/loot-perk-phoenix.svg",
        buttonCss: "btn-mode-twighlight",
    },
    biome: {
        colors: {
            background: 0x20536e,
            water: 0x3282ab,
            waterRipple: 0xb3f0ff,
            beach: 0xcdb35b,
            riverbank: 0x905e24,
            grass: 0x80af49,
            underground: 0x1b0d03,
            playerSubmerge: 0x2b8ca4,
            playerGhillie: 0x83af50,
        },
        particles: { camera: "falling_leaf_spring" },
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main", "cobalt", "woods"],
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
            : [],
        // @ts-expect-error figure me out later
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
                teahouse_complex_01su: 1,
                shack_03b: 3,
                shack_01: 2,
                mansion_structure_01: 1,
                police_01: 1,
                bank_01: 1,
                greenhouse_01: 1,
                house_red_02: 1,
            },
        ],
        importantSpawns: ["logging_complex_01tw", "club_complex_01"],
        customSpawnRules: {
            locationSpawns: [],
        },
        randomSpawns: [
            {
                spawns: ["logging_complex_01tw", "club_complex_01"],
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
        spawnReplacements: [
            {
                tree_07: "tree_01",
            },
        ],
    },
};

export const DeatchmatchMain: MapDef = util.mergeDeep({}, Main, mapDef);

DeatchmatchMain["lootTable"] = {
    tier_airdrop_uncommon: [
        { name: "sv98", count: 1, weight: 1 },
        { name: "outfitGhillie", count: 1, weight: 1 },
        { name: "lasr_gun_dual", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
        { name: "pan", count: 1, weight: 1 },
        { name: "tier_perks", count: 1, weight: 1 },
        { name: "strobe", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "naginata", count: 1, weight: 1 },
        { name: "mirv", count: 3, weight: 1 },
        { name: "flare_gun_dual", count: 1, weight: 1 },
        { name: "lasr_gun", count: 1, weight: 1 },
        { name: "smoke", count: 3, weight: 1 },
        { name: "saiga", count: 1, weight: 1 },
        { name: "garand", count: 1, weight: 1 },
    ],
    tier_airdrop_rare: [
        { name: "sv98", count: 1, weight: 1 },
        { name: "outfitGhillie", count: 1, weight: 1 },
        { name: "lasr_gun_dual", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
        { name: "pan", count: 1, weight: 1 },
        { name: "tier_perks", count: 1, weight: 1 },
        { name: "strobe", count: 1, weight: 1 },
        { name: "awc", count: 1, weight: 1 },
        { name: "scarssr", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "flare_gun_dual", count: 1, weight: 1 },
        { name: "potato_cannon", count: 1, weight: 1 },
    ],
    tier_ammo: [
        { name: "frag", count: 3, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "mirv", count: 1, weight: 0.5 },
        { name: "poison_gas", count: 1, weight: 0.5 },
        { name: "bandage", count: 5, weight: 0.5 },
        { name: "healthkit", count: 1, weight: 0.5 },
        { name: "mine", count: 2, weight: 0.5 },
        { name: "painkiller", count: 10, weight: 0.5 },
    ],
    tier_ammo_crate: [{ name: "tier_ammo", count: 2, weight: 1 }],
    tier_cattle_crate: [
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "flare_gun_dual", count: 1, weight: 1 },
        { name: "potato_cannon", count: 1, weight: 1 },
    ],
    tier_chest: [
        { name: "saiga", count: 1, weight: 1 },
        { name: "strobe", count: 1, weight: 1 },
        { name: "bonesaw_rusted", count: 1, weight: 1 },
        { name: "katana", count: 1, weight: 1 },
        { name: "tier_soviet", count: 3, weight: 1 },
    ],
    tier_chest_04: [
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "smoke", count: 4, weight: 1 },
        { name: "poison_gas", count: 4, weight: 1 },
        { name: "tier_soviet", count: 2, weight: 1 },
    ],
    tier_chrys_01: [{ name: "tier_soviet", count: 1, weight: 1 }],
    tier_chrys_02: [
        { name: "katana", count: 1, weight: 0.7 },
        { name: "naginata", count: 1, weight: 0.2 },
        { name: "pan", count: 1, weight: 0.1 },
    ],
    tier_chrys_case: [
        { name: "naginata", count: 1, weight: 3 },
        { name: "m134", count: 1, weight: 1 },
        { name: "m249", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
    tier_club_melee: [
        { name: "machete_taiga", count: 1, weight: 0.5 },
        { name: "naginata", count: 1, weight: 0.2 },
        { name: "m1014", count: 1, weight: 0.2 },
        { name: "tier_soviet", count: 5, weight: 0.1 },
    ],
    tier_container: [{ name: "tier_world", count: 1, weight: 1 }],
    tier_eye_02: [{ name: "stonehammer", count: 1, weight: 1 }],
    tier_eye_block: [
        { name: "ots38_dual", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "tier_soviet", count: 1, weight: 1 },
        { name: "m249", count: 1, weight: 1 },
        { name: "awc", count: 1, weight: 0.5 },
        { name: "pkp", count: 1, weight: 1 },
        { name: "scarssr", count: 1, weight: 0.5 },
        { name: "m79", count: 1, weight: 1 },
    ],
    tier_eye_stone: [
        { name: "frag", count: 10, weight: 1 },
        { name: "smoke", count: 10, weight: 1 },
        { name: "poison_gas", count: 10, weight: 1 },
        { name: "mine", count: 10, weight: 1 },
        { name: "strobe", count: 2, weight: 0.5 },
        { name: "strobe", count: 1, weight: 0.5 },
    ],
    tier_guns: [{ name: "tier_world", count: 1, weight: 1 }],
    tier_hatchet: [
        { name: "pan", count: 1, weight: 0.5 },
        { name: "poison_gas", count: 5, weight: 1 },
        { name: "saiga", count: 1, weight: 0.5 },
        { name: "bonesaw_rusted", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 0.5 },
        { name: "m249", count: 1, weight: 0.5 },
    ],
    tier_hatchet_melee: [
        { name: "fireaxe", count: 1, weight: 0.5 },
        { name: "stonehammer", count: 1, weight: 0.3 },
        { name: "explosive", count: 1, weight: 0.2 },
    ],
    tier_imperial_outfit: [{ name: "tier_spetnaz_outfit", count: 1, weight: 1 }],
    tier_leaf_pile: [{ name: "tier_world", count: 1, weight: 1 }],
    tier_lumber_outfit: [
        { name: "firepower", count: 1, weight: 1 },
        { name: "high_velocity", count: 1, weight: 1 },
        { name: "explosive", count: 1, weight: 1 },
        { name: "bonus_assault", count: 1, weight: 1 },
    ],
    tier_mansion_floor: [{ name: "tier_soviet", count: 1, weight: 1 }],
    tier_pineapple_outfit: [{ name: "tier_lumber_outfit", count: 1, weight: 1 }],
    tier_pirate_melee: [
        { name: "hook", count: 1, weight: 3 },
        { name: "sv98", count: 1, weight: 1 },
    ],
    tier_perks: [
        { name: "firepower", count: 1, weight: 1 },
        { name: "windwalk", count: 1, weight: 1 },
        { name: "endless_ammo", count: 1, weight: 1 },
        { name: "steelskin", count: 1, weight: 1 },
        { name: "splinter", count: 1, weight: 1 },
        { name: "small_arms", count: 1, weight: 1 },
        { name: "takedown", count: 1, weight: 1 },
        { name: "field_medic", count: 1, weight: 1 },
        { name: "tree_climbing", count: 1, weight: 1 },
        { name: "scavenger", count: 1, weight: 1 },
        { name: "chambered", count: 1, weight: 1 },
        { name: "martyrdom", count: 1, weight: 1 },
        { name: "self_revive", count: 1, weight: 1 },
        { name: "bonus_9mm", count: 1, weight: 1 },
        { name: "bonus_45", count: 1, weight: 1 },
        { name: "high_velocity", count: 1, weight: 1 },
    ],
    tier_police: [
        { name: "saiga", count: 1, weight: 1 },
        { name: "scarssr", count: 1, weight: 0.444 },
        { name: "healthkit", count: 5, weight: 1 },
        { name: "kukri_trad", count: 1, weight: 2 },
    ],
    tier_police_floor: [{ name: "tier_soviet", count: 1, weight: 1 }],
    tier_ring_case: [
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "tier_soviet", count: 3, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
        { name: "strobe", count: 1, weight: 1 },
        { name: "sv98", count: 1, weight: 1 },
    ],
    tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
    tier_soviet: [
        { name: "poison_gas", count: 4, weight: 0.25 },
        { name: "mine", count: 4, weight: 0.25 },
        { name: "mirv", count: 4, weight: 0.25 },
        { name: "smoke", count: 4, weight: 0.25 },
        { name: "bonesaw_rusted", count: 1, weight: 0.25 },
        { name: "fireaxe", count: 1, weight: 0.25 },
        { name: "kukri_trad", count: 1, weight: 0.25 },
        { name: "katana_rusted", count: 1, weight: 0.25 },
        { name: "sv98", count: 1, weight: 0.05 },
        { name: "saiga", count: 1, weight: 0.05 },
        { name: "strobe", count: 1, weight: 0.05 },
        { name: "flare_gun", count: 1, weight: 0.05 },
        { name: "frag", count: 15, weight: 0.05 },
        { name: "m249", count: 1, weight: 0.05 },
        { name: "pkp", count: 1, weight: 0.05 },
    ],
    tier_spetnaz_outfit: [
        { name: "mirv", count: 4, weight: 1 },
        { name: "mine", count: 4, weight: 1 },
        { name: "smoke", count: 4, weight: 1 },
        { name: "poison_gas", count: 4, weight: 1 },
        { name: "strobe", count: 1, weight: 1 },
    ],
    tier_surviv: [{ name: "tier_soviet", count: 1, weight: 1 }],
    tier_tarkhany_outfit: [
        { name: "saiga", count: 1, weight: 1 },
        { name: "flare_gun", count: 1, weight: 1 },
        { name: "smoke", count: 4, weight: 1 },
        { name: "poison_gas", count: 4, weight: 1 },
    ],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "poison_gas", count: 1, weight: 0.33 },
        { name: "mine", count: 1, weight: 0.33 },
        { name: "mirv", count: 2, weight: 0.34 },
        { name: "strobe", count: 1, weight: 0.05 },
    ],
    tier_toilet: [
        { name: "healthkit", count: 1, weight: 1 },
        { name: "bandage", count: 5, weight: 1 },
        { name: "soda", count: 1, weight: 1 },
        { name: "painkiller", count: 1, weight: 1 },
        { name: "tier_world", count: 1, weight: 1 },
    ],
    tier_vault_floor: [{ name: "tier_soviet", count: 1, weight: 1 }],
    tier_vending_soda: [
        { name: "soda", count: 3, weight: 0.5 },
        { name: "soda", count: 9, weight: 0.25 },
        { name: "soda", count: 15, weight: 0.1 },
        { name: "tier_perks", count: 1, weight: 0.15 },
    ],
    tier_verde_outfit: [{ name: "tier_tarkhany_outfit", count: 1, weight: 1 }],
    tier_woodaxe: [
        { name: "woodaxe", count: 1, weight: 0.8 },
        { name: "sledgehammer", count: 1, weight: 0.15 },
        { name: "warhammer_tank", count: 1, weight: 0.05 },
    ],
    tier_world: [
        { name: "frag", count: 3, weight: 0.5 },
        { name: "smoke", count: 1, weight: 0.5 },
        { name: "bandage", count: 5, weight: 0.25 },
        { name: "healthkit", count: 1, weight: 0.25 },
        { name: "soda", count: 1, weight: 0.25 },
        { name: "painkiller", count: 1, weight: 0.25 },
        { name: "crowbar", count: 1, weight: 0.5 },
        { name: "spade", count: 1, weight: 0.5 },
        { name: "", count: 1, weight: 3.5 },
        { name: "smoke", count: 10, weight: 0.2 },
        { name: "tier_soviet", count: 1, weight: 0.3 },
    ],
    tier_saloon: [
        { name: "tier_soviet", count: 1, weight: 0.4 },
        { name: "stonehammer", count: 1, weight: 0.3 },
        { name: "strobe", count: 1, weight: 0.3 },
    ],
};
