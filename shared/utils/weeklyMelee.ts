import { GameObjectDefs } from "../defs/gameObjectDefs";
import { Rarity } from "../gameConfig";

export const WEEKLY_MELEE_STOCK = 7;

const ROTATION_COOLDOWN = 7;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ROTATION_ANCHOR_MS = Date.UTC(2026, 10, 23);

export const weeklyMeleePrices: Partial<Record<Rarity, number>> = {
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 750,
    [Rarity.Mythic]: 1000,
};

export const weeklyMeleePool = [
    "huntsman_rugged",
    "huntsman_burnished",
    "bowie_vintage",
    "bowie_frontier",
    "karambit_camo",
    "bayonet_gilded",
    "knife_ben",
    "knife_toji",
    "karambit_blazing",
    "fliptechnical_rugged",
    "skeleton_knife_rugged",
    "m9bayonet_autotronic",
    "m9bayonet_pink",
    "m9bayonet_rugged",
    "dagger_kris",
    "ursus_jade",
    "karambit_amethyst",
    "karambit_gilded",
    "kunai_shadow",
    "sickle_farmer",
    "huntsman_bloodmoon",
    "karambit_bubblegum",
] as const;

export type WeeklyMeleeOffer = {
    id: string;
    itemType: string;
    name: string;
    price: number;
    rarity: Rarity;
    totalStock: number;
    startsAt: number;
    refreshesAt: number;
};

const rotationHistory = new Map<number, string>();

function createSeededRandom(seed: number) {
    let state = seed >>> 0;

    return () => {
        state += 0x6d2b79f5;

        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function getWeeklyMeleeRotation(cycle: number): string {
    const cached = rotationHistory.get(cycle);

    if (cached) return cached;

    for (let current = 0; current <= cycle; current++) {
        if (rotationHistory.has(current)) continue;

        const excluded = new Set<string>();

        for (
            let previous = Math.max(0, current - ROTATION_COOLDOWN);
            previous < current;
            previous++
        ) {
            const item = rotationHistory.get(previous);

            if (item) excluded.add(item);
        }

        const eligible = weeklyMeleePool.filter((item) => !excluded.has(item));

        if (eligible.length === 0) {
            throw new Error("No eligible weekly melee cosmetics");
        }

        const random = createSeededRandom(current ^ 0x5f3759df);

        const selected = eligible[Math.floor(random() * eligible.length)];

        rotationHistory.set(current, selected);
    }

    return rotationHistory.get(cycle)!;
}

export function getWeeklyMeleeOffer(now = Date.now()): WeeklyMeleeOffer | null {
    if (now < ROTATION_ANCHOR_MS) return null;

    const cycle = Math.floor((now - ROTATION_ANCHOR_MS) / WEEK_MS);

    const startsAt = ROTATION_ANCHOR_MS + cycle * WEEK_MS;

    const itemType = getWeeklyMeleeRotation(cycle);

    const def = GameObjectDefs[itemType] as
        | {
              type?: string;
              name?: string;
              rarity?: Rarity;
          }
        | undefined;

    if (!def || def.type !== "melee" || def.rarity === undefined) {
        throw new Error(`Invalid weekly melee: ${itemType}`);
    }

    const price = weeklyMeleePrices[def.rarity];

    if (price === undefined) {
        throw new Error(`Unsupported weekly melee rarity: ${itemType}`);
    }

    return {
        id: `${cycle}-${itemType}`,
        itemType,
        name: def.name ?? itemType,
        price,
        rarity: def.rarity,
        totalStock: WEEKLY_MELEE_STOCK,
        startsAt,
        refreshesAt: startsAt + WEEK_MS,
    };
}
