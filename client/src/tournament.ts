import {
    getTournamentPlayers,
    type TournamentMatchResult,
    type TournamentState,
} from "../../shared/types/tournament";
import { api } from "./api";

const leftRounds = [[0, 1, 2, 3, 4, 5, 6, 7], [16, 17, 18, 19], [24, 25], [28]];
const rightRounds = [[29], [26, 27], [20, 21, 22, 23], [8, 9, 10, 11, 12, 13, 14, 15]];
let state: TournamentState;
let canEdit = false;
const bracket = document.querySelector<HTMLElement>("#bracket")!;
const editor = document.querySelector<HTMLElement>("#editor-backdrop")!;
const form = document.querySelector<HTMLFormElement>("#match-editor")!;

function playerRow(name: string | null, score: number | null, winner: boolean) {
    return `<div class="player${winner ? " winner" : ""}${name ? "" : " tbd"}"><span class="player-name">${name || "To be decided"}</span><span class="score">${score ?? "—"}</span></div>`;
}

function matchCard(matchId: number) {
    const result = state.matches[matchId];
    const players = getTournamentPlayers(state, matchId);
    return `<article class="match${canEdit ? " editable" : ""}" data-match-id="${matchId}" title="${canEdit ? "Edit score and winner" : "Matchup"}">${playerRow(players[0], result.scoreA, result.winner === 0)}${playerRow(players[1], result.scoreB, result.winner === 1)}</article>`;
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
    const status = document.querySelector<HTMLElement>("#dev-status")!;
    status.hidden = !canEdit;
    status.textContent = canEdit ? "Developer editing enabled" : "";
    status.classList.toggle("enabled", canEdit);
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
    if (!canEdit) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>(".match");
    if (card) openEditor(Number(card.dataset.matchId));
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
