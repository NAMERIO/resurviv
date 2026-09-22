export const selectablePerks: readonly string[] = [
    "melee_runner",
    "armor_master",
    "quick_reload",
    "melee_striker",
    "gun_master",
    "first_hit",
    "throw_slow",
    "low_hp_surge",
    "chambered",
    "mine_master",
];

export function getSelectedPerk(savedPerk: string | undefined): string {
    return savedPerk && selectablePerks.includes(savedPerk) ? savedPerk : "quick_reload";
}
