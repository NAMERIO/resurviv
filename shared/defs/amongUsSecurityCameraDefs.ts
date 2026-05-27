import { type Vec2, v2 } from "../utils/v2";

export interface AmongUsSecurityCameraDef {
    id: string;
    label: string;
    pos: Vec2;
    ori: number;
}

export const AmongUsSecurityCameraDefs: readonly AmongUsSecurityCameraDef[] = [
    {
        id: "west-hall",
        label: "WEST HALL",
        pos: v2.create(-61.875, 6.531),
        ori: 3,
    },
    {
        id: "cafeteria",
        label: "CAFETERIA",
        pos: v2.create(-3.125, 27.531),
        ori: 2,
    },
    {
        id: "lower-hall",
        label: "LOWER HALL",
        pos: v2.create(13.875, -22.969),
        ori: 0,
    },
    {
        id: "east-hall",
        label: "EAST HALL",
        pos: v2.create(52.125, 8.531),
        ori: 1,
    },
];
