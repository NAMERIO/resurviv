import { Config } from "../config";
import { defaultLogger } from "./logger";

const IP_WEBHOOK = Config.webhooks?.ipLog;
const TEAM_CREATION_WEBHOOK = Config.webhooks?.teamCreation;

const REGION = Config.gameServer.thisRegion.toUpperCase();

export function logIpToDiscord(name: string, ip?: string) {
    if (process.env.NODE_ENV !== "production") return;
    if (!ip) return;
    if (!IP_WEBHOOK) return;
    const formattedName = name.replaceAll("@", "(at)");
    const message = `[${REGION}] ${formattedName} joined the game. ${ip}`;

    return fetch(IP_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: message,
        }),
    }).catch((err) => {
        defaultLogger.error(`Failed to log IP to discord:`, err);
    });
}

export function logTeamCreation(name: string, region: string, room?: string) {
    if (process.env.NODE_ENV !== "production") return;
    if (!TEAM_CREATION_WEBHOOK) return;
    const message = `[${region.toUpperCase()}] ${name} created a team. ${room}`;
    return fetch(TEAM_CREATION_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: message,
        }),
    });
}