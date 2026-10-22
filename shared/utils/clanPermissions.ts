import type { ClanMemberRole } from "../types/clan";

export type EffectiveClanRole = ClanMemberRole | "owner";

export function canManageClan(role: EffectiveClanRole): boolean {
    return role === "owner" || role === "admin";
}

export function canKickClanMember(
    actor: EffectiveClanRole,
    target: EffectiveClanRole,
): boolean {
    return canManageClan(actor) && target !== "owner";
}

export function canSetClanMemberRole(
    actor: EffectiveClanRole,
    target: EffectiveClanRole,
    nextRole: ClanMemberRole,
): boolean {
    if (target === "owner") return false;
    return actor === "owner" || (actor === "admin" && nextRole !== "admin");
}
