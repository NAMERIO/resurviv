import type { PrivateLobbyMiniGame } from "./miniGame";

export interface PrivateLobbyStartingGuns {
    primary: string[];
    secondary: string[];
}

export type StartingGunSlot = keyof PrivateLobbyStartingGuns;

export const StartingGunSlots: readonly StartingGunSlot[] = ["primary", "secondary"];

export const StartingGunMaxPerSlot = 20;

export const StartingGunCategories = [
    {
        id: "rifle",
        name: "Rifles",
        guns: [
            "ak47",
            "m4a1",
            "hk416",
            "scar",
            "famas",
            "an94",
            "groza",
            "grozas",
            "imbel",
        ],
    },
    {
        id: "smg",
        name: "SMGs",
        guns: ["mp5", "mac10", "ump9", "vector", "vector45", "scorpion", "m1a1"],
    },
    {
        id: "shotgun",
        name: "Shotguns",
        guns: ["m870", "mp220", "spas12", "m1100", "saiga", "spas16", "m1014", "usas"],
    },
    {
        id: "sniper",
        name: "Snipers",
        guns: [
            "mosin",
            "sv98",
            "awc",
            "scout_elite",
            "blr",
            "model94",
            "mkg45",
            "m39",
            "svd",
            "garand",
            "mk12",
            "l86",
            "vss",
            "scarssr",
        ],
    },
    {
        id: "lmg",
        name: "LMGs",
        guns: ["m249", "qbb97", "pkp", "dp28", "bar", "m134"],
    },
    {
        id: "pistol",
        name: "Pistols",
        guns: [
            "m9",
            "m93r",
            "glock",
            "p30l",
            "ot38",
            "ots38",
            "colt45",
            "m1911",
            "deagle",
            "flare_gun",
        ],
    },
    {
        id: "special",
        name: "Special",
        guns: ["m79", "bazooka", "m9a17", "potato_cannon", "potato_smg", "lasr_gun"],
    },
] as const;

export const StartingGunIds: readonly string[] = StartingGunCategories.flatMap(
    (category) => category.guns,
);

const StartingGunExcludedMiniGames: readonly PrivateLobbyMiniGame[] = [
    "gun_game",
    "hide_and_seek",
    "infected",
    "among_us",
];

export function privateLobbyMiniGameUsesStartingGuns(
    miniGame: PrivateLobbyMiniGame | undefined,
) {
    return !!miniGame && !StartingGunExcludedMiniGames.includes(miniGame);
}

export function emptyStartingGuns(): PrivateLobbyStartingGuns {
    return { primary: [], secondary: [] };
}

export function normalizeStartingGuns(value: unknown): PrivateLobbyStartingGuns {
    const input = (value ?? {}) as Partial<Record<StartingGunSlot, unknown>>;
    const clean = (list: unknown) => {
        if (!Array.isArray(list)) return [];
        const guns: string[] = [];
        for (const gun of list) {
            if (typeof gun !== "string" || !StartingGunIds.includes(gun)) continue;
            if (guns.includes(gun)) continue;
            guns.push(gun);
            if (guns.length >= StartingGunMaxPerSlot) break;
        }
        return guns;
    };
    return {
        primary: clean(input.primary),
        secondary: clean(input.secondary),
    };
}

export function startingGunsKey(guns: PrivateLobbyStartingGuns | undefined) {
    if (!guns) return "";
    return `${guns.primary.join(",")}|${guns.secondary.join(",")}`;
}

export function hasStartingGuns(guns: PrivateLobbyStartingGuns | undefined) {
    return !!guns && (guns.primary.length > 0 || guns.secondary.length > 0);
}
