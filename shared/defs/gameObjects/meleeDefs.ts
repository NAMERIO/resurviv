import { Rarity } from "../../gameConfig";
import { type DeepPartial, util } from "../../utils/util";
import type { Vec2 } from "../../utils/v2";

export interface MeleeDef {
    readonly type: "melee";
    name: string;
    perk?: string;
    quality: number;
    autoAttack: boolean;
    switchDelay: number;
    damage: number;
    obstacleDamage: number;
    cleave?: boolean;
    attack: {
        offset: Vec2;
        rad: number;
        damageTimes: number[];
        cooldownTime: number;
    };
    speed: {
        equip: number;
        attack?: number;
    };
    anim: {
        idlePose: string;
        attackAnims: string[];
        poseAnims?: string[];
        deploy?: string;
    };
    sound: Record<string, string>;
    //  {
    //     swing: string
    //     deploy: string
    //     playerHit: string
    //     playerHit2?: string
    //     pickup?: string
    //     bullet?: string
    // }
    lootImg: {
        sprite: string;
        scale: number;
        rad?: number;
        tint: number;
        border?: string;
        borderTint?: number;
        rot?: number;
        mirror?: boolean;
    };
    baseType?: string;
    rarity?: number;
    lore?: string;
    noPotatoSwap?: boolean;
    noDropOnDeath?: boolean;
    worldImg?: Img;
    hipImg?: Img;
    reflectSurface?: {
        equipped: {
            p0: Vec2;
            p1: Vec2;
        };
        unequipped: {
            p0: Vec2;
            p1: Vec2;
        };
    };
    armorPiercing?: boolean;
    stonePiercing?: boolean;
    reflectArea?: {
        offset: Vec2;
        rad: number;
    };
    handSprites?: {
        spriteL: string;
        spriteR: string;
    };
    scale?: {
        x: number;
        y: number;
    };
    /** Fill the equipped melee silhouette with the shared moving galaxy material. */
    galaxyEffect?: boolean;
}

export interface Img {
    sprite: string;
    pos: Vec2;
    deployPos?: Vec2;
    rot: number;
    scale: Vec2;
    tint: number;
    leftHandOntop?: boolean;
    renderOnHand?: boolean;
}

function defineMeleeSkin(baseType: string, params: DeepPartial<MeleeDef>): MeleeDef {
    return util.mergeDeep({}, BaseDefs[baseType], params);
}

const BaseDefs: Record<string, MeleeDef> = {
    fists: {
        name: "Fists",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["fists"],
        },
        sound: {
            swing: "punch_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "punch_hit_01",
        },
        lootImg: {
            sprite: "loot-weapon-fists.img",
            scale: 0.3,
            rad: 25,
            tint: 0xff00,
        },
    },
    knuckles: {
        name: "Knuckles",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
            attack: 0,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["fists", "fists"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "punch_swing_01",
            deploy: "knuckles_deploy_01",
            playerHit: "punch_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-knuckles-rusted.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rad: 25,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-knuckles-rusted.img",
            pos: {
                x: 0,
                y: -27,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.2,
                y: 0.2,
            },
            tint: 0xffffff,
        },
    },
    karambit: {
        name: "Karambit",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "slash",
            attackAnims: ["slash", "fists"],
            deploy: "spin",
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-karambit-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-karambit-rugged.img",
            pos: {
                x: 15.5,
                y: -5,
            },
            deployPos: {
                x: 32,
                y: 0,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    bayonet: {
        name: "Bayonet",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bayonet-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bayonet-rugged.img",
            pos: {
                x: -0.5,
                y: -32.5,
            },
            rot: 0.785,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    huntsman: {
        name: "Huntsman",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-huntsman-rugged.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-huntsman-rugged.img",
            pos: {
                x: 2.5,
                y: -35.5,
            },
            rot: 0.82,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    bowie: {
        name: "Bowie",
        type: "melee",
        quality: 0,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 24,
        obstacleDamage: 1,
        noPotatoSwap: true,
        noDropOnDeath: true,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 0.9,
            damageTimes: [0.1],
            cooldownTime: 0.25,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bowie-vintage.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bowie-vintage.img",
            pos: {
                x: -0.5,
                y: -32.5,
            },
            rot: 0.785,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },

    machete: {
        name: "Machete",
        type: "melee",
        quality: 1,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 33,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 1.5,
                y: 0,
            },
            rad: 1.75,
            damageTimes: [0.12],
            cooldownTime: 0.3,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "machete",
            attackAnims: ["cutReverse"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-machete-taiga.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-machete-taiga.img",
            pos: {
                x: -2.5,
                y: -48.5,
            },
            rot: 1.885,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    saw: {
        name: "Saw",
        type: "melee",
        quality: 1,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 2,
                y: 0,
            },
            rad: 1.75,
            damageTimes: [0.1, 0.5],
            cooldownTime: 0.7,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "machete",
            attackAnims: ["sawSwing"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
            playerHit2: "saw_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
            mirror: true,
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
            pos: {
                x: -2.5,
                y: -48.5,
            },
            rot: 1.885,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    woodaxe: {
        name: "Wood Axe",
        type: "melee",
        quality: 0,
        armorPiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 36,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.18],
            cooldownTime: 0.36,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-woodaxe.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-woodaxe.img",
            pos: {
                x: -12.5,
                y: -16,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    fireaxe: {
        name: "Fire Axe",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 2.4,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.21],
            cooldownTime: 0.42,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-fireaxe.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-fireaxe.img",
            pos: {
                x: -12.5,
                y: -4,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    katana: {
        name: "Katana",
        type: "melee",
        quality: 0,
        armorPiercing: true,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 40,
        obstacleDamage: 1.5,
        attack: {
            offset: {
                x: 1.75,
                y: 0,
            },
            rad: 2,
            damageTimes: [0.2],
            cooldownTime: 0.4,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeKatana",
            attackAnims: ["katanaSwing"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "medium_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-katana.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-katana.img",
            pos: {
                x: 52.5,
                y: -2,
            },
            rot: 3,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    naginata: {
        name: "Naginata",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 56,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 3.5,
                y: 0,
            },
            rad: 2,
            damageTimes: [0.27],
            cooldownTime: 0.54,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeNaginata",
            attackAnims: ["naginataSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "axe_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-naginata.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-naginata.img",
            pos: {
                x: 42.5,
                y: -3,
            },
            rot: 1.9,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    stonehammer: {
        name: "Stone Hammer",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 60,
        obstacleDamage: 1.92,
        attack: {
            offset: {
                x: 1.35,
                y: 0,
            },
            rad: 1.25,
            damageTimes: [0.25],
            cooldownTime: 0.5,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["hammerSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "heavy_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "hammer_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-stonehammer.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-stonehammer.img",
            pos: {
                x: -12.5,
                y: -4,
            },
            rot: 1.2,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
    },
    iceaxe: {
        name: "Ice Axe",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 44,
        obstacleDamage: 2.4,
        attack: {
            offset: {
                x: 1.4,
                y: 0,
            },
            rad: 1.3,
            damageTimes: [0.21],
            cooldownTime: 0.4,
        },
        speed: {
            equip: 1,
        },
        lootImg: {
            sprite: "loot-melee-ice_pick-survev.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            mirror: true,
            rot: 2.35619,
        },
        worldImg: {
            sprite: "loot-melee-ice_pick-survev.img",
            pos: {
                x: -12.5,
                y: -10,
            },
            rot: 1.2,
            scale: {
                x: 0.4,
                y: 0.4,
            },
            tint: 0xffffff,
            leftHandOntop: true,
        },
        anim: {
            idlePose: "meleeTwoHanded",
            attackAnims: ["axeSwing"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "medium_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "knife_hit_01",
        },
    },
    hook: {
        name: "Hook",
        type: "melee",
        quality: 1,
        autoAttack: true,
        switchDelay: 0.25,
        damage: 18,
        obstacleDamage: 1,
        attack: {
            offset: {
                x: 1.5,
                y: 0,
            },
            rad: 1,
            damageTimes: [0.075],
            cooldownTime: 0.175,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["hook"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "hook_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-hook-silver.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-hook-silver.img",
            pos: {
                x: 0,
                y: -27,
            },
            rot: 0.5 * Math.PI,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
            renderOnHand: true,
        },
    },
    pan: {
        name: "Pan",
        type: "melee",
        quality: 1,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 60,
        obstacleDamage: 0.8,
        attack: {
            offset: {
                x: 2,
                y: 0,
            },
            rad: 1.5,
            damageTimes: [0.15],
            cooldownTime: 0.5,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["pan"],
        },
        sound: {
            pickup: "pan_pickup_01",
            swing: "heavy_swing_01",
            deploy: "pan_pickup_01",
            playerHit: "pan_hit_01",
            bullet: "pan_bullet",
        },
        lootImg: {
            sprite: "loot-melee-pan-black.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: -0.785,
        },
        worldImg: {
            sprite: "loot-melee-pan-black-side.img",
            pos: {
                x: 0,
                y: -40,
            },
            rot: 1.125,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
        hipImg: {
            sprite: "loot-melee-pan-black-side.img",
            pos: {
                x: -17.25,
                y: 7.5,
            },
            rot: 0.78 * Math.PI,
            scale: {
                x: 0.3,
                y: 0.3,
            },
            tint: 0xffffff,
        },
        reflectSurface: {
            equipped: {
                p0: {
                    x: 2.65,
                    y: -0.125,
                },
                p1: {
                    x: 1.35,
                    y: -0.74,
                },
            },
            unequipped: {
                p0: {
                    x: -0.625,
                    y: -1.2,
                },
                p1: {
                    x: -1.4,
                    y: -0.25,
                },
            },
        },
    },
    spade: {
        name: "Spade",
        type: "melee",
        quality: 1,
        cleave: false,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 40,
        obstacleDamage: 1,
        noPotatoSwap: true,
        attack: {
            offset: {
                x: 1.75,
                y: 0,
            },
            rad: 1.5,
            damageTimes: [0.12],
            cooldownTime: 0.35,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "thrust"],
        },
        sound: {
            pickup: "heavy_pickup_01",
            swing: "knife_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "spade_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-spade-assault.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-spade-assault.img",
            pos: {
                x: -0.5,
                y: -41.5,
            },
            rot: 1,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    crowbar: {
        name: "Crowbar",
        type: "melee",
        quality: 1,
        cleave: false,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 33,
        obstacleDamage: 1.4,
        attack: {
            offset: {
                x: 1.25,
                y: 0,
            },
            rad: 1.25,
            damageTimes: [0.12],
            cooldownTime: 0.3,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "fists",
            attackAnims: ["cut", "cutReverseShort"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "crowbar_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-crowbar.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.785,
        },
        worldImg: {
            sprite: "loot-melee-crowbar.img",
            pos: {
                x: -1,
                y: -10,
            },
            rot: 1,
            scale: {
                x: 0.35,
                y: 0.35,
            },
            tint: 0xffffff,
        },
    },
    lasr_swrd_01: {
        name: "Lasr Swrd",
        type: "melee",
        quality: 1,
        armorPiercing: true,
        stonePiercing: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 50, // 60, then 30
        obstacleDamage: 1, // 1.5
        attack: {
            offset: { x: 2, y: 0 },
            rad: 2.2,
            damageTimes: [0.3],
            cooldownTime: 0.6,
        },
        speed: {
            equip: -3,
            attack: 7,
        },
        anim: {
            idlePose: "meleeLasrSwrd",
            attackAnims: ["lasrSwrdSwing"],
            poseAnims: ["lasrSwrd_pose_1", "lasrSwrd_pose_2", "lasrSwrd_pose_3"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "lasr_swing_01",
            deploy: "stow_weapon_01",
            playerHit: "lasr_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-lasrswrd-01.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0,
        },
        worldImg: {
            sprite: "loot-melee-lasrswrd-01.img",
            pos: { x: 38.0, y: -38.0 },
            rot: 3,
            scale: { x: 0.4, y: 0.4 },
            tint: 0xffffff,
            leftHandOntop: true,
        },
        /* Commenting out for now because this doesn't properly trigger sound or anim
        reflectArea: {
            offset: { x: 1.75, y: 0.0 },
            rad: 1,
        },
        */
    },
    cutlass: {
        name: "Cutlass",
        type: "melee",
        quality: 1,
        cleave: true,
        autoAttack: false,
        switchDelay: 0.25,
        damage: 30,
        obstacleDamage: 1,
        attack: {
            offset: {
                x: 2.25,
                y: 0,
            },
            rad: 1.75,
            damageTimes: [0.1],
            cooldownTime: 0.225,
        },
        speed: {
            equip: 1,
        },
        anim: {
            idlePose: "cutlass",
            attackAnims: ["cut", "cutReverse"],
        },
        sound: {
            pickup: "frag_pickup_01",
            swing: "knife_swing_01",
            deploy: "knife_deploy_01",
            playerHit: "knife_hit_01",
        },
        lootImg: {
            sprite: "loot-melee-cutlass.img",
            tint: 0xffffff,
            border: "loot-circle-outer-02.img",
            borderTint: 0xffffff,
            scale: 0.3,
            rot: 0.9,
        },
        worldImg: {
            sprite: "loot-melee-cutlass.img",
            pos: {
                x: 2.5,
                y: -75,
            },
            rot: 1.885,
            scale: {
                x: 0.325,
                y: 0.325,
            },
            tint: 0xffffff,
        },
    },
};

const SkinDefs: Record<string, MeleeDef> = {
    // ===== Fist skins =====
    // ==== Gloves ====
    // === Available by default ===
    fists: defineMeleeSkin("fists", {
        name: "Fists",
        rarity: Rarity.Stock,
        lore: "The old one-two.",
    }),
    red_gloves: defineMeleeSkin("fists", {
        name: "Red Gloves",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-red-gloves.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gloves-l.img",
            spriteR: "player-fists-gloves-r.img",
        },
        scale: {
            x: 0.185,
            y: 0.185,
        },
    }),
    feral_gloves: defineMeleeSkin("fists", {
        name: "Feral Claws",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-feral-claws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-feral-claws.img",
            spriteR: "player-fists-feral-claws.img",
        },
        scale: {
            x: 0.19,
            y: 0.19,
        },
    }),
    crab_gloves: defineMeleeSkin("fists", {
        name: "Crab Claws",
        rarity: Rarity.Stock,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-crab-tongs.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-crab-tongs-l.img",
            spriteR: "player-fists-crab-tongs-r.img",
        },
        scale: {
            x: 0.185,
            y: 0.185,
        },
    }),
    // === Unlockable ===
    // == Kong ==
    // = Seasonal =
    fist_bePresent: defineMeleeSkin("fists", {
        name: "Be Present",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-be-present.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-be-present-l.img",
            spriteR: "player-fists-be-present-r.img",
        },
    }),
    fist_dreidel: defineMeleeSkin("fists", {
        name: "Dreidel",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-dreidel.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dreidel-l.img",
            spriteR: "player-fists-dreidel-r.img",
        },
    }),
    fist_pineFury: defineMeleeSkin("fists", {
        name: "Pine Fury",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-pine-fury.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-pine-fury-l.img",
            spriteR: "player-fists-pine-fury-r.img",
        },
    }),
    // = Pass 2 =
    fist_blueVelvet: defineMeleeSkin("fists", {
        name: "Blue Velvet",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-blue-velvet.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-blue-velvet.img",
            spriteR: "player-fists-blue-velvet.img",
        },
    }),
    fist_split: defineMeleeSkin("fists", {
        name: "Split the Diff",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-split-the-diff.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-split-the-diff.img",
            spriteR: "player-fists-split-the-diff.img",
        },
    }),
    fist_frostpunch: defineMeleeSkin("fists", {
        name: "Frostpunch",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-frostpunch.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-frostpunch.img",
            spriteR: "player-fists-frostpunch.img",
        },
    }),
    // = Pass 3 =
    fist_moss: defineMeleeSkin("fists", {
        name: "Moss",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-moss.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-moss.img",
            spriteR: "player-fists-moss.img",
        },
    }),
    fist_immolate: defineMeleeSkin("fists", {
        name: "Immolate",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-immolate.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-immolate.img",
            spriteR: "player-fists-immolate.img",
        },
    }),
    fist_rainbowhands: defineMeleeSkin("fists", {
        name: "Rainbow Hands",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-rainbow-hands.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-rainbow-hands.img",
            spriteR: "player-fists-rainbow-hands.img",
        },
    }),
    fist_bulletbills: defineMeleeSkin("fists", {
        name: "Bullet Bills",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bullet-bills.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bullet-bills.img",
            spriteR: "player-fists-bullet-bills.img",
        },
    }),
    fist_poke: defineMeleeSkin("fists", {
        name: "Poke",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-poke.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-poke.img",
            spriteR: "player-fists-poke.img",
        },
    }),
    fist_darklets: defineMeleeSkin("fists", {
        name: "Darklets",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-darklets.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-darklets.img",
            spriteR: "player-fists-darklets.img",
        },
    }),
    fist_blackholes: defineMeleeSkin("fists", {
        name: "Black Holes",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lore: "Created by Shad0wy_F1gure",
        lootImg: {
            sprite: "loot-weapon-fists-black-holes.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-black-holes.img",
            spriteR: "player-fists-black-holes.img",
        },
    }),
    // = Pass 4 =
    fist_ranger: defineMeleeSkin("fists", {
        name: "Ranger",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-ranger.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ranger.img",
            spriteR: "player-fists-ranger.img",
        },
    }),
    fist_ember: defineMeleeSkin("fists", {
        name: "Ember",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-ember.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ember-l.img",
            spriteR: "player-fists-ember-r.img",
        },
    }),
    fist_linedUp: defineMeleeSkin("fists", {
        name: "Lined Up",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-lined-up.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-lined-up.img",
            spriteR: "player-fists-lined-up.img",
        },
    }),
    fist_leaf: defineMeleeSkin("fists", {
        name: "Tree Puncher",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-leaf.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-leaf-l.img",
            spriteR: "player-fists-leaf-r.img",
        },
    }),
    fist_scifi: defineMeleeSkin("fists", {
        name: "Flynn",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-scifi.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-scifi.img",
            spriteR: "player-fists-scifi.img",
        },
    }),
    fist_dinoclaws: defineMeleeSkin("fists", {
        name: "Raptor",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-dino-claws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dino-claws.img",
            spriteR: "player-fists-dino-claws.img",
        },
    }),
    // = Pass 5 =
    fist_gift_punch: defineMeleeSkin("fists", {
        name: "Gift Punch",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-gift-punch.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gift-punch.img",
            spriteR: "player-fists-gift-punch.img",
        },
    }),
    fist_santa: defineMeleeSkin("fists", {
        name: "Santa Mittens",
        rarity: Rarity.Uncommon,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-santa.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-santa-l.img",
            spriteR: "player-fists-santa-r.img",
        },
    }),
    fist_purptog: defineMeleeSkin("fists", {
        name: "Purptog",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-purptog.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-purptog.img",
            spriteR: "player-fists-purptog.img",
        },
    }),
    fist_golden_lobster: defineMeleeSkin("fists", {
        name: "Golden Lobster",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-golden-lobster.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-golden-lobster-l.img",
            spriteR: "player-fists-golden-lobster-r.img",
        },
    }),
    // = Pass 6 =
    fist_spongeGuy: defineMeleeSkin("fists", {
        name: "Sponge Guy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-sponge-guy.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-sponge-guy-l.img",
            spriteR: "player-fists-sponge-guy-r.img",
        },
    }),
    fist_tropicana: defineMeleeSkin("fists", {
        name: "Tropicana",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tropicana.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tropicana-l.img",
            spriteR: "player-fists-tropicana-r.img",
        },
    }),
    fist_rafflesia: defineMeleeSkin("fists", {
        name: "Rafflesia",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-rafflesia.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-rafflesia-l.img",
            spriteR: "player-fists-rafflesia-r.img",
        },
    }),
    fist_goldDrops: defineMeleeSkin("fists", {
        name: "Gold Drops",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-gold-drops.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-gold-drops-l.img",
            spriteR: "player-fists-gold-drops-r.img",
        },
    }),
    fist_grizzly: defineMeleeSkin("fists", {
        name: "Grizzly",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-grizzly.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-grizzly-l.img",
            spriteR: "player-fists-grizzly-r.img",
        },
    }),
    // = Pass 7 =
    fist_vitaminC: defineMeleeSkin("fists", {
        name: "Vitamin C",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-vitamin-c.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-vitamin-c-l.img",
            spriteR: "player-fists-vitamin-c-r.img",
        },
    }),
    fist_cocoNut: defineMeleeSkin("fists", {
        name: "Coco Nut",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-coco-nut.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-coco-nut-l.img",
            spriteR: "player-fists-coco-nut-r.img",
        },
    }),
    fist_atNet: defineMeleeSkin("fists", {
        name: "At Net",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-at-net.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-at-net-l.img",
            spriteR: "player-fists-at-net-r.img",
        },
    }),
    fist_beachBallin: defineMeleeSkin("fists", {
        name: "Beach Ballin",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-beach-ballin.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-beach-ballin-l.img",
            spriteR: "player-fists-beach-ballin-r.img",
        },
    }),
    fist_marbleRun: defineMeleeSkin("fists", {
        name: "Marble Run",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-marble-run.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-marble-run-l.img",
            spriteR: "player-fists-marble-run-r.img",
        },
    }),
    fist_fritterPunch: defineMeleeSkin("fists", {
        name: "Fritter Punch",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-fritter-punch.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-fritter-punch-l.img",
            spriteR: "player-fists-fritter-punch-r.img",
        },
    }),
    // = Pass 8 =
    fist_bologna: defineMeleeSkin("fists", {
        name: "Bologna",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bologna.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bologna-l.img",
            spriteR: "player-fists-bologna-r.img",
        },
    }),
    fist_inkyBusiness: defineMeleeSkin("fists", {
        name: "Inky Business",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-inky-business.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-inky-business-l.img",
            spriteR: "player-fists-inky-business-r.img",
        },
    }),
    fist_bloody: defineMeleeSkin("fists", {
        name: "Bloody",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bloody.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bloody-l.img",
            spriteR: "player-fists-bloody-r.img",
        },
    }),
    fist_tigerSeed: defineMeleeSkin("fists", {
        name: "Tiger Seed",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tiger-seed-l.img",
            spriteR: "player-fists-tiger-seed-r.img",
        },
    }),
    fist_flashy: defineMeleeSkin("fists", {
        name: "Flashy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-flashy.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-flashy-l.img",
            spriteR: "player-fists-flashy-r.img",
        },
    }),
    fist_theOtherPong: defineMeleeSkin("fists", {
        name: "The Other Pong",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-the-other-pong.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-the-other-pong-l.img",
            spriteR: "player-fists-the-other-pong-r.img",
        },
    }),
    fist_makeAChoice: defineMeleeSkin("fists", {
        name: "Make A Choice",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-make-a-choice.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-make-a-choice-l.img",
            spriteR: "player-fists-make-a-choice-r.img",
        },
    }),
    fist_paddle: defineMeleeSkin("fists", {
        name: "Paddle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-paddle.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-paddle-l.img",
            spriteR: "player-fists-paddle-r.img",
        },
    }),
    // = Pass 9 =
    fist_condimentium: defineMeleeSkin("fists", {
        name: "Condimentium",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-condimentium.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-condimentium-l.img",
            spriteR: "player-fists-condimentium-r.img",
        },
    }),
    fist_orangeLime: defineMeleeSkin("fists", {
        name: "Orange Lime",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-orange-lime.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-orange-lime-l.img",
            spriteR: "player-fists-orange-lime-r.img",
        },
    }),
    fist_purpleShutter: defineMeleeSkin("fists", {
        name: "Purple Shutter",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-purple-shutter.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-purple-shutter-l.img",
            spriteR: "player-fists-purple-shutter-r.img",
        },
    }),
    fist_shinyJello: defineMeleeSkin("fists", {
        name: "Shiny Jello",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-shiny-jello.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-shiny-jello-l.img",
            spriteR: "player-fists-shiny-jello-r.img",
        },
    }),
    fist_ghostPoke: defineMeleeSkin("fists", {
        name: "Ghost Poke",
        rarity: Rarity.Mythic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-ghost-poke.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ghost-poke-l.img",
            spriteR: "player-fists-ghost-poke-r.img",
        },
    }),
    fist_washiLamps: defineMeleeSkin("fists", {
        name: "Washi Lamps",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-washi-lamps.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-washi-lamps-l.img",
            spriteR: "player-fists-washi-lamps-r.img",
        },
    }),
    fist_getdowntonite: defineMeleeSkin("fists", {
        name: "Get Down Tonight",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-getdowntonite.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-getdowntonite-l.img",
            spriteR: "player-fists-getdowntonite-r.img",
        },
    }),
    fist_milestones: defineMeleeSkin("fists", {
        name: "Milestones",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-milestones.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-milestones-l.img",
            spriteR: "player-fists-milestones-r.img",
        },
    }),
    // = Pass 10 =
    fist_orangeMintstones: defineMeleeSkin("fists", {
        name: "Orange Mintstones",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-orange-mintstones.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-orange-mintstones-l.img",
            spriteR: "player-fists-orange-mintstones-r.img",
        },
    }),
    fist_meteorNite: defineMeleeSkin("fists", {
        name: "Meteor Nite",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-meteor-nite.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-meteor-nite-l.img",
            spriteR: "player-fists-meteor-nite-r.img",
        },
    }),
    fist_bonkbonk: defineMeleeSkin("fists", {
        name: "Bonk Bonk",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bonkbonk.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bonkbonk-l.img",
            spriteR: "player-fists-bonkbonk-r.img",
        },
    }),
    fist_flamingNucleus: defineMeleeSkin("fists", {
        name: "Flaming Nucleus",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-flaming-nucleus.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-flaming-nucleus-l.img",
            spriteR: "player-fists-flaming-nucleus-r.img",
        },
    }),
    fist_firstTool: defineMeleeSkin("fists", {
        name: "First Tool",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-first-tool.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-first-tool-l.img",
            spriteR: "player-fists-first-tool-r.img",
        },
    }),
    fist_bullsEye: defineMeleeSkin("fists", {
        name: "Bulls Eyes",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bulls-eyes.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bulls-eyes-l.img",
            spriteR: "player-fists-bulls-eyes-r.img",
        },
    }),
    fist_fuzzyHooves: defineMeleeSkin("fists", {
        name: "Fuzzy Hooves",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-fuzzy-hooves.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-fuzzy-hooves-l.img",
            spriteR: "player-fists-fuzzy-hooves-r.img",
        },
    }),
    fist_stonedgy: defineMeleeSkin("fists", {
        name: "Stonedgy",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-stonedgy.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-stonedgy-l.img",
            spriteR: "player-fists-stonedgy-r.img",
        },
    }),
    // = Pass 11 =
    fist_pixelDots: defineMeleeSkin("fists", {
        name: "Pixel Dots",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-pixel-dots.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-pixel-dots-l.img",
            spriteR: "player-fists-pixel-dots-r.img",
        },
    }),
    fist_retrhorizon: defineMeleeSkin("fists", {
        name: "Retro Horizon",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-retrhorizon.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-retrhorizon-l.img",
            spriteR: "player-fists-retrhorizon-r.img",
        },
    }),
    fist_qFist: defineMeleeSkin("fists", {
        name: "Q Fist",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-q-fist.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-q-fist-l.img",
            spriteR: "player-fists-q-fist-r.img",
        },
    }),
    fist_dizzieLocs: defineMeleeSkin("fists", {
        name: "Dizzie Locs",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-dizzie-locs.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dizzie-locs-l.img",
            spriteR: "player-fists-dizzie-locs-r.img",
        },
    }),
    fist_ranchChips: defineMeleeSkin("fists", {
        name: "Ranch Chips",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-ranch-chips.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-ranch-chips-l.img",
            spriteR: "player-fists-ranch-chips-r.img",
        },
    }),
    fist_squareyCerry: defineMeleeSkin("fists", {
        name: "Squarey Cherry",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-squarey-cherry.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-squarey-cherry-l.img",
            spriteR: "player-fists-squarey-cherry-r.img",
        },
    }),
    fist_lolitaPop: defineMeleeSkin("fists", {
        name: "Lolita Pop",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-lolita-pop.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-lolita-pop-l.img",
            spriteR: "player-fists-lolita-pop-r.img",
        },
    }),
    fist_developTheseRolls: defineMeleeSkin("fists", {
        name: "Develop These Rolls",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-develop-these-rolls.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-develop-these-rolls-l.img",
            spriteR: "player-fists-develop-these-rolls-r.img",
        },
    }),
    fist_dPunchPad: defineMeleeSkin("fists", {
        name: "D-Punch Pad",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-d-punch-pad.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-d-punch-pad-l.img",
            spriteR: "player-fists-d-punch-pad-r.img",
        },
    }),
    // = Pass 12 =
    fist_boogieStripes: defineMeleeSkin("fists", {
        name: "Boogie Stripes",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-boogie-stripes.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-boogie-stripes-l.img",
            spriteR: "player-fists-boogie-stripes-r.img",
        },
    }),
    fist_badMitten: defineMeleeSkin("fists", {
        name: "Bad Mitten",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-bad-mitten.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-bad-mitten-l.img",
            spriteR: "player-fists-bad-mitten-r.img",
        },
    }),
    fist_wreckedAngle: defineMeleeSkin("fists", {
        name: "Wrecked Angle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-wrecked-angle.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-wrecked-angle-l.img",
            spriteR: "player-fists-wrecked-angle-r.img",
        },
    }),
    fist_woodyAllan: defineMeleeSkin("fists", {
        name: "Woody Allan",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-woody-allan.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-woody-allan-l.img",
            spriteR: "player-fists-woody-allan-r.img",
        },
    }),
    fist_tawget: defineMeleeSkin("fists", {
        name: "Tawget",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tawget.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-tawget-l.img",
            spriteR: "player-fists-tawget-r.img",
        },
    }),
    fist_horsepower: defineMeleeSkin("fists", {
        name: "Horsepower",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-horsepower.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-horsepower-l.img",
            spriteR: "player-fists-horsepower-r.img",
        },
    }),
    fist_milkshaked: defineMeleeSkin("fists", {
        name: "Milkshaked",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-milkshaked.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-milkshaked-l.img",
            spriteR: "player-fists-milkshaked-r.img",
        },
    }),
    fist_cattleBattle: defineMeleeSkin("fists", {
        name: "Cattle Battle",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-cattle-battle.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-cattle-battle-l.img",
            spriteR: "player-fists-cattle-battle-r.img",
        },
    }),
    // = Probably unused =
    fist_101spots: defineMeleeSkin("fists", {
        name: "101 Spots",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-101-spots.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-101-spots-l.img",
            spriteR: "player-fists-101-spots-r.img",
        },
    }),
    fist_dishSoap: defineMeleeSkin("fists", {
        name: "Dish Soap",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-dish-soap.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-dish-soap-l.img",
            spriteR: "player-fists-dish-soap-r.img",
        },
    }),
    fist_garbanjo: defineMeleeSkin("fists", {
        name: "Garbanjo",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-garbanjo.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-garbanjo-l.img",
            spriteR: "player-fists-garbanjo-r.img",
        },
    }),
    fist_graphbars: defineMeleeSkin("fists", {
        name: "Graphbars",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-graphbars.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-graphbars-l.img",
            spriteR: "player-fists-graphbars-r.img",
        },
    }),
    fist_lit: defineMeleeSkin("fists", {
        name: "Lit",
        rarity: Rarity.Common,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-lit.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-lit-l.img",
            spriteR: "player-fists-lit-r.img",
        },
    }),
    fist_noPineNoGain: defineMeleeSkin("fists", {
        name: "No Pine No Gain",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-no-pine-no-gain.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-no-pine-no-gain-l.img",
            spriteR: "player-fists-no-pine-no-gain-r.img",
        },
    }),
    fist_upAndAtom: defineMeleeSkin("fists", {
        name: "Up And Atom",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-up-and-atom.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-up-and-atom-l.img",
            spriteR: "player-fists-up-and-atom-r.img",
        },
    }),
    fist_watermelon: defineMeleeSkin("fists", {
        name: "Watermelon",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-watermelon.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-watermelon-l.img",
            spriteR: "player-fists-watermelon-r.img",
        },
    }),
    // == Resurviv-original ==
    // = Bundles =
    fist_living_galaxy: defineMeleeSkin("fists", {
        name: "Living Galaxy Hands",
        rarity: Rarity.Mythic,
        lore: "Hold a piece of the endlessly moving night sky.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        galaxyEffect: true,
        lootImg: {
            sprite: "loot-weapon-fists-first-galaxy.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-king-galaxy.img",
            spriteR: "player-hands-king-galaxy.img",
        },
        scale: {
            x: 0.185,
            y: 0.185,
        },
    }),
    fist_checkmate: defineMeleeSkin("fists", {
        name: "Checkmate",
        rarity: Rarity.Rare,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-checkmate.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-hands-blue-zone.img",
            spriteR: "player-hands-arctic-avenger.img",
        },
    }),
    fist_paws: defineMeleeSkin("fists", {
        name: "Paws",
        rarity: Rarity.Epic,
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-paws.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-paws.img",
            spriteR: "player-fists-paws.img",
        },
    }),
    // = Other/Unused =
    fist_acorn: defineMeleeSkin("fists", {
        name: "Acorn Fists",
        rarity: Rarity.Rare,
        lore: "For those ready to go nuts on the battlefield.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-acorn-l.img",
            spriteR: "player-fists-acorn-r.img",
        },
    }),
    fist_candyCorn: defineMeleeSkin("fists", {
        name: "Candy Corn",
        rarity: Rarity.Uncommon,
        lore: "Sweet tooth.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-candy-corn-l.img",
            spriteR: "player-fists-candy-corn-r.img",
        },
    }),
    fist_ovenMitts: defineMeleeSkin("fists", {
        name: "Oven Mitts",
        rarity: Rarity.Rare,
        lore: "For handling heat on and off the battlefield.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-oven-mitts-l.img",
            spriteR: "player-fists-oven-mitts-r.img",
        },
    }),
    fist_mapleLeaves: defineMeleeSkin("fists", {
        name: "Maple Leaves",
        rarity: Rarity.Epic,
        lore: "For those who let their enemies fall like autumn leaves.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-maple-leaves-l.img",
            spriteR: "player-fists-maple-leaves-r.img",
        },
    }),
    fist_pinecone: defineMeleeSkin("fists", {
        name: "Pinecones",
        rarity: Rarity.Rare,
        lore: "For those who like their strikes extra prickly.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-pinecone-l.img",
            spriteR: "player-fists-pinecone-r.img",
        },
    }),
    fist_pumpkin: defineMeleeSkin("fists", {
        name: "Pumpkin",
        rarity: Rarity.Rare,
        lore: "For those ready to smash the competition this autumn.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-pumpkin-l.img",
            spriteR: "player-fists-pumpkin-r.img",
        },
    }),
    fist_skeleton: defineMeleeSkin("fists", {
        name: "Skeleton Knuckles",
        rarity: Rarity.Epic,
        lore: "For those who want to drop their opponents down to the bare bone.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-skeleton.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-skeleton-l.img",
            spriteR: "player-fists-skeleton-r.img",
        },
    }),
    fist_turkeyLeg: defineMeleeSkin("fists", {
        name: "Turkey Legs",
        rarity: Rarity.Rare,
        lore: "The meat munchers.",
        noPotatoSwap: true,
        noDropOnDeath: true,
        lootImg: {
            sprite: "loot-weapon-fists-tiger-seed.img",
            scale: 0.3,
            rad: 25,
            tint: 0xffffff,
        },
        handSprites: {
            spriteL: "player-fists-turkey-leg-l.img",
            spriteR: "player-fists-turkey-leg-r.img",
        },
    }),
    // ==== Non-gloves ====
    // === Surviv ===
    knuckles_rusted: defineMeleeSkin("knuckles", {
        name: "Knuckles Rusted",
        rarity: Rarity.Common,
        lore: "Rust up for the dust up.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knuckles-rusted.img",
        },
        worldImg: {
            sprite: "loot-melee-knuckles-rusted.img",
        },
    }),
    knuckles_heroic: defineMeleeSkin("knuckles", {
        name: "Knuckles Heroic",
        rarity: Rarity.Epic,
        lore: "Give 'em a hero sandwich.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knuckles-heroic.img",
        },
        worldImg: {
            sprite: "loot-melee-knuckles-heroic.img",
        },
    }),
    karambit_rugged: defineMeleeSkin("karambit", {
        name: "Karambit Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        anim: {
            idlePose: "slash",
            attackAnims: ["slash", "fists"],
        },
        lootImg: {
            sprite: "loot-melee-karambit-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-rugged.img",
        },
    }),
    karambit_prismatic: defineMeleeSkin("karambit", {
        name: "Karambit Prismatic",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-karambit-prismatic.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-prismatic.img",
        },
    }),
    karambit_drowned: defineMeleeSkin("karambit", {
        name: "Karambit Drowned",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-karambit-drowned.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-drowned.img",
        },
    }),
    bayonet_rugged: defineMeleeSkin("bayonet", {
        name: "Bayonet Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bayonet-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-bayonet-rugged.img",
        },
    }),
    bayonet_woodland: defineMeleeSkin("bayonet", {
        name: "Bayonet Woodland",
        rarity: Rarity.Mythic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bayonet-woodland.img",
        },
        worldImg: {
            sprite: "loot-melee-bayonet-woodland.img",
        },
    }),
    huntsman_rugged: defineMeleeSkin("huntsman", {
        name: "Huntsman Rugged",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-rugged.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-rugged.img",
        },
    }),
    huntsman_burnished: defineMeleeSkin("huntsman", {
        name: "Huntsman Burnished",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-burnished.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-burnished.img",
        },
    }),
    huntsman_blackwater: defineMeleeSkin("huntsman", {
        name: "Huntsman Burnished",
        rarity: Rarity.Mythic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-blackwater.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-blackwater.img",
        },
    }),
    bowie_vintage: defineMeleeSkin("bowie", {
        name: "Bowie Vintage",
        rarity: Rarity.Rare,
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-bowie-vintage.img" },
        worldImg: {
            sprite: "loot-melee-bowie-vintage.img",
        },
    }),
    bowie_frontier: defineMeleeSkin("bowie", {
        name: "Bowie Frontier",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bowie-frontier.img",
        },
        worldImg: {
            sprite: "loot-melee-bowie-frontier.img",
        },
    }),
    // === Resurviv ===
    karambit_camo: defineMeleeSkin("karambit", {
        name: "Karambit Camo",
        rarity: Rarity.Epic,
        noPotatoSwap: false,
        anim: {
            idlePose: "slash",
            attackAnims: ["slash", "fists"],
        },
        lootImg: {
            sprite: "loot-melee-karambit-camo.img",
        },
        worldImg: {
            sprite: "loot-melee-karambit-camo.img",
        },
    }),
    bayonet_gilded: defineMeleeSkin("bayonet", {
        name: "Gilded Bayonet",
        rarity: Rarity.Epic,
        lore: "A luxurious take on the classic bayonet, perfect for those who appreciate both style and substance.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bayonet-gilded.img",
        },
        worldImg: {
            sprite: "loot-melee-bayonet-gilded.img",
        },
    }),
    carvingfork: defineMeleeSkin("bayonet", {
        name: "Carving Fork",
        rarity: Rarity.Epic,
        lore: "For those who like to keep their opponents at a comfortable roasting distance.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-carvingfork.img",
        },
        worldImg: {
            sprite: "loot-melee-carvingfork.img",
        },
    }),
    knife_ben: defineMeleeSkin("bayonet", {
        name: "Ben's Knife",
        rarity: Rarity.Mythic,
        lore: "A rare collector's item crafted by the serial killer & blacksmith Benny. - HXH",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knife-ben.img",
        },
        worldImg: {
            sprite: "loot-melee-knife-ben.img",
        },
    }),
    knife_toji: defineMeleeSkin("bayonet", {
        name: "Toji's Knife",
        rarity: Rarity.Mythic,
        lore: "Even infinity can be pierced.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knife-toji.img",
        },
        worldImg: {
            sprite: "loot-melee-knife-toji.img",
        },
    }),
    knife_bone: defineMeleeSkin("bayonet", {
        name: "Bone Knife",
        rarity: Rarity.Epic,
        lore: "For those who prefer a primal touch to their combat style.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-knife-bone.img",
        },
        worldImg: {
            sprite: "loot-melee-knife-bone.img",
        },
    }),
    kunai_shadow: defineMeleeSkin("bayonet", {
        name: "Shadow Kunai",
        rarity: Rarity.Mythic,
        lore: "For those who move like shadows and strike with precision.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-kunai-shadow.img",
        },
        worldImg: {
            sprite: "loot-melee-kunai-shadow.img",
        },
    }),
    guthook_woodland: defineMeleeSkin("bayonet", {
        name: "Guthook Woodland",
        rarity: Rarity.Mythic,
        lore: "Created by SigmaSanty1",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-guthook-woodland.img",
        },
        worldImg: {
            sprite: "loot-melee-guthook-woodland.img",
        },
    }),
    sickle_farmer: defineMeleeSkin("bayonet", {
        name: "Farmer's Sickle",
        rarity: Rarity.Rare,
        lore: "Perfect for harvesting crops—or reaping victory on the field.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-sickle-farmer.img",
        },
        worldImg: {
            sprite: "loot-melee-sickle-farmer.img",
        },
    }),
    huntsman_bloodmoon: defineMeleeSkin("huntsman", {
        name: "Bloodmoon Huntsman",
        rarity: Rarity.Epic,
        lore: "A vicious, ruby-tinted blade forged for fast strikes and ruthless accuracy.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-huntsman-bloodmoon.img",
        },
        worldImg: {
            sprite: "loot-melee-huntsman-bloodmoon.img",
        },
    }),
    // ===== Non-fist skins =====
    machete_taiga: defineMeleeSkin("machete", {
        name: "UVSR Taiga",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-machete-taiga.img" },
        worldImg: {
            sprite: "loot-melee-machete-taiga.img",
        },
    }),
    kukri_trad: defineMeleeSkin("machete", {
        name: "Tallow's Kukri",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-kukri-trad.img" },
        worldImg: {
            sprite: "loot-melee-kukri-trad.img",
            pos: { x: -0.5, y: -46.5 },
        },
    }),
    bonesaw_rusted: defineMeleeSkin("saw", {
        name: "Bonesaw Rusted",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-rusted.img",
        },
    }),
    woodaxe_bloody: defineMeleeSkin("woodaxe", {
        name: "Axe Bloodstained",
        lootImg: {
            sprite: "loot-melee-woodaxe-bloody.img",
        },
        worldImg: {
            sprite: "loot-melee-woodaxe-bloody.img",
        },
    }),
    katana_rusted: defineMeleeSkin("katana", {
        name: "Katana Rusted",
        lootImg: { sprite: "loot-melee-katana-rusted.img" },
        worldImg: {
            sprite: "loot-melee-katana-rusted.img",
        },
    }),
    katana_orchid: defineMeleeSkin("katana", {
        name: "Katana Orchid",
        quality: 1,
        lootImg: { sprite: "loot-melee-katana-orchid.img" },
        worldImg: {
            sprite: "loot-melee-katana-orchid.img",
        },
    }),
    sledgehammer: defineMeleeSkin("stonehammer", {
        name: "Sledgehammer",
        lootImg: { sprite: "loot-melee-sledgehammer.img" },
        worldImg: {
            sprite: "loot-melee-sledgehammer.img",
            pos: { x: -12.5, y: -3.5 },
        },
    }),
    crowbar_scout: defineMeleeSkin("crowbar", {
        name: "Scouting Crowbar",
        lootImg: { sprite: "loot-melee-crowbar-scout.img" },
        worldImg: {
            sprite: "loot-melee-crowbar-scout.img",
        },
    }),
    crowbar_recon: defineMeleeSkin("crowbar", {
        name: "Crowbar Carbon",
        lootImg: { sprite: "loot-melee-crowbar-recon.img" },
        worldImg: {
            sprite: "loot-melee-crowbar-recon.img",
        },
    }),
    kukri_sniper: defineMeleeSkin("machete", {
        name: "Marksman's Recurve",
        noPotatoSwap: false,
        lootImg: { sprite: "loot-melee-kukri-sniper.img" },
        worldImg: {
            sprite: "loot-melee-kukri-sniper.img",
            pos: { x: -0.5, y: -46.5 },
        },
    }),
    bonesaw_healer: defineMeleeSkin("saw", {
        name: "The Separator",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-bonesaw-healer.img",
        },
        worldImg: {
            sprite: "loot-melee-bonesaw-healer.img",
        },
    }),
    katana_demo: defineMeleeSkin("katana", {
        name: "Hakai no Katana",
        lootImg: { sprite: "loot-melee-katana-demo.img" },
        worldImg: { sprite: "loot-melee-katana-demo.img" },
    }),
    spade_assault: defineMeleeSkin("spade", {
        name: "Trench Spade",
        noPotatoSwap: false,
    }),
    warhammer_tank: defineMeleeSkin("stonehammer", {
        name: "Panzerhammer",
        damage: 64,
        attack: {
            offset: { x: 1.5, y: 0 },
            rad: 1.75,
            damageTimes: [0.3],
            cooldownTime: 0.6,
        },
        lootImg: {
            sprite: "loot-melee-warhammer-tank.img",
        },
        worldImg: {
            sprite: "loot-melee-warhammer-tank.img",
            pos: { x: -10.5, y: -3 },
        },
    }),
    lasr_swrd_02: defineMeleeSkin("lasr_swrd_01", {
        lootImg: { sprite: "loot-melee-lasrswrd-02.img" },
        worldImg: { sprite: "loot-melee-lasrswrd-02.img" },
    }),
    lasr_swrd_03: defineMeleeSkin("lasr_swrd_01", {
        lootImg: { sprite: "loot-melee-lasrswrd-03.img" },
        worldImg: { sprite: "loot-melee-lasrswrd-03.img" },
    }),
    cutlass_gold: defineMeleeSkin("cutlass", {
        name: "Gold Cutlass",
        noPotatoSwap: true,
        damage: 35,
        perk: "pirate",
        lootImg: { sprite: "loot-melee-cutlass-gold.img" },
        worldImg: { sprite: "loot-melee-cutlass-gold.img" },
    }),
    // === Resurviv ===
    baton_police: defineMeleeSkin("machete", {
        name: "Police Baton",
        rarity: Rarity.Epic,
        lore: "For maintaining order in the most chaotic situations.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-baton-police.img",
        },
        worldImg: {
            sprite: "loot-melee-baton-police.img",
        },
    }),
    rapier: defineMeleeSkin("machete", {
        name: "Rapier",
        rarity: Rarity.Epic,
        lore: "For those who fight with elegance, speed, and undeniable finesse.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-rapier.img",
        },
        worldImg: {
            sprite: "loot-melee-rapier.img",
        },
    }),
    katana_living_galaxy: defineMeleeSkin("katana", {
        name: "Living Galaxy Katana",
        rarity: 5,
        lore: "Its edge cuts across the night sky.",
        noDropOnDeath: true,
        galaxyEffect: true,
        lootImg: {
            sprite: "loot-melee-katana-orchid.img",
            tint: 0x9b6cff,
        },
        worldImg: {
            sprite: "loot-melee-katana.img",
            tint: 0xffffff,
        },
    }),
    katana_samurai: defineMeleeSkin("katana", {
        name: "Katana Samurai",
        quality: 1,
        noDropOnDeath: true,
        lootImg: { sprite: "loot-melee-katana-samurai.img" },
        worldImg: {
            sprite: "loot-melee-katana-samurai.img",
        },
    }),
    scythe_reaper: defineMeleeSkin("naginata", {
        name: "Reaper's Scythe",
        rarity: Rarity.Epic,
        lore: "For those who reap victory with refined style.",
        noPotatoSwap: false,
        lootImg: {
            sprite: "loot-melee-scythe-reaper.img",
        },
        worldImg: {
            sprite: "loot-melee-scythe-reaper.img",
        },
    }),
};

export const MeleeDefs: Record<string, MeleeDef> = { ...BaseDefs, ...SkinDefs };
