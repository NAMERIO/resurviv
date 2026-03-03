interface DiscordRPCPresenceData {
    region?: string;
    kills?: number;
    matchStartTimestamp?: number;
    gameMode?: string;
    playersAlive?: number;
    playersTotal?: number;
}

interface DiscordRPCBridge {
    matchStart(data: DiscordRPCPresenceData): void;
    matchUpdate(data: Partial<DiscordRPCPresenceData>): void;
    matchEnd(): void;
    readonly isElectron: true;
}

interface Window {
    discordRPC?: DiscordRPCBridge;
}
