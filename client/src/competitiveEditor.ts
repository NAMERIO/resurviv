import {
    type CompetitiveBoard,
    competitivePlaces,
    zCompetitiveWebMatch,
} from "../../shared/types/competitive";
import { api } from "./api";
import { attachSlugSuggestions } from "./competitiveSlugSuggestions";

type Match = CompetitiveBoard["matches"][number];
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
type TeamDraft = { slugs: string[]; result: string };

class EditorError extends Error {
    constructor(
        message: string,
        readonly status = 0,
    ) {
        super(message);
    }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(api.resolveUrl(path), {
        credentials: "include",
        signal: AbortSignal.timeout(body ? 120000 : 15000),
        ...(body
            ? {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
              }
            : {}),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = null;
    }
    if (!response.ok)
        throw new EditorError(data?.error ?? text ?? "Request failed.", response.status);
    if (!data)
        throw new EditorError("Could not confirm the saved result. Retry the request.");
    return data as T;
}

export function createCompetitiveEditor(options: {
    board: () => CompetitiveBoard | undefined;
    currentSeason: () => number | undefined;
    onToggle: () => void;
    onSaved: () => Promise<void>;
}) {
    const toggle = el<HTMLButtonElement>("dev-status");
    const tools = el("dev-tools");
    const add = el<HTMLButtonElement>("add-result");
    const dialog = el<HTMLDialogElement>("whr-editor");
    const form = el<HTMLFormElement>("whr-editor-form");
    const fields = el<HTMLFieldSetElement>("editor-fields");
    const mode = el<HTMLSelectElement>("editor-mode");
    const count = el<HTMLSelectElement>("editor-team-count");
    const size = el<HTMLSelectElement>("editor-team-size");
    const date = el<HTMLInputElement>("editor-date");
    const reason = el<HTMLTextAreaElement>("editor-void-reason");
    const error = el("editor-error");
    const save = el<HTMLButtonElement>("editor-save");
    const close = el<HTMLButtonElement>("editor-close");
    let canEdit = false;
    let enabled = false;
    let match: Match | undefined;
    let voiding = false;
    let seasonId = 0;
    let busy = false;
    let winnerTeam: number | undefined;
    let closeSuggestions: (() => void)[] = [];
    let submission: { path: string; body: unknown } | undefined;

    for (let i = 2; i <= 32; i++) count.add(new Option(String(i), String(i)));
    for (let i = 1; i <= 4; i++) size.add(new Option(String(i), String(i)));

    function update() {
        toggle.hidden = !canEdit;
        toggle.textContent = enabled ? "Dev mode ON" : "Dev mode OFF";
        toggle.setAttribute("aria-pressed", String(enabled));
        toggle.classList.toggle("enabled", enabled);
        tools.hidden = !canEdit || !enabled;
        const board = options.board();
        add.disabled = !board || board.season.id !== options.currentSeason();
        el("dev-help").textContent = add.disabled
            ? "Select the current season to add results. Existing results can be corrected below."
            : "Add results or open a match's Details to correct or void it.";
    }
    async function refreshAccess() {
        try {
            canEdit = (
                await request<{ canEdit: boolean }>("/api/competitive/permissions")
            ).canEdit;
        } catch {
            canEdit = false;
        }
        if (!canEdit) enabled = false;
        update();
        options.onToggle();
    }
    function readTeams(): TeamDraft[] {
        return Array.from(
            el("editor-teams").querySelectorAll<HTMLFieldSetElement>(".editor-team"),
        ).map((team) => ({
            slugs: Array.from(
                team.querySelectorAll<HTMLInputElement>(".editor-slug"),
            ).map((input) => input.value.trim()),
            result: team.querySelector<HTMLInputElement>(".editor-result")!.value,
        }));
    }
    function renderWinner() {
        const container = el("editor-winner-options");
        container.replaceChildren();
        el("editor-outcome").hidden = mode.value !== "deathmatch";
        if (mode.value !== "deathmatch") {
            winnerTeam = undefined;
            return;
        }
        const teams = readTeams();
        const help = el("editor-outcome-help");
        if (winnerTeam !== undefined && winnerTeam >= teams.length)
            winnerTeam = undefined;
        const name = (i: number) =>
            teams[i].slugs.filter(Boolean).join(" + ") || `Team ${i + 1}`;
        help.textContent =
            "Select the match winner, even if they had fewer kills, or choose Draw. WHR still uses the entered scores.";
        for (const index of [...teams.map((_, i) => i), -1]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "text-button";
            button.textContent = index === -1 ? "Draw" : name(index);
            button.setAttribute("aria-pressed", String(winnerTeam === index));
            button.addEventListener("click", () => {
                winnerTeam = index;
                for (const option of Array.from(container.children))
                    option.setAttribute("aria-pressed", String(option === button));
            });
            container.append(button);
        }
    }
    function renderTeams(drafts: TeamDraft[] = readTeams()) {
        closeSuggestions.forEach((close) => close());
        closeSuggestions = [];
        const teams = Array.from({ length: Number(count.value) }, (_, teamIndex) => {
            const team = document.createElement("fieldset");
            team.className = "editor-team";
            const legend = document.createElement("legend");
            legend.textContent = `Team ${teamIndex + 1}`;
            team.append(legend);
            for (let i = 0; i < Number(size.value); i++) {
                const label = document.createElement("label");
                label.append(`Player ${i + 1} game slug`);
                const input = document.createElement("input");
                input.className = "editor-slug";
                input.required = true;
                input.maxLength = 100;
                input.placeholder = "Exact slug from their profile URL";
                input.autocomplete = "off";
                input.spellcheck = false;
                input.value = drafts[teamIndex]?.slugs[i] ?? "";
                label.append(input);
                closeSuggestions.push(
                    attachSlugSuggestions(input, () =>
                        Array.from(
                            el("editor-teams").querySelectorAll<HTMLInputElement>(
                                ".editor-slug",
                            ),
                        )
                            .filter((other) => other !== input)
                            .map((other) => other.value.trim()),
                    ),
                );
                team.append(label);
            }
            const label = document.createElement("label");
            label.append(mode.value === "deathmatch" ? "Team score" : "Finishing place");
            const input = document.createElement("input");
            input.type = "number";
            input.className = "editor-result";
            input.required = true;
            input.min = mode.value === "deathmatch" ? "0" : "1";
            input.max = mode.value === "deathmatch" ? "1000" : count.value;
            input.step = "1";
            input.value = drafts[teamIndex]?.result ?? "";
            label.append(input);
            team.append(label);
            return team;
        });
        el("editor-teams").replaceChildren(...teams);
        renderWinner();
    }
    function open(target?: Match, isVoid = false) {
        const board = options.board();
        if (
            !enabled ||
            !canEdit ||
            !board ||
            (target?.voidReason !== null && target !== undefined)
        )
            return;
        if (!target && board.season.id !== options.currentSeason()) return;
        match = target;
        seasonId = board.season.id;
        voiding = isVoid;
        submission = undefined;
        fields.disabled = false;
        error.textContent = "";
        reason.value = "";
        reason.required = voiding;
        el("editor-void-fields").hidden = !voiding;
        el("editor-result-fields").hidden = voiding;
        el("editor-title").textContent = voiding
            ? "Void Result"
            : target
              ? "Correct Result"
              : "Add Result";
        el("editor-help").textContent = voiding
            ? "This result will stop counting toward ratings. It will remain visible with your reason."
            : target
              ? "Save a corrected result. The previous result stays in the history as voided."
              : `Record a match in ${board.season.name}. Fill in every team below, then save once.`;
        save.textContent = voiding ? "Void result" : "Save result";
        mode.value = target && !target.scores ? "battle_royale" : "deathmatch";
        count.value = String(target?.teams.length ?? 2);
        size.value = String(target?.teams[0].length ?? 1);
        date.max = new Date().toISOString().slice(0, 10);
        date.value = target?.playedOn ?? date.max;
        winnerTeam = undefined;
        if (target?.scores) {
            const places = competitivePlaces(target);
            winnerTeam =
                target.winnerTeam ??
                (places.filter((place) => place === 1).length === 1
                    ? places.indexOf(1)
                    : -1);
        }
        renderTeams(
            target?.teams.map((slugs, i) => ({
                slugs,
                result: String(target.scores?.[i] ?? i + 1),
            })) ?? [],
        );
        // Hidden controls must not participate in native form validation.
        el<HTMLFieldSetElement>("editor-result-fields").disabled = voiding;
        el<HTMLFieldSetElement>("editor-void-fields").disabled = !voiding;
        dialog.showModal();
    }
    function closeEditor() {
        if (busy || submission) return;
        dialog.close();
    }
    toggle.addEventListener("click", () => {
        enabled = !enabled && canEdit;
        update();
        options.onToggle();
    });
    add.addEventListener("click", () => open());
    close.addEventListener("click", closeEditor);
    dialog.addEventListener("close", () => closeSuggestions.forEach((close) => close()));
    dialog.addEventListener("cancel", (event) => {
        if (busy || submission) event.preventDefault();
    });
    el("editor-teams").addEventListener("input", renderWinner);
    el("editor-teams").addEventListener("change", renderWinner);
    count.addEventListener("change", () => {
        winnerTeam = undefined;
        renderTeams();
    });
    size.addEventListener("change", () => {
        winnerTeam = undefined;
        renderTeams();
    });
    mode.addEventListener("change", () =>
        renderTeams(readTeams().map((team) => ({ ...team, result: "" }))),
    );
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !canEdit || !enabled || !form.reportValidity()) return;
        error.textContent = "";
        try {
            if (!submission) {
                if (voiding)
                    submission = {
                        path: "/api/competitive/editor/void",
                        body: { matchId: match!.id, reason: reason.value.trim() },
                    };
                else {
                    let teams = readTeams();
                    if (mode.value === "deathmatch" && winnerTeam === undefined)
                        throw new Error("Select who won or choose Draw before saving.");
                    if (mode.value === "battle_royale") {
                        if (
                            new Set(teams.map((team) => Number(team.result))).size !==
                            teams.length
                        )
                            throw new Error(
                                "Each team needs a different finishing place.",
                            );
                        teams = teams.sort((a, b) => Number(a.result) - Number(b.result));
                    }
                    const parsed = zCompetitiveWebMatch.safeParse({
                        teams: teams.map((team) => team.slugs),
                        scores:
                            mode.value === "deathmatch"
                                ? teams.map((team) => Number(team.result))
                                : undefined,
                        winnerTeam: mode.value === "deathmatch" ? winnerTeam : undefined,
                        playedOn: date.value,
                        seasonId,
                        matchId: match?.id,
                        requestId: crypto.randomUUID(),
                    });
                    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
                    submission = {
                        path: "/api/competitive/editor/result",
                        body: parsed.data,
                    };
                }
            }
            busy = true;
            closeSuggestions.forEach((close) => close());
            fields.disabled = true;
            save.disabled = close.disabled = true;
            save.textContent = "Saving...";
            await request(submission.path, submission.body);
            submission = undefined;
            dialog.close();
            await options.onSaved();
        } catch (failure) {
            const knownFailure =
                failure instanceof EditorError &&
                failure.status >= 400 &&
                failure.status < 500;
            if (knownFailure) submission = undefined;
            if (
                failure instanceof EditorError &&
                (failure.status === 401 || failure.status === 403)
            ) {
                canEdit = enabled = false;
                update();
                options.onToggle();
            }
            error.textContent = submission
                ? "Could not confirm the save. Retry below with the same result to avoid a duplicate."
                : failure instanceof Error
                  ? failure.message
                  : "Could not save the result.";
        } finally {
            busy = false;
            fields.disabled = close.disabled = !!submission;
            save.disabled = !canEdit;
            save.textContent = submission
                ? "Retry save"
                : voiding
                  ? "Void result"
                  : "Save result";
        }
    });
    return {
        update,
        refreshAccess,
        decorate(container: HTMLElement, entry: Match) {
            if (!canEdit || !enabled || entry.voidReason !== null) return;
            const actions = document.createElement("div");
            actions.className = "match-editor-actions";
            for (const [label, isVoid] of [
                ["Edit result", false],
                ["Void result", true],
            ] as const) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "text-button";
                button.textContent = label;
                button.addEventListener("click", () => open(entry, isVoid));
                actions.append(button);
            }
            container.append(actions);
        },
    };
}
