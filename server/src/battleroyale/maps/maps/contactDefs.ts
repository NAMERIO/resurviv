import type { MapDef } from "../../../../../shared/defs/mapDefs";
import { MapId } from "../../../../../shared/defs/types/misc";
import { util } from "../../../../../shared/utils/util";
import { Main, type PartialMapDef } from "./baseDefs";

const mapDef: PartialMapDef = {
    mapId: MapId.Contact,
    desc: {
        name: "Contact",
        icon: "img/loot/loot-contact.svg",
        buttonCss: "btn-mode-contact",
        buttonText: "index-play-mode-contact",
        backgroundImg: "img/main_splash_contact.png",
    },
    assets: {
        audio: [
            { name: "club_music_01", channel: "ambient" },
            { name: "club_music_02", channel: "ambient" },
            { name: "ambient_steam_01", channel: "ambient" },
        ],
        atlases: ["gradient", "loadout", "shared", "main", "contact"],
    },
    biome: {
        colors: {
            background: 0x20536e,
            water: 0x7f5fff,
            waterRipple: 0xb3f0ff,
            beach: 0x6774a1,
            riverbank: 0x4d5b8b,
            grass: 0x2d385d,
            underground: 0x1b0d03,
            playerSubmerge: 0x2b8ca4,
            playerGhillie: 0x83af50,
        },
    },
    /* STRIP_FROM_PROD_CLIENT:START */
    lootTable: {
        tier_contact: [
            { name: "bandage", count: 5, weight: 2 },
            { name: "soda", count: 2, weight: 2 },
            { name: "healthkit", count: 1, weight: 1 },
            { name: "painkiller", count: 1, weight: 1 },
            { name: "skitternade", count: 1, weight: 5 },
            { name: "m870", count: 1, weight: 5 },
            { name: "helmet02", count: 1, weight: 3 },
            { name: "chest02", count: 1, weight: 3 },
            { name: "4xscope", count: 1, weight: 3 },
            { name: "spas12", count: 1, weight: 1 },
            { name: "skitter", count: 1, weight: 1, npc: true },
        ],
    },
    mapGen: {
        densitySpawns: [
            {
                ...Main.mapGen.densitySpawns[0],
                crate_egg: 30,
            },
        ],
        fixedSpawns: [
            {
                ...Main.mapGen.fixedSpawns[0],
                crop_circle_01: 1,
                crop_circle_02: 1,
                crop_circle_03: 1,
            },
        ],
        spawnReplacements: [
            {
                ...Main.mapGen.spawnReplacements[0],
                tree_01: "tree_19",
                bush_01: "bush_13",
                bush_04: "bush_13b",
                cache_06: "cache_contact",
                stone_03: "stone_03h",
                chest_03: "chest_03i",
                bunker_structure_04: "bunker_structure_04d",
                bunker_structure_05: "bunker_structure_05d",
            },
        ],
    },
    /* STRIP_FROM_PROD_CLIENT:END */
    gameMode: {
        maxPlayers: 80,
        killLeaderEnabled: true,
        contactMode: true,
        npcSpawns: {
            motherShip: 1,
        },
    },
};

export const Contact = util.mergeDeep({}, Main, mapDef) as MapDef;
