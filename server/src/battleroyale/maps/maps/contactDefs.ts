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
    gameMode: {
        maxPlayers: 80,
        killLeaderEnabled: true,
        contactMode: true,
        npcSpawns: {
            motherShip: 3,
        },
    },
};

export const Contact = util.mergeDeep({}, Main, mapDef) as MapDef;
