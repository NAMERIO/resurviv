import type { MapDef } from "../../../../shared/defs/mapDefs";
import { util } from "../../../../shared/utils/util";
import { Contact as BattleRoyaleContact } from "../../battleroyale/maps/maps/contactDefs";
import { DeatchmatchMain } from "./main";

const audio = Array.from(
    new Map(
        [...DeatchmatchMain.assets.audio, ...BattleRoyaleContact.assets.audio].map(
            (asset) => [asset.name, asset],
        ),
    ).values(),
);

const atlases = Array.from(
    new Set([
        ...DeatchmatchMain.assets.atlases,
        ...BattleRoyaleContact.assets.atlases,
        "desert" as const,
    ]),
);

export const DeathmatchContact = util.mergeDeep(structuredClone(DeatchmatchMain), {
    mapId: BattleRoyaleContact.mapId,
    desc: structuredClone(BattleRoyaleContact.desc),
    assets: {
        audio,
        atlases,
    },
    biome: structuredClone(BattleRoyaleContact.biome),
    /* STRIP_FROM_PROD_CLIENT:START */
    mapGen: {
        randomSpawns: [
            {
                spawns: ["logging_complex_01ct", "desert_town_02ct"],
                choose: 1,
            },
            ...structuredClone(DeatchmatchMain.mapGen.randomSpawns.slice(1)),
        ],
        densitySpawns: [
            {
                ...DeatchmatchMain.mapGen.densitySpawns[0],
                crate_egg: 30,
            },
        ],
        fixedSpawns: [
            {
                ...DeatchmatchMain.mapGen.fixedSpawns[0],
                crop_circle_01: 1,
                crop_circle_02: 1,
                crop_circle_03: 1,
            },
        ],
        spawnReplacements: structuredClone(BattleRoyaleContact.mapGen.spawnReplacements),
    },
    /* STRIP_FROM_PROD_CLIENT:END */
    gameMode: structuredClone(BattleRoyaleContact.gameMode),
}) as MapDef;

/* STRIP_FROM_PROD_CLIENT:START */
DeathmatchContact.lootTable = {
    ...structuredClone(DeatchmatchMain.lootTable),
    tier_contact: structuredClone(BattleRoyaleContact.lootTable.tier_contact),
};
/* STRIP_FROM_PROD_CLIENT:END */
