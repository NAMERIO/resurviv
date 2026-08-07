import {
    getTournamentPlayers,
    getTournamentRound,
    type TournamentMatchResult,
    TournamentPlayerRegions,
    type TournamentState,
} from "../../shared/types/tournament";
import { api } from "./api";

const leftRounds = [[0, 1, 2, 3, 4, 5, 6, 7], [16, 17, 18, 19], [24, 25], [28]];
const rightRounds = [[29], [26, 27], [20, 21, 22, 23], [8, 9, 10, 11, 12, 13, 14, 15]];
let state: TournamentState;
let canEdit = false;
let editMode = false;
let canPredict = false;
let predictionMatchId: number | null = null;
const predictions = new Map<number, string>();
const bracket = document.querySelector<HTMLElement>("#bracket")!;
const editor = document.querySelector<HTMLElement>("#editor-backdrop")!;
const form = document.querySelector<HTMLFormElement>("#match-editor")!;
const predictionDialog = document.querySelector<HTMLElement>("#prediction-backdrop")!;
const predictionStatsDialog = document.querySelector<HTMLElement>(
    "#prediction-stats-backdrop",
)!;

interface PredictionMatchStats {
    matchId: number;
    players: [string | null, string | null];
    votes: [number, number];
    total: number;
}

interface PredictionStatus {
    predictions: Array<{ matchId: number; predictedPlayer: string }>;
    requiredPicks: number;
    rewardGp: number;
    rewarded: boolean;
}

function updatePredictionStatus(rewarded = false) {
    const status = document.querySelector<HTMLElement>("#prediction-status")!;
    if (rewarded) {
        status.innerHTML =
            '<span class="prediction-progress">Perfect bracket!</span><span class="prediction-reward"><img src="/img/gui/currency-golde-potato.svg" alt="GP">5,000 GP awarded</span>';
        status.classList.add("rewarded");
        return;
    }
    status.classList.remove("rewarded");
    status.innerHTML = `<span class="prediction-progress">${predictions.size}/31 predictions locked</span><span class="prediction-reward">Predict all 31 games correctly for <img src="/img/gui/currency-golde-potato.svg" alt="GP"> 5,000 GP</span>`;
}

function playerRow(
    name: string | null,
    score: number | null,
    winner: boolean,
    picked = false,
) {
    const region = name
        ? TournamentPlayerRegions[name as keyof typeof TournamentPlayerRegions]
        : null;
    return `<div class="player${winner ? " winner" : ""}${picked ? " predicted-pick" : ""}${name ? "" : " tbd"}"><span class="player-name">${region ? `<span class="player-region region-${region.toLowerCase()}">${region}</span>` : ""}${winner ? '<img class="winner-trophy" src="/img/clans/wins.svg" alt="Winner">' : ""}${name || "To be decided"}</span><span class="score">${score ?? "—"}</span></div>`;
}

function matchCard(matchId: number) {
    const result = state.matches[matchId];
    const players = getTournamentPlayers(state, matchId);
    const pick = predictions.get(matchId);
    const ready = canPredict && result.winner === null && players[0] && players[1];
    const extraClass = editMode
        ? " editable"
        : ready && !pick
          ? " predictable"
          : pick
            ? " predicted"
            : "";
    const title = editMode
        ? "Edit score and winner"
        : pick
          ? `Locked prediction: ${pick}`
          : ready
            ? "Make a free prediction"
            : "Matchup";
    return `<article class="match${extraClass}" data-match-id="${matchId}" title="${title}">${playerRow(players[0], result.scoreA, result.winner === 0, pick === players[0])}${playerRow(players[1], result.scoreB, result.winner === 1, pick === players[1])}</article>`;
}

function roundColumn(ids: number[], side: "left" | "right") {
    return `<div class="bracket-column ${side}">${ids.map(matchCard).join("")}</div>`;
}

function render() {
    bracket.innerHTML = [
        ...leftRounds.map((ids) => roundColumn(ids, "left")),
        `<div class="bracket-column final-column"><div class="trophy"><img src="/img/clans/wins.svg" alt=""><span>FINAL MATCH</span></div>${matchCard(30)}</div>`,
        ...rightRounds.map((ids) => roundColumn(ids, "right")),
    ].join("");
    document.querySelector("#last-updated")!.textContent = state.updatedAt
        ? `Last updated ${new Date(state.updatedAt).toLocaleString()}`
        : "Tournament ready — no results submitted yet";
}

async function request<T>(path: string, options?: RequestInit) {
    const response = await fetch(api.resolveUrl(path), {
        credentials: "include",
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Request failed");
    }
    return response.json() as Promise<T>;
}

async function load() {
    state = await request<TournamentState>("/api/tournament/");
    try {
        canEdit = (await request<{ canEdit: boolean }>("/api/tournament/permissions"))
            .canEdit;
    } catch {
        canEdit = false;
    }
    editMode = canEdit;
    const status = document.querySelector<HTMLElement>("#dev-status")!;
    status.hidden = !canEdit;
    status.textContent = canEdit ? "Edit mode ON - switch to predictions" : "";
    status.classList.toggle("enabled", canEdit);
    const predictionStatus = document.querySelector<HTMLElement>("#prediction-status")!;
    try {
        const data = await request<PredictionStatus>("/api/tournament/predictions");
        canPredict = true;
        predictions.clear();
        for (const pick of data.predictions)
            predictions.set(pick.matchId, pick.predictedPlayer);
        updatePredictionStatus(data.rewarded);
    } catch {
        canPredict = false;
        predictionStatus.textContent =
            "Sign in to predict every match for free and win 5,000 GP.";
    }
    render();
}

function openEditor(matchId: number) {
    const players = getTournamentPlayers(state, matchId);
    const result = state.matches[matchId];
    (document.querySelector("#editor-match-id") as HTMLInputElement).value =
        String(matchId);
    (document.querySelector("#editor-score-a") as HTMLInputElement).value =
        result.scoreA?.toString() ?? "";
    (document.querySelector("#editor-score-b") as HTMLInputElement).value =
        result.scoreB?.toString() ?? "";
    for (const id of ["editor-name-a", "editor-winner-a"])
        document.querySelector(`#${id}`)!.textContent = players[0] || "TBD";
    for (const id of ["editor-name-b", "editor-winner-b"])
        document.querySelector(`#${id}`)!.textContent = players[1] || "TBD";
    const winnerValue = result.winner === null ? "" : String(result.winner);
    form.querySelector<HTMLInputElement>(
        `input[name=winner][value="${winnerValue}"]`,
    )!.checked = true;
    document.querySelector("#editor-error")!.textContent = "";
    editor.hidden = false;
}

bracket.addEventListener("click", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".match");
    if (!card) return;
    const matchId = Number(card.dataset.matchId);
    if (editMode) openEditor(matchId);
    else if (canPredict && !predictions.has(matchId)) openPrediction(matchId);
});
document.querySelector("#dev-status")!.addEventListener("click", () => {
    if (!canEdit) return;
    editMode = !editMode;
    const status = document.querySelector("#dev-status")!;
    status.textContent = editMode
        ? "Edit mode ON - switch to predictions"
        : "Prediction mode - switch to editing";
    status.classList.toggle("enabled", editMode);
    render();
});
document.querySelector("#editor-close")!.addEventListener("click", () => {
    editor.hidden = true;
});
document.querySelector("#editor-cancel")!.addEventListener("click", () => {
    editor.hidden = true;
});
editor.addEventListener("click", (event) => {
    if (event.target === editor) editor.hidden = true;
});

function openPrediction(matchId: number) {
    const players = getTournamentPlayers(state, matchId);
    if (state.matches[matchId].winner !== null || !players[0] || !players[1]) return;
    predictionMatchId = matchId;
    const buttonA = document.querySelector<HTMLButtonElement>("#prediction-a")!;
    const buttonB = document.querySelector<HTMLButtonElement>("#prediction-b")!;
    buttonA.textContent = players[0];
    buttonB.textContent = players[1];
    buttonA.dataset.player = players[0];
    buttonB.dataset.player = players[1];
    document.querySelector("#prediction-error")!.textContent = "";
    predictionDialog.hidden = false;
}

async function lockPrediction(player: string) {
    if (predictionMatchId === null) return;
    const error = document.querySelector<HTMLElement>("#prediction-error")!;
    try {
        await request<{ success: true }>("/api/tournament/prediction", {
            method: "POST",
            body: JSON.stringify({ matchId: predictionMatchId, predictedPlayer: player }),
        });
        predictions.set(predictionMatchId, player);
        predictionDialog.hidden = true;
        updatePredictionStatus();
        render();
    } catch (caught) {
        error.textContent =
            caught instanceof Error ? caught.message : "Unable to lock prediction";
    }
}

document.querySelector("#prediction-close")!.addEventListener("click", () => {
    predictionDialog.hidden = true;
});
predictionDialog.addEventListener("click", (event) => {
    if (event.target === predictionDialog) predictionDialog.hidden = true;
});
for (const id of ["#prediction-a", "#prediction-b"]) {
    document.querySelector<HTMLButtonElement>(id)!.addEventListener("click", (event) => {
        void lockPrediction((event.currentTarget as HTMLButtonElement).dataset.player!);
    });
}

const roundNames = ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final"];

async function openPredictionStats() {
    const list = document.querySelector<HTMLElement>("#prediction-stats-list")!;
    predictionStatsDialog.hidden = false;
    list.innerHTML = '<div class="prediction-stats-loading">Loading predictions...</div>';
    try {
        const data = await request<{ matches: PredictionMatchStats[] }>(
            "/api/tournament/prediction-stats",
        );
        let previousRound = -1;
        const rows: string[] = [];
        for (const match of data.matches) {
            if (!match.players[0] || !match.players[1]) continue;
            const round = getTournamentRound(match.matchId);
            if (round !== previousRound) {
                rows.push(`<h3 class="prediction-stats-round">${roundNames[round]}</h3>`);
                previousRound = round;
            }
            const percentages = match.votes.map((votes) =>
                match.total > 0 ? Math.round((votes / match.total) * 100) : 0,
            );
            const tied = match.votes[0] === match.votes[1];
            const players = match.players
                .map((player, index) => {
                    const leader = !tied && match.votes[index] > match.votes[index ^ 1];
                    return `<div class="prediction-stat-player${leader ? " leader" : ""}"><span class="prediction-stat-name">${player}${leader ? " · Most Picked" : ""}</span><span class="prediction-stat-bar"><span style="width:${percentages[index]}%"></span></span><span class="prediction-stat-value">${match.votes[index]} · ${percentages[index]}%</span></div>`;
                })
                .join("");
            rows.push(
                `<section class="prediction-stat-match"><div class="prediction-stat-heading"><span>Match ${match.matchId + 1}</span><span>${match.total} total vote${match.total === 1 ? "" : "s"}</span></div>${players}</section>`,
            );
        }
        list.innerHTML =
            rows.join("") ||
            '<div class="prediction-stats-loading">No matchups are ready yet.</div>';
    } catch (error) {
        list.innerHTML = `<div class="prediction-stats-loading">${error instanceof Error ? error.message : "Unable to load prediction statistics"}</div>`;
    }
}

document.querySelector("#prediction-stats-button")!.addEventListener("click", () => {
    void openPredictionStats();
});
document.querySelector("#prediction-stats-close")!.addEventListener("click", () => {
    predictionStatsDialog.hidden = true;
});
predictionStatsDialog.addEventListener("click", (event) => {
    if (event.target === predictionStatsDialog) predictionStatsDialog.hidden = true;
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const matchId = Number(
        (document.querySelector("#editor-match-id") as HTMLInputElement).value,
    );
    const score = (id: string) => {
        const value = (document.querySelector(id) as HTMLInputElement).value;
        return value === "" ? null : Number(value);
    };
    const winnerRaw = new FormData(form).get("winner")?.toString() ?? "";
    const update: TournamentMatchResult & { matchId: number } = {
        matchId,
        scoreA: score("#editor-score-a"),
        scoreB: score("#editor-score-b"),
        winner: winnerRaw === "" ? null : (Number(winnerRaw) as 0 | 1),
    };
    try {
        state = await request<TournamentState>("/api/tournament/match", {
            method: "POST",
            body: JSON.stringify(update),
        });
        editor.hidden = true;
        render();
    } catch (error) {
        document.querySelector("#editor-error")!.textContent =
            error instanceof Error ? error.message : "Unable to save";
    }
});

load().catch((error) => {
    bracket.innerHTML = `<div class="loading">Could not load bracket: ${error instanceof Error ? error.message : "Unknown error"}</div>`;
});
