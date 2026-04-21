import { GameObjectDefs } from "../defs/gameObjectDefs";
import { Rarity } from "../gameConfig";

const supportedMarketTypes = new Set([
    "outfit",
    "melee",
    "emote",
    "heal_effect",
    "boost_effect",
    "death_effect",
]);

export const marketMinPriceByRarity: Record<Rarity, number> = {
    [Rarity.Stock]: 1,
    [Rarity.Common]: 1,
    [Rarity.Uncommon]: 1,
    [Rarity.Rare]: 1,
    [Rarity.Epic]: 1,
    [Rarity.Mythic]: 1,
};

export const marketMaxSellPrice = 10000;
export const auctionStartPriceCapPercent = 0.6;

export const marketReferenceValueByRarity: Record<Rarity, number> = {
    [Rarity.Stock]: 0,
    [Rarity.Common]: 100,
    [Rarity.Uncommon]: 250,
    [Rarity.Rare]: 500,
    [Rarity.Epic]: 1200,
    [Rarity.Mythic]: 2500,
};

export function getMarketItemRarity(itemType: string) {
    const def = GameObjectDefs[itemType] as
        | { type?: string; rarity?: Rarity }
        | undefined;
    if (!def || !def.type || !supportedMarketTypes.has(def.type)) return null;
    const rarity = def.rarity ?? Rarity.Stock;
    if (rarity < Rarity.Common) return null;
    return rarity;
}

export function getMarketPriceBounds(itemType: string) {
    const rarity = getMarketItemRarity(itemType);
    if (rarity === null) return null;

    return {
        rarity,
        min: marketMinPriceByRarity[rarity],
        max: marketMaxSellPrice,
    };
}

export function getMarketReferencePrice(itemType: string) {
    const rarity = getMarketItemRarity(itemType);
    if (rarity === null) return null;
    return marketReferenceValueByRarity[rarity];
}

export function getAuctionPriceBounds(itemType: string) {
    const rarity = getMarketItemRarity(itemType);
    if (rarity === null) return null;

    const referenceValue = marketReferenceValueByRarity[rarity];
    const max = Math.max(1, Math.floor(referenceValue * auctionStartPriceCapPercent));

    return {
        rarity,
        min: 1,
        max,
        referenceValue,
    };
}

export function getSuggestedMarketSellPrice(itemType: string) {
    const bounds = getMarketPriceBounds(itemType);
    if (!bounds) return null;
    return bounds.min;
}

export function isValidMarketSellPrice(itemType: string, price: number) {
    const bounds = getMarketPriceBounds(itemType);
    if (!bounds || !Number.isInteger(price)) return false;
    return price >= bounds.min && price <= bounds.max;
}

export function isValidAuctionStartPrice(itemType: string, price: number) {
    const bounds = getAuctionPriceBounds(itemType);
    if (!bounds || !Number.isInteger(price)) return false;
    return price >= bounds.min && price <= bounds.max;
}
