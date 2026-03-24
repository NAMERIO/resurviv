export interface PassDef {
    readonly type: "pass";
    xp: number[];
    items: PassRewardDef[];
}

export type PassRewardDef =
    | {
          level: number;
          item: string;
      }
    | {
          level: number;
          gp: number;
      };

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
    },
};
