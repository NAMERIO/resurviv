import { util } from "../../utils/util";
import { MapId } from "../types/misc";
import { Main, type PartialMapDef } from "./baseDefs";

export const MayThemeDef: PartialMapDef = {
    mapId: MapId.May,
    desc: {
        name: "May 4th",
        icon: "img/gui/lasr-swrds-icn.svg",
        buttonCss: "btn-mode-may",
    },
    assets: {
        audio: [],
        atlases: ["gradient", "loadout", "shared", "main", "may"],
    },
    biome: {
        colors: {
            background: 2118510,
            water: 10594251,
            waterRipple: 9892086,
            beach: 7635611,
            riverbank: 4279402,
            grass: 5793150,
            underground: 1772803,
            playerSubmerge: 12633565,
            playerGhillie: 5793150,
        },
        particles: {},
    },
    gameMode: { maxPlayers: 80, killLeaderEnabled: true, mayMode: true },
    /* STRIP_FROM_PROD_CLIENT:START */
    lootTable: {
        tier_space: [
            { name: "lasr_swrd_01", count: 1, weight: 0.29 },
            { name: "lasr_swrd_02", count: 1, weight: 0.15 },
            { name: "lasr_swrd_03", count: 1, weight: 0.15 },
            { name: "lasr_gun", count: 1, weight: 0.27 },
            { name: "lasr_gun_dual", count: 1, weight: 0.16 },
            { name: "pulseBox", count: 2, weight: 0.2 },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
};

export const MayMapDef: PartialMapDef = util.mergeDeep({}, MayThemeDef, {
    /* STRIP_FROM_PROD_CLIENT:START */
    lootTable: {
        tier_world: [
            ...structuredClone(Main.lootTable.tier_world),
            { name: "tier_space", count: 1, weight: 0.11 },
        ],
        tier_container: [
            ...structuredClone(Main.lootTable.tier_container),
            { name: "tier_space", count: 1, weight: 0.15 },
        ],
        tier_chest: [
            ...structuredClone(Main.lootTable.tier_chest),
            { name: "tier_space", count: 1, weight: 1.5 },
        ],
        tier_airdrop_uncommon: [
            ...structuredClone(Main.lootTable.tier_airdrop_uncommon),
            { name: "tier_space", count: 2, weight: 3 },
        ],
        tier_airdrop_rare: [
            ...structuredClone(Main.lootTable.tier_airdrop_rare),
            { name: "tier_space", count: 2, weight: 4 },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
    mapGen: {
        map: {
            rivers: {
                weights: [{ weight: 1, widths: [4] }],
                smoothness: 0.8,
                spawnCabins: false,
            },
        },
        densitySpawns: [
            {
                stone_01: 350,
                barrel_01: 76,
                silo_01: 8,
                crate_01m: 38,
                crate_02: 4,
                crate_03: 8,
                crate_03x: 1,
                bush_01m: 78,
                cache_06: 12,
                tree_01: 120,
                tree_02m: 200,
                hedgehog_01: 24,
                container_01: 5,
                container_02: 5,
                container_03: 5,
                container_04: 5,
                shack_01: 7,
                outhouse_01: 5,
                loot_tier_1: 24,
                loot_tier_beach: 4,
                crate_23: 30,
            },
        ],
        spawnReplacements: [
            {
                tree_01: "tree_01m",
                teahouse_complex_01su: "teahouse_complex_01m",
            },
        ],
    },
} satisfies PartialMapDef);

export const May = util.mergeDeep({}, Main, MayMapDef);
