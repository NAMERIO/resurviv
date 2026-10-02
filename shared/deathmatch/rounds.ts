export const DeathmatchFirstToOptions = [1, 3, 5] as const;
export type DeathmatchFirstTo = (typeof DeathmatchFirstToOptions)[number];

export function normalizeDeathmatchFirstTo(value?: number): DeathmatchFirstTo {
    return value === 3 || value === 5 ? value : 1;
}
