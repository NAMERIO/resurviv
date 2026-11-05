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

type Bundle = Omit<FeaturedBundleDef, "durationDays"> & { id: string };

type GeneratedSlot = {
    page: number;
    size: FeaturedBundleSize;
    count: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ROTATION_ANCHOR_MS = Date.UTC(2026, 0, 1);

const PREMADE_ROTATION_MS = 7 * DAY_MS;
const GENERATED_ROTATION_MS = 6 * HOUR_MS;
const GENERATED_PAGES = [1, 2];

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

function isOutfit(itemType: string) {
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
    return { cycle, startsAt, refreshesAt: startsAt + durationMs };
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

function shuffle<T>(items: readonly T[], random: () => number) {
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

function selectPremadeBundle(size: FeaturedBundleSize, cycle: number): Bundle {
    const pool = Object.entries(FeaturedBundleDefs)
        .filter(([, def]) => def.size === size)
        .map(([id, def]) => ({ id, ...def }))
        .sort((a, b) => a.id.localeCompare(b.id));

    if (pool.length === 0) {
        throw new Error(`No ${size} featured bundle definitions are available`);
    }

    const random = createSeededRandom(
        cycle ^ (size === "small" ? 0x13579bdf : 0x2468ace0),
    );
    return pool[Math.floor(random() * pool.length)];
}

function getGeneratedOutfitPool(excluded: ReadonlySet<string>) {
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
    const price = items.reduce((total, itemType) => {
        return total + (getBundleMinPrice(itemType) ?? 0);
    }, 0);

    return {
        id: `generated-page-${page + 1}-${size}`,
        name: size === "small" ? "Random Mini" : "Random Large",
        size,
        items,
        price: Math.max(1, price),
    };
}

export function getFeaturedBundleOffers(now = Date.now(), resetAt?: number) {
    const premadeWindow = getBundleWindow(PREMADE_ROTATION_MS, now, resetAt);
    const premadeSmall = selectPremadeBundle("small", premadeWindow.cycle);
    const premadeLarge = selectPremadeBundle("large", premadeWindow.cycle);

    const generatedWindow = getBundleWindow(GENERATED_ROTATION_MS, now);
    const random = createSeededRandom(generatedWindow.cycle ^ 0x5f3759df);

    const pool = shuffle(
        getGeneratedOutfitPool(new Set([...premadeSmall.items, ...premadeLarge.items])),
        random,
    );

    const slots = GENERATED_PAGES.flatMap((page): GeneratedSlot[] => [
        { page, size: "small", count: 2 },
        { page, size: "large", count: 3 + Math.floor(random() * 2) },
    ]);

    const needed = slots.reduce((total, slot) => total + slot.count, 0);
    if (pool.length < needed) {
        throw new Error(
            `Not enough eligible outfits for generated featured bundles. Need ${needed}, found ${pool.length}.`,
        );
    }

    let poolIndex = 0;
    const generatedOffers = slots.map((slot) => {
        const items = pool.slice(poolIndex, poolIndex + slot.count);
        poolIndex += slot.count;
        return buildOffer(createGeneratedBundle(slot, items), generatedWindow, slot.page);
    });

    return {
        window: premadeWindow,
        offers: [
            buildOffer(premadeSmall, premadeWindow, 0),
            buildOffer(premadeLarge, premadeWindow, 0),
            ...generatedOffers,
        ],
    };
}
