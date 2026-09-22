import { api } from "./api";

type Account = { slug: string; username: string };
let nextId = 0;

/** Combobox suggestions use real accounts; selecting always fills the exact slug. */
export function attachSlugSuggestions(
    input: HTMLInputElement,
    usedSlugs: () => string[],
) {
    const wrapper = document.createElement("div");
    wrapper.className = "slug-picker";
    input.replaceWith(wrapper);
    wrapper.append(input);
    const list = document.createElement("div");
    list.className = "slug-suggestions";
    list.id = `slug-suggestions-${++nextId}`;
    list.role = "listbox";
    list.setAttribute("aria-label", "Matching game accounts");
    list.hidden = true;
    wrapper.append(list);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    let timer = 0;
    let controller: AbortController | undefined;
    let version = 0;
    let players: Account[] = [];
    let active = -1;

    function close() {
        window.clearTimeout(timer);
        controller?.abort();
        version++;
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        players = [];
        active = -1;
    }
    function message(text: string) {
        const status = document.createElement("p");
        status.className = "slug-suggestion-status";
        status.role = "status";
        status.textContent = text;
        list.replaceChildren(status);
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
    }
    function select(index: number) {
        const player = players[index];
        if (!player || input.matches(":disabled")) return;
        input.value = player.slug;
        close();
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    async function search(query: string, current: number) {
        controller = new AbortController();
        const abort = controller;
        const timeout = window.setTimeout(() => abort.abort(), 10000);
        message("Searching accounts...");
        try {
            const response = await fetch(
                api.resolveUrl("/api/competitive/editor/players"),
                {
                    method: "POST",
                    credentials: "include",
                    signal: abort.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query }),
                },
            );
            if (!response.ok) throw new Error("Search failed");
            const data = (await response.json()) as { players: Account[] };
            if (
                current !== version ||
                !input.isConnected ||
                document.activeElement !== input ||
                input.matches(":disabled")
            )
                return;
            const used = new Set(usedSlugs());
            players = data.players.filter((player) => !used.has(player.slug));
            if (!players.length) {
                message("No available accounts match.");
                return;
            }
            list.replaceChildren(
                ...players.map((player, i) => {
                    const option = document.createElement("button");
                    option.type = "button";
                    option.role = "option";
                    option.tabIndex = -1;
                    option.id = `${list.id}-${i}`;
                    option.setAttribute("aria-selected", "false");
                    const name = document.createElement("strong");
                    name.textContent = player.username || player.slug;
                    const slug = document.createElement("small");
                    slug.textContent = `@${player.slug}`;
                    option.append(name, slug);
                    option.addEventListener("pointerdown", (event) =>
                        event.preventDefault(),
                    );
                    option.addEventListener("click", () => select(i));
                    return option;
                }),
            );
        } catch {
            if (current === version && document.activeElement === input)
                message("Suggestions unavailable. You can still enter the exact slug.");
        } finally {
            window.clearTimeout(timeout);
        }
    }
    function schedule() {
        close();
        const query = input.value.trim();
        if (query.length < 2) return;
        const current = version;
        timer = window.setTimeout(() => void search(query, current), 200);
    }
    input.addEventListener("input", schedule);
    input.addEventListener("focus", schedule);
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (event) => {
        if (event.isComposing || list.hidden) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (players.length) select(active < 0 ? 0 : active);
        } else if (
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            players.length
        ) {
            event.preventDefault();
            active =
                active < 0
                    ? event.key === "ArrowDown"
                        ? 0
                        : players.length - 1
                    : (active + (event.key === "ArrowDown" ? 1 : -1) + players.length) %
                      players.length;
            Array.from(list.children).forEach((option, i) =>
                option.setAttribute("aria-selected", String(i === active)),
            );
            const selected = list.children[active];
            input.setAttribute("aria-activedescendant", selected.id);
            selected.scrollIntoView({ block: "nearest" });
        }
    });
    return close;
}
