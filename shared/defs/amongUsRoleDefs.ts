export const AmongUsRoleIds = ["crewmate", "impostor"] as const;

export type AmongUsRole = (typeof AmongUsRoleIds)[number];

export interface AmongUsRoleDef {
    id: AmongUsRole;
    name: string;
    color: number;
    karambitDamage: number;
}

export const AmongUsRoleDefs = {
    crewmate: {
        id: "crewmate",
        name: "Crewmate",
        color: 0xffffff,
        karambitDamage: 0,
    },
    impostor: {
        id: "impostor",
        name: "Impostor",
        color: 0xff3333,
        karambitDamage: 1000,
    },
} satisfies Record<AmongUsRole, AmongUsRoleDef>;

export function isAmongUsRole(role: string | undefined): role is AmongUsRole {
    return !!role && AmongUsRoleIds.includes(role as AmongUsRole);
}
