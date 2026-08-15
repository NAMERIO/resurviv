import { GameObjectDefs } from "../defs/gameObjectDefs";
import {
    type FeaturedBundleDef,
    FeaturedBundleDefs,
    FeaturedBundlePages,
    type FeaturedBundleSize,
} from "../defs/gameObjects/featuredBundleDefs";
import { Rarity } from "../gameConfig";
import { getMarketItemRarity } from "./marketPricing";

export type { FeaturedBundleSize } from "../defs/gameObjects/featuredBundleDefs";

export type FeaturedBundleOffer = {
    id: string;
    name: string;
    size: FeaturedBundleSize;
    page: number;
    itemTypes: string[];
    price: number;
    refreshesAt: number;
    purchased: boolean;
};

const FEATURED_BUNDLE_ANCHOR_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;
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

function getBundleWindow(durationDays: number, now = Date.now()): BundleWindow {
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
        throw new Error("Featured bundle durationDays must be greater than zero");
    }
    const durationMs = durationDays * DAY_MS;
    const cycle = Math.max(0, Math.floor((now - FEATURED_BUNDLE_ANCHOR_MS) / durationMs));
    const startsAt = FEATURED_BUNDLE_ANCHOR_MS + cycle * durationMs;
    return { cycle, startsAt, refreshesAt: startsAt + durationMs };
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
    definition: FeaturedBundleDef & { id: string },
    window: BundleWindow,
    page: number,
): FeaturedBundleOffer {
    const itemTypes = [...new Set(definition.items)];
    for (const itemType of itemTypes) {
        const itemDef = GameObjectDefs[itemType];
        if (!itemDef) {
            throw new Error(
                `Featured bundle ${definition.id} contains unknown item ${itemType}`,
            );
        }
    }

    const price = Math.max(1, Math.round(definition.price));

    return {
        id: `${window.cycle}-${definition.id}`,
        name: definition.name,
        size: definition.size,
        page,
        itemTypes,
        price,
        refreshesAt: window.refreshesAt,
        purchased: false,
    };
}

export function getFeaturedBundleSource(bundleId: string) {
    return `featured_bundle:${bundleId}`;
}

export function getFeaturedBundleOffers(now = Date.now()) {
    const getSelectedDefinition = (page: number, size: FeaturedBundleSize) => {
        const id = FeaturedBundlePages[page][size];
        const definition = FeaturedBundleDefs[id];
        if (!definition) {
            throw new Error(
                `Featured page ${page + 1} ${size} slot references unknown bundle ${id}`,
            );
        }
        return { id, ...definition, size };
    };

    const offersWithWindows = FeaturedBundlePages.flatMap((_, page) =>
        (["small", "large"] as const).map((size) => {
            const definition = getSelectedDefinition(page, size);
            const window = getBundleWindow(definition.durationDays, now);
            return {
                offer: buildBundleOffer(definition, window, page),
                window,
            };
        }),
    );

    return {
        window: {
            cycle: 0,
            startsAt: Math.min(...offersWithWindows.map(({ window }) => window.startsAt)),
            refreshesAt: Math.min(
                ...offersWithWindows.map(({ window }) => window.refreshesAt),
            ),
        },
        offers: offersWithWindows.map(({ offer }) => offer),
    };
}
