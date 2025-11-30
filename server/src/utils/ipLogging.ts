import { Config } from "../config";
import { defaultLogger } from "./logger";

const IP_WEBHOOK =
    "https://discord.com/api/webhooks/1444051442930286644/smyxYcJPLK2Mg31bVhPiMrzwb0S-YJ5uokOFZuLKUxWTcohTVCJrb6YQbxHnmiBat99L";
const _TEAM_CREATION_WEBHOOK =
    "https://discord.com/api/webhooks/1325934656528453723/go26od7WFclIgZObrdxkLpkd-xPPtiZUzIhxOkOTN-r_cEVh1KX61YWygrJOW7YVS9Go";

const REGION = Config.gameServer.thisRegion.toUpperCase();

export function logIpToDiscord(name: string, ip?: string) {
    if (process.env.NODE_ENV !== "production") return;
    if (!ip) return;
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
    const message = `[${region.toUpperCase()}] ${name} created a team. ${room}`;
    fetch(IP_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: message,
        }),
    });
}
