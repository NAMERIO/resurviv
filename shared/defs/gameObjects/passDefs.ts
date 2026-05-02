export interface PassDef {
    readonly type: "pass";
    xp: number[];
    items: PassRewardDef[];
    premiumItems?: PassRewardDef[];
    premiumPrice?: number;
}

export type PassRewardDef =
    | {
          level: number;
          item: string;
          gp?: number;
      }
    | {
          level: number;
          gp: number;
      };

export const CurrentPassType = "pass_survivr2";

export const PassDefs: Record<string, PassDef> = {
    pass_survivr1: {
        type: "pass",
        xp: [
            50, 50, 50, 50, 50, 50, 50, 50, 75, 75, 75, 75, 75, 75, 100, 100, 100, 125,
            125, 150, 75, 75, 75,
        ],
        items: [
            {
                level: 2,
                item: "outfitThePro",
            },
            {
                level: 3,
                item: "fist_shinyJello",
            },
            {
                level: 4,
                item: "emote_bandagedface",
            },
            {
                level: 5,
                item: "outfitToxicBarrel",
            },
            {
                level: 6,
                item: "emote_nooblet",
            },
            {
                level: 7,
                item: "outfitTirelessly",
            },
            {
                level: 8,
                item: "emote_rainbow",
            },
            {
                level: 9,
                item: "outfitSplotchfest",
            },
            {
                level: 10,
                item: "emote_pooface",
            },
            {
                level: 11,
                item: "knuckles_rusted",
            },
            {
                level: 12,
                item: "outfitToontooine",
            },
            {
                level: 13,
                item: "emote_ghost_base",
            },
            {
                level: 14,
                item: "outfitJuleVerny",
            },
            {
                level: 15,
                item: "fist_theOtherPong",
            },
            {
                level: 16,
                item: "karambit_rugged",
            },
            {
                level: 17,
                item: "outfitKingGalaxy",
            },
            {
                level: 18,
                item: "emote_rip",
            },
            {
                level: 19,
                item: "emote_rainbow",
            },
            {
                level: 20,
                item: "outfitMagmatic",
            },
            {
                level: 21,
                item: "knuckles_heroic",
            },
            {
                level: 30,
                item: "outfitFireball",
            },
            {
                level: 50,
                item: "bayonet_rugged",
            },
            {
                level: 95,
                item: "bayonet_woodland",
            },
            {
                level: 99,
                gp: 1500,
            },
        ],
        premiumPrice: 1500,
        premiumItems: [
            {
                level: 2,
                item: "fist_golden_lobster",
            },
            {
                level: 10,
                item: "emote_golden_bullet",
            },
            {
                level: 20,
                item: "fist_goldDrops",
            },
        ],
    },
    pass_survivr2: {
        type: "pass",
        premiumPrice: 1,
        xp: [
            50, 50, 50, 50, 50, 50, 50, 50, 75, 75, 75, 75, 75, 75, 100, 100, 100, 125,
            125, 150, 75, 75, 75,
        ],
        items: [
            {
                level: 2,
                item: "outfitSunriseBlvd",
            },
            {
                level: 3,
                item: "fist_pixelDots",
            },
            {
                level: 4,
                item: "emote_picassoface",
            },
            {
                level: 5,
                gp: 25,
            },
            {
                level: 6,
                item: "outfitRetroSunset",
            },
            {
                level: 7,
                item: "emote_gogo",
            },
            {
                level: 8,
                item: "fist_rafflesia",
            },
            {
                level: 9,
                item: "outfitColorPalette",
            },
            {
                level: 10,
                gp: 50,
            },
            {
                level: 11,
                item: "emote_starstruck",
            },
            {
                level: 12,
                item: "outfitStreetArt",
            },
            {
                level: 13,
                item: "fist_retrhorizon",
            },
            {
                level: 14,
                item: "emote_rad",
            },
            {
                level: 15,
                gp: 50,
            },
            {
                level: 16,
                item: "outfitBlueZone",
            },
            {
                level: 17,
                item: "fist_meteorNite",
            },
            {
                level: 18,
                item: "emote_logometeor",
            },
            {
                level: 19,
                item: "outfitStarryNight",
            },
            {
                level: 20,
                gp: 75,
            },
            {
                level: 21,
                item: "karambit_prismatic",
            },
            {
                level: 30,
                item: "outfitEventHorizon",
            },
            {
                level: 50,
                gp: 200,
            },
            {
                level: 95,
                item: "fist_ghostPoke",
            },
            {
                level: 99,
                item: "outfitHotMagma",
            },
        ],
        premiumItems: [
            {
                level: 2,
                item: "emote_rainy_day",
            },
            {
                level: 3,
                gp: 100,
            },
            {
                level: 5,
                item: "outfitGaudisque",
            },
            {
                level: 6,
                gp: 120,
            },
            {
                level: 7,
                item: "outfitAstronaut",
            },
            {
                level: 9,
                item: "outfitILavaYou",
            },
            {
                level: 10,
                gp: 130,
            },
            {
                level: 12,
                item: "emote_buuurn",
            },
            {
                level: 14,
                item: "huntsman_blackwater",
            },
            {
                level: 15,
                gp: 140,
            },
            {
                level: 17,
                item: "fist_frostpunch",
            },
            {
                level: 20,
                item: "outfitDiamondy",
                gp: 100,
            },
            {
                level: 50,
                gp: 150,
            },
            {
                level: 99,
                item: "outfitBlueMecha",
                gp: 300,
            },
        ],
    },
};
