import { GameConfig, GasMode } from "../../../shared/gameConfig";

export function isBattleRoyaleMapName(mapName: string) {
    return mapName.startsWith("br_");
}

export const BattleRoyaleDefaultItems = {
    ...GameConfig.player.defaultItems,
    weapons: [
        { type: "", ammo: 0 },
        { type: "", ammo: 0 },
        { type: "fists", ammo: 0 },
        { type: "", ammo: 0 },
    ],
    backpack: "backpack00",
    helmet: "",
    chest: "",
    scope: "1xscope",
    perks: [],
    inventory: Object.fromEntries(
        Object.keys(GameConfig.player.defaultItems.inventory).map((item) => [
            item,
            item === "1xscope" ? 1 : 0,
        ]),
    ),
};

export const BattleRoyaleGasStages = [
    {
        mode: GasMode.Inactive,
        duration: 0,
        rad: 0.7425,
        damage: 0,
    },
    {
        mode: GasMode.Waiting,
        duration: 80,
        rad: 0.45,
        damage: 1.4,
    },
    {
        mode: GasMode.Moving,
        duration: 30,
        rad: 0.45,
        damage: 1.4,
    },
    {
        mode: GasMode.Waiting,
        duration: 65,
        rad: 0.3125,
        damage: 2.2,
    },
    {
        mode: GasMode.Moving,
        duration: 25,
        rad: 0.3125,
        damage: 2.2,
    },
    {
        mode: GasMode.Waiting,
        duration: 50,
        rad: 0.2125,
        damage: 3.5,
    },
    {
        mode: GasMode.Moving,
        duration: 20,
        rad: 0.2125,
        damage: 3.5,
    },
    {
        mode: GasMode.Waiting,
        duration: 40,
        rad: 0.1375,
        damage: 7.5,
    },
    {
        mode: GasMode.Moving,
        duration: 15,
        rad: 0.1375,
        damage: 7.5,
    },
    {
        mode: GasMode.Waiting,
        duration: 30,
        rad: 0.075,
        damage: 10,
    },
    {
        mode: GasMode.Moving,
        duration: 10,
        rad: 0.075,
        damage: 10,
    },
    {
        mode: GasMode.Waiting,
        duration: 25,
        rad: 0.045,
        damage: 14,
    },
    {
        mode: GasMode.Moving,
        duration: 5,
        rad: 0.045,
        damage: 14,
    },
    {
        mode: GasMode.Waiting,
        duration: 20,
        rad: 0.0225,
        damage: 22,
    },
    {
        mode: GasMode.Moving,
        duration: 6,
        rad: 0.0225,
        damage: 22,
    },
    {
        mode: GasMode.Waiting,
        duration: 15,
        rad: 0,
        damage: 22,
    },
    {
        mode: GasMode.Moving,
        duration: 15,
        rad: 0,
        damage: 22,
    },
];
