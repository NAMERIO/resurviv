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
        price: 900,
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
    bundle_dragon: {
        name: "Dragon Set",
        size: "small",
        items: ["outfitDragonTails", "bloodmoon_huntsman"],
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
    bundle_prince: {
        name: "Prince Set",
        size: "small",
        items: ["outfitLustrousPaladin", "gilded_bayonet"],
        price: 1250,
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
    bundle_dinner: {
        name: "Dinner Set",
        size: "large",
        items: ["outfitEggnite", "outfitAvocadoh", "outfitBrontoChop"],
        price: 2450,
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
    bundle_void: {
        name: "Vast Void Set",
        size: "large",
        items: ["outfitEventHorizon", "fist_blackholes", "death_black_hole"],
        price: 1800,
        durationDays: 7,
    },
    bundle_lightning: {
        name: "Lightning Set",
        size: "large",
        items: ["outfitCosmicBlue", "fist_milestones", "emote_radical_ray"],
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
    bundle_turtle: {
        name: "Turtle  Set",
        size: "small",
        items: ["outfitDigiturt", "fist_firstTool"],
        price: 1000,
        durationDays: 7,
    },
    bundle_gridflag: {
        name: "Grid Flag  Set",
        size: "small",
        items: ["outfitGridflag", "fist_qFist"],
        price: 750,
        durationDays: 7,
    },
    bundle_camo: {
        name: "Camo Set",
        size: "large",
        items: ["outfitMilitary", "karambit_camo", "mosin_camo"],
        price: 1800,
        durationDays: 7,
    },
    bundle_pastel: {
        name: "Pastel Set",
        size: "large",
        items: ["outfitMellow", "outfitBlush", "outfitSortaBlue"],
        price: 1100,
        durationDays: 7,
    },
    bundle_floral: {
        name: "Floral Set",
        size: "small",
        items: ["outfitCrimsonHibiscus", "fist_rafflesia"],
        price: 950,
        durationDays: 7,
    },
    bundle_donut: {
        name: "Donut Set",
        size: "small",
        items: ["outfitDonut", "fist_fritterPunch"],
        price: 950,
        durationDays: 7,
    },
    bundle_bullseye: {
        name: "Bullseye Set",
        size: "small",
        items: ["outfitItJustMist", "fist_tawget"],
        price: 700,
        durationDays: 7,
    },
    bundle_farmer: {
        name: "Farmers Set",
        size: "small",
        items: ["outfitHoldinHide", "farmers_sickle"],
        price: 700,
        durationDays: 7,
    },
};

export const FeaturedBundlePages = [
    {
        small: "bundle_neondisk",
        large: "bundle_void",
    },
    {
        small: "bundle_dragon",
        large: "bundle_dinner",
    },
    {
        small: "bundle_gridflag",
        large: "bundle_lightning",
    },
] as const satisfies ReadonlyArray<
    Record<FeaturedBundleSize, keyof typeof FeaturedBundleDefs>
>;
