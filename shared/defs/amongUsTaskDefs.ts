export const AmongUsTaskIds = ["bottle_shooting", "crate_gold_bars"] as const;

export type AmongUsTaskId = (typeof AmongUsTaskIds)[number];

export interface AmongUsTaskDef {
    id: AmongUsTaskId;
    type: "shoot_targets" | "drag_to_station";
    title: string;
    instruction: string;
    stationObject: string;
    targetCount: number;
    targetImage: string;
    stationImage?: string;
    weaponImage?: string;
    shootSound?: string;
    breakSound?: string;
}

export const AmongUsTaskDefs = {
    bottle_shooting: {
        id: "bottle_shooting",
        type: "shoot_targets",
        title: "BREAK THE BOTTLES",
        instruction: "Click every bottle to clear the task.",
        stationObject: "among_us_task_bottles",
        targetCount: 6,
        targetImage: "/img/map/map-bottle-04.svg",
        weaponImage: "/img/loot/loot-weapon-m9.svg",
        shootSound: "m9_01",
        breakSound: "window_break_01",
    },
    crate_gold_bars: {
        id: "crate_gold_bars",
        type: "drag_to_station",
        title: "LOAD THE CRATE",
        instruction: "Drag every gold bar onto the crate.",
        stationObject: "among_us_task_crate",
        targetCount: 4,
        targetImage: "/img/loot/loot-gold-bar.svg",
        stationImage: "/img/map/map-crate-05.svg",
    },
} satisfies Record<AmongUsTaskId, AmongUsTaskDef>;
