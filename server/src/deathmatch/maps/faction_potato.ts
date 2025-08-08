import { v2 } from "../../../../shared/utils/v2";
import { MapId } from "../../../../shared/defs/types/misc";
import type { MapDef } from "../../../../shared/defs/mapDefs";
import { Faction } from "../../../../shared/defs/maps/factionDefs";
import type {  PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { util } from "../../../../shared/utils/util";

export enum TeamColor {
    // NONE = 0, // can be used ambiguously with code that runs the same regardless of team color
    Red = 1,
    Blue = 2,
}

const config = {
    spawnDensity: { large: 44, small: 37 },
} as const;
export const SpecialAirdropConfig = {
    startCircle: 1,
    endCircle: 3,
    aliveCountThreshold: 0.2,
};

const mapDef: PartialMapDef = {
    assets: {
        audio: [
            { name: "potato_01", channel: "sfx" },
            { name: "potato_02", channel: "sfx" },
            { name: "potato_pickup_01", channel: "ui" },
        ],
        atlases: ["gradient", "loadout", "shared", "faction", "potato"],
    },
    biome: {
        particles: {
            camera: "falling_potato",
        },
        frozenSprites: ["player-mash-01.img", "player-mash-02.img", "player-mash-03.img"],
    },
    gameMode: {
        maxPlayers: 100,
        factionMode: true,
        factions: 2,
        potatoMode: true,
    },
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
            crates: [{ name: "airdrop_crate_03", weight: 1 }],
        },
        roles: undefined
    },
    mapGen: {
        map: {
            baseWidth: 250,
            baseHeight: 250,
        },
        customSpawnRules: {
            locationSpawns: [],
            placeSpawns: [],
        },
        densitySpawns: Faction.mapGen
                    ? Faction.mapGen.densitySpawns.reduce(
                          (array, item) => {
                              let object: Record<string, number> = { potato_01: 75, potato_02: 75, potato_03: 75 };
                              for (const [key, value] of Object.entries(item)) {
                                  object[key] =
                                      (value * config.spawnDensity.large) / 100;
                              }
                              array.push(object);
                              return array;
                          },
                          [] as Record<string, number>[],
                      )
                    : [
                        {
                        }
                    ], 
        fixedSpawns: [
            {
                warehouse_01f: 1,
                house_red_01: 1,
                house_red_02: 1,
                barn_01: 1,
                bank_01: 1,
                police_01: 1,
                hut_01: 1,
                hut_02: 1,
                shack_03a: 2,
                shack_03b: 3,
                greenhouse_01: 1,
                cache_01: 1,
                cache_02: 1,
                cache_07: 1,
                mansion_structure_01: 1,
                bunker_structure_01: { odds: 1 },
                bunker_structure_03: 1,
                bunker_structure_04: 1,
                warehouse_complex_01: 1,
                chest_01: 1,
                chest_03f: 1,
                mil_crate_02: { odds: 1 },
                tree_02: 1,
            },
        ],
        randomSpawns: [],
        spawnReplacements: [
            {
                bush_01: "bush_01f",
                crate_02: "crate_01",
                stone_01: "stone_01f",
                stone_03: "stone_03f",
                tree_01: "tree_08f",
            },
        ],
        importantSpawns: [
            "river_town_01",
            // "police_01",
            // "bank_01",
            "mansion_structure_01",
            "warehouse_complex_01",
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};

export const FactionPotato = util.mergeDeep({}, Faction, mapDef) as MapDef;

FactionPotato["lootTable"] = {
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
        { name: "potato_cannon", count: 1, weight: 1 },
        { name: "potato_smg", count: 1, weight: 1 },
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
        { name: "potato_cannon", count: 1, weight: 2 },
        { name: "potato_smg", count: 1, weight: 2 },
    ],
    tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
    tier_chest_04: [
        { name: "p30l", count: 1, weight: 40 },
        { name: "p30l_dual", count: 1, weight: 1 },
        { name: "potato_cannon", count: 1, weight: 1 },
        { name: "potato_smg", count: 1, weight: 1 },
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
        { name: "potato_cannon", count: 1, weight: 1 },
        { name: "potato_smg", count: 1, weight: 1 },
    ],
    tier_airdrop_rare: [
        { name: "sv98", count: 1, weight: 1 },
        { name: "outfitGhillie", count: 1, weight: 1 },
        { name: "lasr_gun_dual", count: 1, weight: 1 },
        { name: "lasr_gun", count: 1, weight: 1 },
        { name: "m79", count: 1, weight: 1 },
        { name: "potato_cannon", count: 1, weight: 1 },
        { name: "potato_smg", count: 1, weight: 1 },
    ],
    tier_throwables: [
        { name: "frag", count: 2, weight: 1 },
        { name: "smoke", count: 1, weight: 1 },
        { name: "mirv", count: 2, weight: 0.05 },
        { name: "potato", count: 5, weight: 2 },
    ],
    tier_hatchet: [
        { name: "pan", count: 1, weight: 1 },
        { name: "pkp", count: 1, weight: 1 },
    ],
};
