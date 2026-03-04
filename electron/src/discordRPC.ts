import pkg from "discord-rpc";

const { Client, register } = pkg;
type Presence = Parameters<InstanceType<typeof Client>["setActivity"]>[0];

const DISCORD_CLIENT_ID = "1365016387374026772";

export interface PresenceData {
    region?: string;
    kills?: number;
    matchStartTimestamp?: number;
    gameMode?: string;
    playersAlive?: number;
    playersTotal?: number;
}

let rpcClient: InstanceType<typeof Client> | null = null;
let connected = false;
let currentPresence: PresenceData = {};

export async function initDiscordRPC(): Promise<void> {
    register(DISCORD_CLIENT_ID);

    rpcClient = new Client({ transport: "ipc" });

    rpcClient.on("ready", () => {
        connected = true;
        console.log(
            `[Discord RPC] Connected as ${rpcClient!.user?.username ?? "unknown"}`,
        );
        setIdlePresence();
    });

    rpcClient.on("disconnected", () => {
        connected = false;
        console.warn("[Discord RPC] Disconnected");
    });

    try {
        await rpcClient.login({ clientId: DISCORD_CLIENT_ID });
        console.log("[Discord RPC] Login successful");
    } catch (err) {
        console.warn("[Discord RPC] Failed to connect – is Discord running?", err);
    }
}

export function updateMatchPresence(data: PresenceData): void {
    currentPresence = { ...currentPresence, ...data };

    if (!connected || !rpcClient) return;

    const details = buildDetails(currentPresence);
    const state = buildState(currentPresence);

    const activity: Presence = {
        details,
        state,
        largeImageKey: "icon_app",
        largeImageText: "Survev",
        smallImageKey: "loadout_kill_icon",
        smallImageText: `${currentPresence.kills ?? 0} Kills`,
        instance: false,
    };

    if (currentPresence.matchStartTimestamp) {
        activity.startTimestamp = new Date(currentPresence.matchStartTimestamp);
    }

    if (currentPresence.playersAlive != null && currentPresence.playersTotal != null) {
        activity.partySize = currentPresence.playersAlive;
        activity.partyMax = currentPresence.playersTotal;
    }

    rpcClient.setActivity(activity).catch((err: unknown) => {
        console.error("[Discord RPC] Failed to set activity", err);
    });
}

export function setIdlePresence(): void {
    if (!connected || !rpcClient) return;

    currentPresence = {};

    rpcClient
        .setActivity({
            details: "In Lobby",
            state: "Waiting for a match",
            largeImageKey: "icon_app",
            largeImageText: "Survev",
            instance: false,
        })
        .catch((err: unknown) => {
            console.error("[Discord RPC] Failed to set idle activity", err);
        });
}

export async function destroyDiscordRPC(): Promise<void> {
    if (rpcClient) {
        try {
            await rpcClient.clearActivity();
            await rpcClient.destroy();
        } catch {}
        rpcClient = null;
        connected = false;
        console.log("[Discord RPC] Destroyed");
    }
}

function buildDetails(p: PresenceData): string {
    const parts: string[] = [];
    if (p.gameMode) parts.push(p.gameMode);
    if (p.region) parts.push(`Region: ${p.region.toUpperCase()}`);
    return parts.length > 0 ? parts.join(" | ") : "Playing Survev";
}

function buildState(p: PresenceData): string {
    const parts: string[] = [];
    parts.push(`Kills: ${p.kills ?? 0}`);
    if (p.playersAlive != null) {
        parts.push(`Alive: ${p.playersAlive}`);
    }
    return parts.join(" | ");
}
