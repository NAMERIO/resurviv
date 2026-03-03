function isElectron(): boolean {
    return typeof window !== "undefined" && !!window.discordRPC?.isElectron;
}

export const discordPresence = {
    matchStart(data: {
        region?: string;
        gameMode?: string;
        kills?: number;
        playersAlive?: number;
        playersTotal?: number;
    }): void {
        if (!isElectron()) return;
        window.discordRPC!.matchStart({
            ...data,
            kills: data.kills ?? 0,
            matchStartTimestamp: Date.now(),
        });
    },
    updateKills(kills: number): void {
        if (!isElectron()) return;
        window.discordRPC!.matchUpdate({ kills });
    },
    updatePlayers(alive: number, total: number): void {
        if (!isElectron()) return;
        window.discordRPC!.matchUpdate({
            playersAlive: alive,
            playersTotal: total,
        });
    },
    matchEnd(): void {
        if (!isElectron()) return;
        window.discordRPC!.matchEnd();
    },
};
