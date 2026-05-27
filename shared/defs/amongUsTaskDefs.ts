export const AmongUsTaskIds = ["bottle_shooting"] as const;

export type AmongUsTaskId = (typeof AmongUsTaskIds)[number];

export interface AmongUsTaskDef {
    id: AmongUsTaskId;
    title: string;
    instruction: string;
    stationObject: string;
    targetCount: number;
    targetImage: string;
    weaponImage: string;
    shootSound: string;
    breakSound: string;
}

export const AmongUsTaskDefs = {
    bottle_shooting: {
        id: "bottle_shooting",
        title: "BREAK THE BOTTLES",
        instruction: "Click every bottle to clear the task.",
        stationObject: "among_us_task_bottles",
        targetCount: 6,
        targetImage: "/img/map/map-bottle-04.svg",
        weaponImage: "/img/loot/loot-weapon-m9.svg",
        shootSound: "m9_01",
        breakSound: "window_break_01",
    },
} satisfies Record<AmongUsTaskId, AmongUsTaskDef>;
