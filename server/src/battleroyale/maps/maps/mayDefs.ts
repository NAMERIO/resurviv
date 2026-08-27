import { MayMapDef } from "../../../../../shared/defs/maps/mayDefs";
import { util } from "../../../../../shared/utils/util";
import { Main } from "./baseDefs";

export const May = util.mergeDeep({}, Main, MayMapDef);
