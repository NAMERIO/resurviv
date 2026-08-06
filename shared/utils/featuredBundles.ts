import { GameObjectDefs } from "../defs/gameObjectDefs";
import {
    type FeaturedBundleDef,
    FeaturedBundleDefs,
    type FeaturedBundleSize,
    FeaturedBundleSlots,
} from "../defs/gameObjects/featuredBundleDefs";
import type { MeleeDef } from "../defs/gameObjects/meleeDefs";
import type { OutfitDef } from "../defs/gameObjects/outfitDefs";
import { Rarity } from "../gameConfig";
import { getMarketItemRarity } from "./marketPricing";

export type { FeaturedBundleSize } from "../defs/gameObjects/featuredBundleDefs";

export type FeaturedBundleOffer = {
    id: string;
    name: string;
    size: FeaturedBundleSize;
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
): FeaturedBundleOffer {
    const itemTypes = [...new Set(definition.items)];
    for (const itemType of itemTypes) {
        const itemDef = GameObjectDefs[itemType];
        if (!itemDef) {
            throw new Error(
                `Featured bundle ${definition.id} contains unknown item ${itemType}`,
            );
        }
        if (itemDef.type === "melee" && !(itemDef as MeleeDef).handSprites) {
            throw new Error(
                `Featured bundle ${definition.id} contains gameplay melee ${itemType}; only hand skins are allowed`,
            );
        }
        if (itemDef.type === "outfit" && (itemDef as OutfitDef).obstacleType) {
            throw new Error(
                `Featured bundle ${definition.id} contains object-disguise outfit ${itemType}`,
            );
        }
    }

    const price = Math.max(1, Math.round(definition.price));

    return {
        id: `${window.cycle}-${definition.id}`,
        name: definition.name,
        size: definition.size,
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
    const getSelectedDefinition = (size: FeaturedBundleSize) => {
        const id = FeaturedBundleSlots[size];
        const definition = FeaturedBundleDefs[id];
        if (!definition) {
            throw new Error(`Featured ${size} slot references unknown bundle ${id}`);
        }
        return { id, ...definition, size };
    };

    const smallDefinition = getSelectedDefinition("small");
    const largeDefinition = getSelectedDefinition("large");
    const smallWindow = getBundleWindow(smallDefinition.durationDays, now);
    const largeWindow = getBundleWindow(largeDefinition.durationDays, now);
    return {
        window: {
            cycle: 0,
            startsAt: Math.min(smallWindow.startsAt, largeWindow.startsAt),
            refreshesAt: Math.min(smallWindow.refreshesAt, largeWindow.refreshesAt),
        },
        offers: [
            buildBundleOffer(smallDefinition, smallWindow),
            buildBundleOffer(largeDefinition, largeWindow),
        ],
    };
}
