import type { MapDef } from "../../../../shared/defs/mapDefs";
import type { PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { MayThemeDef } from "../../../../shared/defs/maps/mayDefs";
import { util } from "../../../../shared/utils/util";
import { DeatchmatchMain } from "./main";

const mapDef: PartialMapDef = {
    gameMode: { maxPlayers: 40 },
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
                ...DeatchmatchMain.mapGen.densitySpawns[0],
                crate_23: 6,
            },
        ],
        spawnReplacements: [
            {
                tree_01: "tree_01m",
                tree_07: "tree_01m",
                bush_01: "bush_01m",
                crate_01: "crate_01m",
                teahouse_complex_01su: "teahouse_complex_01m",
            },
        ],
    },
};

export const DeathmatchMay = util.mergeDeep(
    {},
    DeatchmatchMain,
    MayThemeDef,
    mapDef,
) as MapDef;
