import { type Vec2, v2 } from "../utils/v2";

export interface AmongUsSecurityCameraDef {
    id: string;
    label: string;
    pos: Vec2;
    ori: number;
    disabled?: boolean;
}

export const AmongUsSecurityCameraDefs: readonly AmongUsSecurityCameraDef[] = [
    {
        id: "west-hall",
        label: "WEST HALL",
        pos: v2.create(-57.719, 9.438),
        ori: 0,
    },
    {
        id: "cafeteria",
        label: "CAFETERIA",
        pos: v2.create(22.281, 10.5),
        ori: 0,
    },
    {
        id: "lower-hall",
        label: "LOWER HALL",
        pos: v2.create(-14.5, -32.344),
        ori: 0,
    },
    {
        id: "east-hall",
        label: "EAST HALL",
        pos: v2.create(52.125, 8.531),
        ori: 1,
        disabled: true,
    },
];
