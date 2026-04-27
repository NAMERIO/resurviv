import type { MapDef } from "../../../../../shared/defs/mapDefs";
import { util } from "../../../../../shared/utils/util";
import { Main, type PartialMapDef } from "./baseDefs";

export const testNormal = util.mergeDeep({}, Main, {
    mapGen: {
        map: {
            baseWidth: 128,
            baseHeight: 128,
            rivers: {
                lakes: [],
                weights: [{ weight: 1, widths: [] }],
                spawnCabins: false,
            },
        },
        customSpawnRules: {
            locationSpawns: [],
            placeSpawns: [],
        },
        densitySpawns: [{}],
        fixedSpawns: [{}],
        randomSpawns: [],
        spawnReplacements: [{}],
    },
} satisfies PartialMapDef) as MapDef;

export const testFaction = util.mergeDeep({}, testNormal, {
    gameMode: {
        factionMode: true,
        factions: 2,
    },
} satisfies PartialMapDef) as MapDef;
