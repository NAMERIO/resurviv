import { GameObjectDefs } from "../defs/gameObjectDefs";
import { PassDefs } from "../defs/gameObjects/passDefs";
import { UnlockDefs } from "../defs/gameObjects/unlockDefs";
import { Rarity } from "../gameConfig";
import { getMarketItemRarity, getMarketPriceBounds } from "./marketPricing";

export type FeaturedBundleSize = "small" | "large";

export type FeaturedBundleOffer = {
    id: string;
    size: FeaturedBundleSize;
    itemTypes: string[];
    price: number;
    basePrice: number;
    discountPercent: number;
    refreshesAt: number;
    purchased: boolean;
};

const FEATURED_BUNDLE_ANCHOR_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
const HOUR_MS = 60 * 60 * 1000;
const FEATURED_BUNDLE_CONFIG: Record<
    FeaturedBundleSize,
    { minItems: number; maxItems: number }
> = {
    small: {
        minItems: 2,
        maxItems: 3,
    },
    large: {
        minItems: 4,
        maxItems: 6,
    },
};

export const bundleMinPrice: Record<Rarity, number> = {
    [Rarity.Stock]: 100,
    [Rarity.Common]: 100,
    [Rarity.Uncommon]: 100,
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 500,
    [Rarity.Mythic]: 1500,
};

type BundleWindow = {
    cycle: number;
    startsAt: number;
    refreshesAt: number;
};

type BundleSeed = {
    current: number;
};

const passRewardItems = new Set(
    Object.values(PassDefs).flatMap((pass) =>
        pass.items.flatMap((reward) => ("item" in reward ? [reward.item] : [])),
    ),
);
const defaultUnlockItems = new Set(UnlockDefs.unlock_default.unlocks);
const featuredBundleUnlockItems = new Set(UnlockDefs.unlock_featured_bundles.unlocks);

function nextSeed(seed: number) {
    return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function hashSeed(...values: number[]) {
    let seed = 0x9e3779b9;
    for (const value of values) {
        seed ^= value >>> 0;
        seed = Math.imul(seed, 1664525) + 1013904223;
        seed >>>= 0;
    }
    return seed >>> 0;
}

function randomInt(seed: BundleSeed, maxExclusive: number) {
    if (maxExclusive <= 0) return 0;
    seed.current = nextSeed(seed.current);
    return seed.current % maxExclusive;
}

function makeSeed(...values: number[]): BundleSeed {
    return {
        current: hashSeed(...values),
    };
}

function getBundleWindow(now = Date.now()): BundleWindow {
    let cycle = 0;
    let startsAt = FEATURED_BUNDLE_ANCHOR_MS;

    while (true) {
        const durationHours = 2 + (hashSeed(0x51f15e, cycle) % 10);
        const refreshesAt = startsAt + durationHours * HOUR_MS;
        if (now < refreshesAt) {
            return { cycle, startsAt, refreshesAt };
        }
        startsAt = refreshesAt;
        cycle++;
    }
}

function getEligibleBundleItems() {
    return [...featuredBundleUnlockItems]
        .filter((itemType) => {
            const itemDef = GameObjectDefs[itemType] as
                | { type?: string; rarity?: Rarity }
                | undefined;
            if (!itemDef?.type) return false;
            if (defaultUnlockItems.has(itemType)) return false;
            if (passRewardItems.has(itemType)) return false;
            if (getMarketPriceBounds(itemType) === null) return false;
            return true;
        })
        .sort();
}

function getBundleBasePrice(itemType: string) {
    const rarity = getMarketItemRarity(itemType);
    if (rarity === null) return null;
    return bundleMinPrice[rarity];
}

export function getBundleMinPrice(itemType: string) {
    return getBundleBasePrice(itemType);
}

function buildBundleOffer(
    size: FeaturedBundleSize,
    window: BundleWindow,
    pool: string[],
    usedItems: Set<string>,
): FeaturedBundleOffer {
    const config = FEATURED_BUNDLE_CONFIG[size];
    const seed = makeSeed(0xb00d1e, window.cycle, size === "small" ? 1 : 2);
    const shuffled = [...pool];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(seed, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    const desiredCount =
        config.minItems + randomInt(seed, config.maxItems - config.minItems + 1);
    const itemTypes: string[] = [];

    for (const itemType of shuffled) {
        if (usedItems.has(itemType)) continue;
        itemTypes.push(itemType);
        usedItems.add(itemType);
        if (itemTypes.length >= desiredCount) break;
    }

    if (itemTypes.length < config.minItems) {
        for (const itemType of shuffled) {
            if (itemTypes.includes(itemType)) continue;
            itemTypes.push(itemType);
            if (itemTypes.length >= config.minItems) break;
        }
    }

    const basePrice = itemTypes.reduce(
        (total, itemType) => total + (getBundleBasePrice(itemType) ?? 0),
        0,
    );
    const discountPercent = 5 + randomInt(seed, 21);
    const discountedPrice = Math.max(
        1,
        Math.round(basePrice * ((100 - discountPercent) / 100)),
    );

    return {
        id: `${window.cycle}-${size}`,
        size,
        itemTypes,
        price: discountedPrice,
        basePrice,
        discountPercent,
        refreshesAt: window.refreshesAt,
        purchased: false,
    };
}

export function getFeaturedBundleSource(bundleId: string) {
    return `featured_bundle:${bundleId}`;
}

export function getFeaturedBundleOffers(now = Date.now()) {
    const window = getBundleWindow(now);
    const pool = getEligibleBundleItems();
    const usedItems = new Set<string>();

    return {
        window,
        offers: [
            buildBundleOffer("small", window, pool, usedItems),
            buildBundleOffer("large", window, pool, usedItems),
        ],
    };
}
