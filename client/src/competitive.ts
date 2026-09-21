import { EmotesDefs } from "../../shared/defs/gameObjects/emoteDefs";
import type { CompetitiveBoard } from "../../shared/types/competitive";
import { api } from "./api";

type Player = CompetitiveBoard["players"][number];
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
const seasonSelect = el<HTMLSelectElement>("season");
const search = el<HTMLInputElement>("player-search");
const refresh = el<HTMLButtonElement>("refresh");
const newer = el<HTMLButtonElement>("newer");
const older = el<HTMLButtonElement>("older");
let board: CompetitiveBoard | undefined;
let selectedSlug = "";
let pending: AbortController | undefined;

function node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function updateURL(values: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
}

function selectPlayer(player?: Player, save = true) {
    selectedSlug = player?.slug ?? "";
    el("player-empty").hidden = !!player;
    el("player-detail").hidden = !player;
    document.querySelectorAll<HTMLButtonElement>(".contender").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.slug === selectedSlug));
    });
    if (!player || !board) return;
    if (save) updateURL({ player: player.slug });
    const winRate = player.games ? (player.stats.wins / player.games) * 100 : 0;
    const icon = el<HTMLImageElement>("player-icon");
    const texture = EmotesDefs[player.playerIcon]?.texture;
    const fallback = "/img/gui/player-gui.svg";
    icon.onerror = () => {
        icon.onerror = null;
        icon.src = fallback;
    };
    icon.src = texture ? `/img/emotes/${texture.slice(0, -4)}.svg` : fallback;
    el("player-name").textContent = player.username;
    el("player-slug").textContent = `@${player.slug}`;
    el("player-status").textContent =
        player.rank === null
            ? "PROVISIONAL PLAYER"
            : `#${player.rank} IN ${board.season.name.toUpperCase()}`;
    el("stat-games").textContent = player.games.toLocaleString();
    el("stat-wins").textContent = player.stats.wins.toLocaleString();
    el("stat-draws").textContent = player.stats.draws.toLocaleString();
    el("stat-losses").textContent = player.stats.losses.toLocaleString();
    el("stat-placement").textContent = player.stats.averagePlacement.toFixed(1);
    el("stat-rating").textContent = player.rating.toLocaleString();
    el("stat-win-rate").textContent = `${Math.round(winRate)}%`;
    el("win-ring").style.setProperty("--win-rate", `${winRate}%`);
    el("spotlight-name").textContent = player.username;
    el<HTMLAnchorElement>("player-profile").href =
        `/stats/?slug=${encodeURIComponent(player.slug)}`;
    el("rating-note").textContent =
        player.rank === null
            ? `${Math.max(0, board.placementGames - player.games)} more rated ${board.placementGames - player.games === 1 ? "match" : "matches"} to earn a rank. Your rating is provisional until then.`
            : "Stats cover this season’s accepted results. Wins and placements are team results; voided matches do not count.";
    highlightMatches();
}

function renderStandings() {
    if (!board) return;
    const query = search.value.trim().toLocaleLowerCase();
    const players = board.players.filter((player) =>
        `${player.slug} ${player.username}`.toLocaleLowerCase().includes(query),
    );
    const rows = players.map((player) => {
        const button = node("button", "contender");
        button.type = "button";
        button.dataset.slug = player.slug;
        button.dataset.rank = String(player.rank ?? "provisional");
        button.setAttribute("aria-pressed", String(player.slug === selectedSlug));
        button.setAttribute("aria-controls", "player-detail");
        button.setAttribute(
            "aria-label",
            `${player.rank === null ? "Provisional" : `Rank ${player.rank}`}, ${player.username}, ${player.rating} WHR. View player stats.`,
        );
        const rank = node(
            "span",
            `contender-rank${player.rank === null ? " provisional" : ""}`,
            player.rank === null ? "PROV." : `#${player.rank}`,
        );
        const name = node("span", "contender-name", player.username);
        if (player.username !== player.slug)
            name.append(node("small", "", `@${player.slug}`));
        const rating = node("span", "contender-rating", player.rating.toLocaleString());
        button.append(rank, name, rating);
        button.addEventListener("click", () => selectPlayer(player));
        return button;
    });
    if (rows.length) el("standings-list").replaceChildren(...rows);
    else
        el("standings-list").replaceChildren(
            node(
                "p",
                "empty-list",
                query
                    ? "No players match your search."
                    : "No rated players yet. Join a referee hosted rated match to get started.",
            ),
        );
}

function highlightMatches() {
    if (!board) return;
    const player = board.players.find((player) => player.slug === selectedSlug);
    const relevant = new Set(
        board.matches
            .filter((match) => match.teams.some((team) => team.includes(selectedSlug)))
            .map((match) => match.id),
    );
    el("match-list")
        .querySelectorAll<HTMLElement>(".match-card")
        .forEach((card) => {
            const included = relevant.has(card.dataset.matchId!);
            card.classList.toggle("is-selected", included);
            const label = card.querySelector<HTMLElement>(".match-selected-player")!;
            label.hidden = !included;
            label.textContent = player ? `Includes ${player.username}` : "";
        });
}

function renderMatches() {
    if (!board) return;
    const names = new Map(board.players.map((player) => [player.slug, player.username]));
    const dateFormat = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
    const cards = board.matches.map((match) => {
        const teamNames = match.teams.map((team) =>
            team.map((slug) => names.get(slug) ?? slug).join(" & "),
        );
        const scores = match.scores;
        const ranks = match.teams.map((_, i) =>
            scores ? 1 + scores.filter((score) => score > scores[i]).length : i + 1,
        );
        const order = match.teams.map((_, i) => i).sort((a, b) => ranks[a] - ranks[b]);
        const winners = order.filter((i) => ranks[i] === 1);
        const tied = winners.length > 1;
        const voided = match.voidReason !== null;
        const duel = match.teams.length === 2;
        const solo = match.teams.every((team) => team.length === 1);
        const format = duel
            ? `${match.teams[0].length}v${match.teams[1].length}`
            : `${match.teams.length} ${solo ? "players" : "teams"}`;
        const headline = voided
            ? duel
                ? `${teamNames[0]} vs ${teamNames[1]}`
                : `${format} · Voided match`
            : duel
              ? `${teamNames[order[0]]} ${tied ? "drew with" : "defeated"} ${teamNames[order[1]]}`
              : tied
                ? `${winners.length} ${solo ? "players" : "teams"} tied for first`
                : `${teamNames[order[0]]} won`;
        const card = node("details", `match-card${voided ? " is-void" : ""}`);
        card.dataset.matchId = match.id;
        const summary = node("summary", "match-summary");
        const time = node(
            "time",
            "match-date",
            dateFormat.format(new Date(`${match.playedOn}T00:00:00Z`)),
        );
        time.dateTime = match.playedOn;
        const result = node("div", "match-result");
        const meta = node("div", "match-meta");
        meta.append(
            node("span", "", `${format} · ${scores ? "Score" : "Finishing order"}`),
            node("span", "match-selected-player"),
        );
        result.append(node("h3", "", headline), meta);
        const score = node("div", "match-score");
        score.append(
            node(
                "strong",
                "",
                voided
                    ? "Voided"
                    : duel && scores
                      ? order.map((i) => scores[i]).join(" – ")
                      : tied
                        ? "Draw"
                        : "1st place",
            ),
            node(
                "small",
                "",
                voided ? "Not counted" : duel && scores ? "Final score" : "Final result",
            ),
        );
        summary.append(time, result, score, node("span", "match-expand", "Details"));
        const body = node("div", "match-body");
        body.append(
            node(
                "p",
                "match-explanation",
                voided
                    ? "This match does not affect ratings or player stats."
                    : scores
                      ? "Highest score wins. Players on the same row are teammates."
                      : "Teams are listed in finishing order, from first to last.",
            ),
        );
        const labels = node("div", "match-team-labels");
        labels.append(
            node("span", "", "Place"),
            node("span", "", solo ? "Player" : "Team"),
            node("span", "", scores ? "Score" : ""),
        );
        const teams = node("ol", "match-teams");
        for (const i of order) {
            const row = node("li", !voided && ranks[i] === 1 ? "is-winner" : "");
            row.append(
                node(
                    "span",
                    "match-place",
                    `${ranks.filter((rank) => rank === ranks[i]).length > 1 ? "=" : ""}#${ranks[i]}`,
                ),
                node("span", "", teamNames[i]),
                node("strong", "", scores ? String(scores[i]) : ""),
            );
            teams.append(row);
        }
        body.append(labels, teams);
        if (voided)
            body.append(node("p", "match-void-reason", `Voided: ${match.voidReason}`));
        const id = node("code", "", `Match ID: ${match.id}`);
        body.append(id);
        card.append(summary, body);
        return card;
    });
    el("match-list").replaceChildren(
        ...(cards.length
            ? cards
            : [node("p", "empty-list", "No recorded matches on this page yet.")]),
    );
    el("match-page").textContent = board.matches.length
        ? `Matches ${board.matchOffset + 1}–${board.matchOffset + board.matches.length}`
        : "No results";
    newer.disabled = board.matchOffset === 0;
    older.disabled = !board.hasMoreMatches;
    highlightMatches();
}

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(api.resolveUrl(url), { signal });
    if (!response.ok) throw new Error("Could not load competitive standings.");
    return response.json();
}

async function load() {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const params = new URLSearchParams(window.location.search);
    const query = new URLSearchParams();
    for (const key of ["season", "offset"])
        if (params.has(key)) query.set(key, params.get(key)!);
    const status = el("load-status");
    status.textContent = "Loading competitive standings…";
    status.classList.remove("error");
    status.hidden = false;
    status.setAttribute("role", "status");
    el("competition").hidden = true;
    el("match-section").hidden = true;
    seasonSelect.disabled = true;
    refresh.disabled = true;
    refresh.textContent = "↻ Refresh";
    try {
        const [result, seasons] = await Promise.all([
            request<CompetitiveBoard>(`/api/competitive?${query}`, controller.signal),
            request<{ id: number; name: string }[]>(
                "/api/competitive/seasons",
                controller.signal,
            ),
        ]);
        if (pending !== controller) return;
        board = result;
        seasonSelect.replaceChildren(
            ...seasons.map((season) => {
                const option = node("option", "", season.name);
                option.value = String(season.id);
                option.selected = season.id === result.season.id;
                return option;
            }),
        );
        updateURL({ season: String(result.season.id) });
        el("player-count").textContent =
            `${result.players.length.toLocaleString()} ${result.players.length === 1 ? "player" : "players"}`;
        el("last-updated").textContent = result.updatedAt
            ? `UPDATED ${new Date(result.updatedAt).toLocaleString()}`
            : "AWAITING THE FIRST RESULT";
        selectedSlug = params.get("player") ?? "";
        const selected =
            result.players.find((player) => player.slug === selectedSlug) ??
            result.players[0];
        selectedSlug = selected?.slug ?? "";
        renderStandings();
        selectPlayer(selected, false);
        renderMatches();
        status.hidden = true;
        el("competition").hidden = false;
        el("match-section").hidden = false;
    } catch {
        if (pending !== controller) return;
        board = undefined;
        status.classList.add("error");
        status.setAttribute("role", "alert");
        status.textContent = "The standings couldn’t be loaded. Try again in a moment.";
        refresh.textContent = "↻ Try again";
    } finally {
        window.clearTimeout(timeout);
        if (pending === controller) {
            refresh.disabled = false;
            seasonSelect.disabled = !board;
        }
    }
}

seasonSelect.addEventListener("change", () => {
    updateURL({ season: seasonSelect.value, offset: null, player: null });
    search.value = "";
    void load();
});
search.addEventListener("input", renderStandings);
refresh.addEventListener("click", () => void load());
newer.addEventListener("click", () => {
    if (!board) return;
    updateURL({ offset: String(Math.max(0, board.matchOffset - 25)) });
    void load();
});
older.addEventListener("click", () => {
    if (!board) return;
    updateURL({ offset: String(board.matchOffset + 25) });
    void load();
});
window.addEventListener("popstate", () => void load());
void load();
