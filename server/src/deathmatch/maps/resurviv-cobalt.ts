// import type { MapDef } from "../../../../shared/defs/mapDefs";
// import { Main } from "../../../../shared/defs/maps/baseDefs";
// import { Cobalt } from "../../../../shared/defs/maps/cobaltDefs";
// import { GameConfig } from "../../../../shared/gameConfig";
// import { util } from "../../../../shared/utils/util";
// import { v2 } from "../../../../shared/utils/v2";
// import { THIS_REGION } from "../../resurviv-config";

// const switchToSmallMap = THIS_REGION === "eu" || THIS_REGION === "as";

// const config = {
//     mapSize: switchToSmallMap ? "small" : "large",
//     places: 3,
//     mapWidth: { large: 280, small: 240 },
//     spawnDensity: { large: 37, small: 27 },
// } as const;

// export const Resurviv_Cobalt: MapDef = util.mergeDeep(structuredClone(Cobalt), {
//     mapId: 7,
//     desc: {
//         name: "Cobalt",
//         icon: "img/gui/cobalt.svg",
//         buttonCss: "btn-mode-cobalt",
//     },
//     assets: {
//         audio: [
//             { name: "spawn_01", channel: "ui" },
//             { name: "ping_unlock_01", channel: "ui" },
//             { name: "ambient_lab_01", channel: "ambient" },
//             { name: "log_13", channel: "sfx" },
//             { name: "log_14", channel: "sfx" },
//         ],
//         atlases: ["gradient", "loadout", "shared", "cobalt"],
//     },
//     gameConfig: {
//         planes: {
//             timings: [
//                 {
//                     circleIdx: 0,
//                     wait: 2,
//                     options: { type: GameConfig.Plane.Airdrop },
//                 },
//             ],
//         },
//     },
//     biome: {
//         colors: {
//             background: 134680,
//             water: 13681,
//             beach: 6834230,
//             riverbank: 4472122,
//             grass: 5069416,
//             underground: 1772803,
//             playerSubmerge: 1192009,
//             playerGhillie: 4937830,
//         },
//         particles: {},
//     },
//     /* STRIP_FROM_PROD_CLIENT:START */
//     mapGen: {
//         customSpawnRules: {
//             locationSpawns: [
//                 {
//                     type: "bunker_structure_09",
//                     pos: v2.create(0.5, 0.5),
//                     rad: 100,
//                     retryOnFailure: true,
//                 },
//             ],
//         },
//         map: {
//             baseWidth: config.mapWidth[config.mapSize],
//             baseHeight: config.mapWidth[config.mapSize],
//             shoreInset: 40,
//             rivers: {
//                 weights: [],
//             },
//         },
//         places: Main.mapGen
//             ? Array(config.places)
//                   .fill(false)
//                   .map(() => {
//                       return Main.mapGen?.places[
//                           Math.floor(Math.random() * Main.mapGen.places.length)
//                       ];
//                   })
//             : {},
//         densitySpawns: Main.mapGen
//             ? Main.mapGen.densitySpawns.reduce(
//                   (array, item) => {
//                       let object: Record<string, number> = {};
//                       for (const [key, value] of Object.entries(item)) {
//                           object[key] =
//                               (value * config.spawnDensity[config.mapSize]) / 100;
//                       }
//                       array.push(object);
//                       return array;
//                   },
//                   [] as Record<string, number>[],
//               )
//             : {},
//         fixedSpawns: [
//             {
//                 club_complex_01: 1,
//                 mansion_structure_01: 1,
//                 // small is spawn count for solos and duos, large is spawn count for squads
//                 warehouse_01: { odds: 0.5 },
//                 house_red_01: config.mapSize === "large" ? 1 : { odds: 0.5 },
//                 // house_red_02: 1,
//                 // barn_01: { small: 1, large: 3 },
//                 // barn_02: 1,
//                 hut_01: 2,
//                 hut_02: 1, // spas hut
//                 hut_03: 1, // scout hut
//                 // greenhouse_01: 1,
//                 cache_01: 1,
//                 cache_02: { odds: 0.1 }, // mosin tree
//                 cache_07: 1,
//                 // bunker_structure_01: { odds: 0.05 },
//                 bunker_structure_02: config.mapSize === "large" ? 1 : 0,
//                 // bunker_structure_03: 1,
//                 // bunker_structure_04: 1,
//                 // bunker_structure_05: 1,
//                 // warehouse_complex_01: 1,
//                 chest_01: 1,
//                 chest_03: { odds: 0.2 },
//                 // mil_crate_02: { odds: 0.25 },
//                 tree_02: 3,
//                 tree_01cb: 100,
//                 teahouse_complex_01su: { odds: 0.5 },
//                 // stone_04: 1,
//             },
//         ],
//         randomSpawns: [
//             {
//                 spawns: [
//                     // "mansion_structure_01",
//                     // "warehouse_complex_01",
//                     "police_01",
//                     "bank_01",
//                 ],
//                 choose: config.mapSize === "large" ? 2 : 1,
//             },
//         ],
//     },
//     /* STRIP_FROM_PROD_CLIENT:END */
//     gameMode: {
//         maxPlayers: 80,
//         perkMode: true,
//         perkModeRoles: ["sniper", "healer", "demo", "assault", "tank"],
//     },
// });
// Resurviv_Cobalt["lootTable"] = {
//     tier_mansion_floor: [{ name: "outfitCasanova", count: 1, weight: 1 }],
//     tier_vault_floor: [{ name: "outfitJester", count: 1, weight: 1 }],
//     tier_police_floor: [{ name: "outfitPrisoner", count: 1, weight: 1 }],
//     tier_chrys_01: [{ name: "outfitImperial", count: 1, weight: 1 }],
//     tier_chrys_02: [{ name: "katana", count: 1, weight: 1 }],
//     tier_chrys_case: [
//         // { name: "helmet03_forest", count: 1, weight: 199 },
//         { name: "tier_katanas", count: 1, weight: 3 },
//         { name: "naginata", count: 1, weight: 1 },
//     ],
//     tier_eye_02: [{ name: "stonehammer", count: 1, weight: 1 }],
//     tier_eye_block: [
//         { name: "m9", count: 1, weight: 1 },
//         { name: "ots38_dual", count: 1, weight: 1 },
//         { name: "flare_gun", count: 1, weight: 1 },
//         { name: "colt45", count: 1, weight: 1 },
//         { name: "45acp", count: 1, weight: 1 },
//         { name: "painkiller", count: 1, weight: 1 },
//         { name: "m4a1", count: 1, weight: 1 },
//         { name: "m249", count: 1, weight: 1 },
//         { name: "awc", count: 1, weight: 1 },
//         { name: "pkp", count: 1, weight: 1 },
//     ],
//     tier_sledgehammer: [{ name: "sledgehammer", count: 1, weight: 1 }],
//     tier_chest_04: [
//         { name: "p30l", count: 1, weight: 40 },
//         { name: "p30l_dual", count: 1, weight: 1 },
//     ],
//     tier_woodaxe: [{ name: "woodaxe", count: 1, weight: 1 }],
//     tier_club_melee: [{ name: "machete_taiga", count: 1, weight: 1 }],
//     tier_pirate_melee: [{ name: "hook", count: 1, weight: 1 }],
//     tier_hatchet_melee: [
//         { name: "fireaxe", count: 1, weight: 5 },
//         { name: "tier_katanas", count: 1, weight: 3 },
//         { name: "stonehammer", count: 1, weight: 1 },
//     ],
//     tier_airdrop_uncommon: [
//         { name: "sv98", count: 1, weight: 1 },
//         { name: "outfitGhillie", count: 1, weight: 1 },
//     ],
//     tier_airdrop_rare: [
//         { name: "sv98", count: 1, weight: 1 },
//         { name: "outfitGhillie", count: 1, weight: 1 },
//     ],
//     tier_class_crate_mythic: [
//         { name: "scavenger_adv", count: 1, weight: 1 },
//         { name: "explosive", count: 1, weight: 2 },
//         { name: "splinter", count: 1, weight: 3 },
//     ],
// };