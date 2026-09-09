export interface ArenaReplayHistoryEntry {
    gameId: string;
    lobbyCode: string;
    region: string;
    mapName: string;
    miniGame: string;
    teamMode: number;
    durationMs: number;
    playerCount: number;
    spectatorCount: number;
    spectator: boolean;
    playerName: string;
    sizeBytes: number;
    compressedSizeBytes: number;
    createdAt: string;
    expiresAt: string;
}

export interface ArenaReplayHistoryResponse {
    replays: ArenaReplayHistoryEntry[];
    storageEnabled: boolean;
}
