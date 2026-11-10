import { GameObjectDefs } from "../defs/gameObjectDefs";
import {
    type FeaturedBundleDef,
    FeaturedBundleDefs,
    type FeaturedBundleSize,
} from "../defs/gameObjects/featuredBundleDefs";
import { PassDefs } from "../defs/gameObjects/passDefs";
import { UnlockDefs } from "../defs/gameObjects/unlockDefs";
import { Rarity } from "../gameConfig";
import { getMarketItemRarity } from "./marketPricing";

export type { FeaturedBundleSize } from "../defs/gameObjects/featuredBundleDefs";

export type FeaturedBundleRarity =
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mythic"
    | "divine"
    | "exclusive";

export type FeaturedBundleOffer = {
    id: string;
    name: string;
    size: FeaturedBundleSize;
    page: number;
    itemTypes: string[];
    originalPrice: number;
    price: number;
    discountPercent: number;
    rarity: FeaturedBundleRarity;
    refreshesAt: number;
    purchased: boolean;
};

type BundleWindow = {
    cycle: number;
    startsAt: number;
    refreshesAt: number;
};

type Bundle = Omit<FeaturedBundleDef, "durationDays"> & {
    id: string;
};

type GeneratedSlot = {
    page: number;
    size: FeaturedBundleSize;
    count: number;
};

type RotationSelection = {
    small: Bundle;
    large: Bundle;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ROTATION_ANCHOR_MS = Date.UTC(2026, 0, 1);

const PREMADE_ROTATION_MS = 7 * DAY_MS;
const GENERATED_ROTATION_MS = 6 * HOUR_MS;

const GENERATED_PAGES = [1, 2];

// A skin cannot appear in the next 3 rotations.
const ROTATION_COOLDOWN = 3;

const DISCOUNTS = [
    7, 6.7, 8, 9, 10, 11, 12, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 15, 15,
    17, 17, 19, 20, 20, 20,
] as const;

export const bundleMinPrice: Record<Rarity, number> = {
    [Rarity.Stock]: 0,
    [Rarity.Common]: 150,
    [Rarity.Uncommon]: 350,
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 750,
    [Rarity.Mythic]: 1000,
};

function isOutfit(itemType: string): boolean {
    const def = GameObjectDefs[itemType] as { type?: string } | undefined;

    return def?.type === "outfit";
}

const ALLOWED_OUTFITS: ReadonlySet<string> = new Set(
    UnlockDefs.unlock_featured_bundles.unlocks,
);

const BATTLE_PASS_OUTFITS: ReadonlySet<string> = new Set(
    Object.values(PassDefs)
        .flatMap((pass) => [...pass.items, ...(pass.premiumItems ?? [])])
        .flatMap((reward) => ("item" in reward ? [reward.item] : []))
        .filter(isOutfit),
);

function getBundleWindow(
    durationMs: number,
    now: number,
    resetAt?: number,
): BundleWindow {
    if (resetAt !== undefined && resetAt <= now && now < resetAt + durationMs) {
        return {
            cycle: Math.max(0, Math.floor((resetAt - ROTATION_ANCHOR_MS) / durationMs)),
            startsAt: resetAt,
            refreshesAt: resetAt + durationMs,
        };
    }

    const cycle = Math.max(0, Math.floor((now - ROTATION_ANCHOR_MS) / durationMs));

    const startsAt = ROTATION_ANCHOR_MS + cycle * durationMs;

    return {
        cycle,
        startsAt,
        refreshesAt: startsAt + durationMs,
    };
}

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

function shuffle<T>(items: readonly T[], random: () => number): T[] {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

export function getBundleMinPrice(itemType: string) {
    const rarity = getMarketItemRarity(itemType);

    return rarity === null ? null : bundleMinPrice[rarity];
}

export function getFeaturedBundleRarity(price: number): FeaturedBundleRarity {
    if (price < 1200) return "uncommon";
    if (price < 1600) return "rare";
    if (price < 2000) return "epic";
    if (price < 2500) return "legendary";
    if (price < 3200) return "mythic";
    if (price < 4100) return "divine";

    return "exclusive";
}

export function getFeaturedBundleSource(bundleId: string) {
    return `featured_bundle:${bundleId}`;
}

function rollDiscount(cycle: number, page: number, size: FeaturedBundleSize) {
    const sizeSeed = size === "small" ? 0x13572468 : 0x24681357;

    const random = createSeededRandom(cycle ^ Math.imul(page + 1, 0x45d9f3b) ^ sizeSeed);

    return DISCOUNTS[Math.floor(random() * DISCOUNTS.length)];
}

function buildOffer(
    bundle: Bundle,
    window: BundleWindow,
    page: number,
): FeaturedBundleOffer {
    const itemTypes = [...new Set(bundle.items)];

    for (const itemType of itemTypes) {
        if (!GameObjectDefs[itemType]) {
            throw new Error(
                `Featured bundle ${bundle.id} contains unknown item ${itemType}`,
            );
        }
    }

    const originalPrice = Math.max(1, Math.round(bundle.price));

    const discountPercent = rollDiscount(window.cycle, page, bundle.size);

    return {
        id: `${window.cycle}-${bundle.id}`,
        name: bundle.name,
        size: bundle.size,
        page,
        itemTypes,
        originalPrice,
        price: Math.max(1, Math.round(originalPrice * (1 - discountPercent / 100))),
        discountPercent,
        rarity: getFeaturedBundleRarity(originalPrice),
        refreshesAt: window.refreshesAt,
        purchased: false,
    };
}

// --------------------------------------------------
// ROTATION HISTORY
// --------------------------------------------------

// Cache deterministic rotations in memory.
// The selections can be reconstructed after restart.
const premadeHistory = new Map<number, RotationSelection>();

const generatedHistory = new Map<number, Bundle[]>();

function addItemsToSet(target: Set<string>, bundles: readonly Bundle[]): void {
    for (const bundle of bundles) {
        for (const item of bundle.items) {
            target.add(item);
        }
    }
}

function getPremadePool(size: FeaturedBundleSize): Bundle[] {
    return Object.entries(FeaturedBundleDefs)
        .filter(([, def]) => def.size === size)
        .map(([id, def]) => ({
            id,
            ...def,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function hasOverlappingItems(bundle: Bundle, excluded: ReadonlySet<string>): boolean {
    return bundle.items.some((item) => excluded.has(item));
}

function choosePremadeBundle(
    size: FeaturedBundleSize,
    cycle: number,
    excluded: ReadonlySet<string>,
    usedIds: ReadonlySet<string>,
): Bundle {
    const pool = getPremadePool(size);

    if (pool.length === 0) {
        throw new Error(`No ${size} featured bundle definitions are available`);
    }

    const random = createSeededRandom(
        cycle ^ (size === "small" ? 0x13579bdf : 0x2468ace0),
    );

    const shuffled = shuffle(pool, random);

    // First choice: no repeated skins or bundle IDs.
    const eligible = shuffled.find(
        (bundle) => !usedIds.has(bundle.id) && !hasOverlappingItems(bundle, excluded),
    );

    if (eligible) return eligible;

    // Fallback: prioritize avoiding skin overlap.
    const noOverlap = shuffled.find((bundle) => !hasOverlappingItems(bundle, excluded));

    if (noOverlap) return noOverlap;

    // Last resort: select the bundle with the
    // fewest previously featured skins.
    return [...shuffled].sort((a, b) => {
        const aRepeats = a.items.filter((item) => excluded.has(item)).length;

        const bRepeats = b.items.filter((item) => excluded.has(item)).length;

        return aRepeats - bRepeats;
    })[0];
}

function getPremadeRotation(cycle: number): RotationSelection {
    const targetCycle = Math.max(0, cycle);

    const cached = premadeHistory.get(targetCycle);

    if (cached) return cached;

    // Build all missing cycles in chronological order.
    // This makes the history independent of request order.
    for (let current = 0; current <= targetCycle; current++) {
        if (premadeHistory.has(current)) continue;

        const excluded = new Set<string>();
        const usedIds = new Set<string>();

        for (
            let previous = Math.max(0, current - ROTATION_COOLDOWN);
            previous < current;
            previous++
        ) {
            const history = premadeHistory.get(previous);

            if (!history) continue;

            addItemsToSet(excluded, [history.small, history.large]);

            usedIds.add(history.small.id);
            usedIds.add(history.large.id);
        }

        const small = choosePremadeBundle("small", current, excluded, usedIds);

        addItemsToSet(excluded, [small]);
        usedIds.add(small.id);

        const large = choosePremadeBundle("large", current, excluded, usedIds);

        premadeHistory.set(current, {
            small,
            large,
        });
    }

    return premadeHistory.get(targetCycle)!;
}

function getGeneratedOutfitPool(excluded: ReadonlySet<string>): string[] {
    return [...ALLOWED_OUTFITS]
        .filter(
            (itemType) =>
                isOutfit(itemType) &&
                getMarketItemRarity(itemType) !== null &&
                !BATTLE_PASS_OUTFITS.has(itemType) &&
                !excluded.has(itemType),
        )
        .sort();
}

function createGeneratedBundle({ page, size }: GeneratedSlot, items: string[]): Bundle {
    const price = items.reduce(
        (total, itemType) => total + (getBundleMinPrice(itemType) ?? 0),
        0,
    );

    return {
        id: `generated-page-${page + 1}-${size}`,
        name: size === "small" ? "Random Mini" : "Random Large",
        size,
        items,
        price: Math.max(1, price),
    };
}

function getPremadeCycleAt(timestamp: number): number {
    return getBundleWindow(PREMADE_ROTATION_MS, timestamp).cycle;
}

function getPremadeExclusions(generatedCycle: number): Set<string> {
    const excluded = new Set<string>();

    const timestamp = ROTATION_ANCHOR_MS + generatedCycle * GENERATED_ROTATION_MS;

    const premadeCycle = getPremadeCycleAt(timestamp);

    // Exclude current Page 1 skins and those from
    // the previous 3 weekly Page 1 rotations.
    for (
        let cycle = Math.max(0, premadeCycle - ROTATION_COOLDOWN);
        cycle <= premadeCycle;
        cycle++
    ) {
        const rotation = getPremadeRotation(cycle);

        addItemsToSet(excluded, [rotation.small, rotation.large]);
    }

    return excluded;
}

function getGeneratedRotation(cycle: number): Bundle[] {
    const targetCycle = Math.max(0, cycle);

    const cached = generatedHistory.get(targetCycle);

    if (cached) return cached;

    for (let current = 0; current <= targetCycle; current++) {
        if (generatedHistory.has(current)) continue;

        const random = createSeededRandom(current ^ 0x5f3759df);

        const excluded = getPremadeExclusions(current);

        // Exclude all outfits shown in the
        // previous 3 generated rotations.
        for (
            let previous = Math.max(0, current - ROTATION_COOLDOWN);
            previous < current;
            previous++
        ) {
            const previousBundles = generatedHistory.get(previous);

            if (previousBundles) {
                addItemsToSet(excluded, previousBundles);
            }
        }

        const slots = GENERATED_PAGES.flatMap((page): GeneratedSlot[] => [
            {
                page,
                size: "small",
                count: 2,
            },
            {
                page,
                size: "large",
                count: 3 + Math.floor(random() * 2),
            },
        ]);

        const needed = slots.reduce((total, slot) => total + slot.count, 0);

        // Preferred pool: respects every cooldown.
        const preferredPool = shuffle(getGeneratedOutfitPool(excluded), random);

        const selected = [...preferredPool];

        if (selected.length < needed) {
            // If the pool is too small, reintroduce
            // older skins first, never duplicate
            // skins within the current rotation.
            const allEligible = getGeneratedOutfitPool(getPremadeExclusions(current));

            const lastSeen = new Map<string, number>();

            for (
                let previous = Math.max(0, current - ROTATION_COOLDOWN);
                previous < current;
                previous++
            ) {
                const bundles = generatedHistory.get(previous) ?? [];

                for (const bundle of bundles) {
                    for (const item of bundle.items) {
                        lastSeen.set(item, previous);
                    }
                }
            }

            const selectedSet = new Set(selected);

            const fallbackPool = shuffle(
                allEligible.filter((item) => !selectedSet.has(item)),
                random,
            ).sort((a, b) => {
                const aSeen = lastSeen.get(a) ?? -Infinity;
                const bSeen = lastSeen.get(b) ?? -Infinity;

                return aSeen - bSeen;
            });

            for (const item of fallbackPool) {
                if (selected.length >= needed) break;

                selected.push(item);
            }
        }

        if (selected.length < needed) {
            throw new Error(
                `Not enough eligible outfits for generated featured bundles. Need ${needed}, found ${selected.length}.`,
            );
        }

        let poolIndex = 0;

        const bundles = slots.map((slot) => {
            const items = selected.slice(poolIndex, poolIndex + slot.count);

            poolIndex += slot.count;

            return createGeneratedBundle(slot, items);
        });

        generatedHistory.set(current, bundles);
    }

    return generatedHistory.get(targetCycle)!;
}

export function getFeaturedBundleOffers(now = Date.now(), resetAt?: number) {
    const premadeWindow = getBundleWindow(PREMADE_ROTATION_MS, now, resetAt);

    const premadeRotation = getPremadeRotation(premadeWindow.cycle);

    const generatedWindow = getBundleWindow(GENERATED_ROTATION_MS, now);

    const generatedBundles = getGeneratedRotation(generatedWindow.cycle);

    const generatedOffers = generatedBundles.map((bundle, index) => {
        const page = GENERATED_PAGES[Math.floor(index / 2)];

        return buildOffer(bundle, generatedWindow, page);
    });

    return {
        window: premadeWindow,
        offers: [
            buildOffer(premadeRotation.small, premadeWindow, 0),
            buildOffer(premadeRotation.large, premadeWindow, 0),
            ...generatedOffers,
        ],
    };
}
