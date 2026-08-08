export type FeaturedBundleSize = "small" | "large";

export interface FeaturedBundleDef {
    /** Player-facing bundle name shown on its card. */
    name: string;
    size: FeaturedBundleSize;
    /** The exact cosmetics sold together in this bundle. */
    items: string[];
    /** Total bundle price in GP. */
    price: number;
    /** Days before this bundle starts a new purchase cycle. */
    durationDays: number;
}

export const FeaturedBundleDefs: Record<string, FeaturedBundleDef> = {
    bundle_galaxy: {
        name: "Living Galaxy Set",
        size: "small",
        items: ["outfitLivingGalaxy", "fist_living_galaxy"],
        price: 5000,
        durationDays: 3,
    },
    bundle_snowman: {
        name: "Snowman Set",
        size: "large",
        items: ["outfitSnowman", "fist_frostpunch", "emote_snowman", "emote_snowflake"],
        price: 2500,
        durationDays: 3,
    },
     bundle_vitaminD: {
        name: "Vitamin D Set",
        size: "small",
        items: ["outfitVitaminD", "fist_flamingNucleus"],
        price: 1250,
        durationDays: 3,
    },
};

export const FeaturedBundleSlots = {
    small: "bundle_galaxy",
    large: "bundle_snowman",
} as const satisfies Record<FeaturedBundleSize, keyof typeof FeaturedBundleDefs>;
