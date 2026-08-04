const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

interface RendererPresenceData {
    region?: string;
    kills?: number;
    matchStartTimestamp?: number;
    gameMode?: string;
    playersAlive?: number;
    playersTotal?: number;
}

contextBridge.exposeInMainWorld("discordRPC", {
    setHome(playerName: string) {
        ipcRenderer.send("discord:home", playerName);
    },

    matchStart(data: RendererPresenceData) {
        ipcRenderer.send("discord:match-start", data);
    },

    matchUpdate(data: Partial<RendererPresenceData>) {
        ipcRenderer.send("discord:match-update", data);
    },

    matchEnd() {
        ipcRenderer.send("discord:match-end");
    },

    isElectron: true as const,
});
