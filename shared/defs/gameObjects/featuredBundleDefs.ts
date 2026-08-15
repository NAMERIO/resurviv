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
        durationDays: 7,
    },
    bundle_snowman: {
        name: "Snowman Set",
        size: "large",
        items: ["outfitSnowman", "fist_frostpunch", "fist_lolitaPop"],
        price: 2000,
        durationDays: 7,
    },
    bundle_vitaminD: {
        name: "Vitamin D Set",
        size: "small",
        items: ["outfitVitaminD", "fist_flamingNucleus"],
        price: 850,
        durationDays: 7,
    },
    bundle_dino: {
        name: "Dino Set",
        size: "small",
        items: ["outfitGreenTeaRex", "fist_dinoclaws"],
        price: 1500,
        durationDays: 7,
    },
    bundle_neondisk: {
        name: "Neon Disk Set",
        size: "small",
        items: ["outfitLasrDisk", "fist_scifi"],
        price: 1850,
        durationDays: 7,
    },
    bundle_checkmate: {
        name: "Checkmate Set",
        size: "small",
        items: ["outfitCheckmate", "fist_checkmate"],
        price: 1350,
        durationDays: 7,
    },
    bundle_yinyang: {
        name: "Yin-Yang Set",
        size: "small",
        items: ["outfitYinYang", "fist_checkmate"],
        price: 1350,
        durationDays: 7,
    },
    bundle_wolf: {
        name: "Wolf Set",
        size: "small",
        items: ["outfitWolf", "fist_paws"],
        price: 1350,
        durationDays: 7,
    },
    bundle_grunge: {
        name: "Grunge Set",
        size: "small",
        items: ["outfitRiotPlaid", "karambit_rugged"],
        price: 1550,
        durationDays: 7,
    },
    bundle_sirloin: {
        name: "Sir Loin Set",
        size: "small",
        items: ["outfitSirLoin", "fist_cattleBattle"],
        price: 1225,
        durationDays: 7,
    },
    bundle_juleverny: {
        name: "Jule Verny Set",
        size: "small",
        items: ["outfitJuleVerny", "fist_golden_lobster"],
        price: 1625,
        durationDays: 7,
    },
    bundle_pixel: {
        name: "Pixel Attack Set",
        size: "large",
        items: ["outfitMaxAttack", "outfitBitplosion", "fist_squareyCerry"],
        price: 2850,
        durationDays: 7,
    },
    bundle_bugcat: {
        name: "Bugcat Set",
        size: "large",
        items: ["outfitBugcat", "fist_paws", "emote_happyghost"],
        price: 2250,
        durationDays: 7,
    },
    bundle_ninja: {
        name: "Ninja Set",
        size: "large",
        items: [
            "outfitVillageNinja",
            "fist_dreidel",
            "fist_getdowntonite",
            "huntsman_blackwater",
        ],
        price: 3250,
        durationDays: 7,
    },
    bundle_love: {
        name: "Love Set",
        size: "small",
        items: ["outfitILavaYou", "fist_rafflesia"],
        price: 1750,
        durationDays: 7,
    },
    bundle_flame: {
        name: "Flame Enthuasist Set",
        size: "large",
        items: ["outfitToxicFire", "outfitGhoulFire", "emote_buuurn"],
        price: 3000,
        durationDays: 7,
    },
};

export const FeaturedBundlePages = [
    {
        small: "bundle_vitaminD",
        large: "bundle_bugcat",
    },
    {
        small: "bundle_checkmate",
        large: "bundle_flame",
    },
    {
        small: "bundle_dino",
        large: "bundle_pixel",
    },
] as const satisfies ReadonlyArray<
    Record<FeaturedBundleSize, keyof typeof FeaturedBundleDefs>
>;
