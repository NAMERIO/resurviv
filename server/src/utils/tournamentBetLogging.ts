import { Config } from "../config";
import { defaultLogger } from "./logger";

const TOURNAMENT_BETS_WEBHOOK = Config.webhooks?.tournamentBets;

function sanitizeDiscordText(value: string) {
    return value.replaceAll("@", "(at)");
}

type TournamentBetLog = {
    username: string;
    slug: string;
    market: string;
    selection: string;
    oddsHundredths: number;
    amount: number;
    balance: number;
};

export async function logTournamentBetToDiscord({
    username,
    slug,
    market,
    selection,
    oddsHundredths,
    amount,
    balance,
}: TournamentBetLog) {
    if (process.env.NODE_ENV !== "production" || !TOURNAMENT_BETS_WEBHOOK) return;

    const player = sanitizeDiscordText(username || slug);
    const account = sanitizeDiscordText(slug);
    const marketName = sanitizeDiscordText(market);
    const selectionName = sanitizeDiscordText(selection);
    const odds = (oddsHundredths / 100).toFixed(2);
    const potentialPayout = Math.floor((amount * oddsHundredths) / 100);
    const message =
        `**${player}** (${account}) bet **${amount.toLocaleString()} GP** on ` +
        `**${selectionName}** · ${marketName} · ${odds}x\n` +
        `Potential return: ${potentialPayout.toLocaleString()} GP · ` +
        `Balance: ${balance.toLocaleString()} GP`;

    try {
        const response = await fetch(TOURNAMENT_BETS_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message }),
        });
        if (!response.ok) {
            throw new Error(`Discord returned HTTP ${response.status}`);
        }
    } catch (error) {
        defaultLogger.error("Failed to log tournament bet to Discord:", error);
    }
}
