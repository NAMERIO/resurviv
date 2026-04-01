import type { MapDef } from "../../../../shared/defs/mapDefs";
import type { PartialMapDef } from "../../../../shared/defs/maps/baseDefs";
import { MapId } from "../../../../shared/defs/types/misc";
import { util } from "../../../../shared/utils/util";
import { DeatchmatchMain } from "./main";

const aprilFoolsDef: PartialMapDef = {
    mapId: MapId.AprilFools,
    desc: {
        name: "April Fools",
        icon: "img/loot/loot-perk-halloween-mystery.svg",
        buttonCss: "btn-mode-april-fools",
        backgroundImg: "img/main_splash.png",
    },
    assets: {
        atlases: ["gradient", "loadout", "shared", "main", "woods", "desert"],
    },
    gameMode: {
        aprilFoolsMode: true,
    },
};

export const DeathmatchAprilFools: MapDef = util.mergeDeep(
    {},
    DeatchmatchMain,
    aprilFoolsDef,
);
