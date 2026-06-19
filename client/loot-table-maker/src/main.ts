import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { type MapDef, MapDefs } from "../../../shared/defs/mapDefs";
import type { LootSpawnDef } from "../../../shared/defs/mapObjectsTyping";
import "./styles.css";

type LootEntry = MapDef["lootTable"][string][number];
type LootTable = MapDef["lootTable"];

interface MakerDoc {
    schemaVersion: 2;
    mapName: string;
    lootTable: LootTable;
    customCrates: Record<string, LootSpawnDef[]>;
    testCrate: TestCrateDef;
}

interface TestCrateDef {
    name: string;
    minRolls: number;
    maxRolls: number;
}

interface RollResult {
    name: string;
    count: number;
    sourceTier: string;
    depth: number;
}

const STORAGE_KEY = "resurviv-loot-table-maker-doc";
const SAVES_KEY = "resurviv-loot-table-maker-saves";
const ALL_TIERS_MODE = "__all_tiers__";

const root = document.getElementById("loot-table-maker");
if (!root) throw new Error("Missing #loot-table-maker root");

const mapEntries = Object.entries(MapDefs).filter(([, map]) => map.lootTable);
const defaultMapName =
    mapEntries.find(([name]) => name === "main")?.[0] || mapEntries[0][0];
const allLootTable = createAllLootTable();
const itemNames = Object.entries(GameObjectDefs)
    .filter(([, def]) => "lootImg" in def)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

let doc = loadInitialDoc();
let selectedTier = Object.keys(doc.lootTable)[0] || "tier_world";
let lastRolls: RollResult[][] = [];

root.innerHTML = `
  <div class="maker-shell">
    <aside class="panel left-panel">
      <div class="panel-header">
        <h1>Loot Table Maker</h1>
        <select id="map-select" class="field"></select>
        <div class="toolbar">
          <button id="new-tier">New Tier</button>
          <button id="save-doc">Save</button>
          <button id="load-doc">Load</button>
        </div>
      </div>
      <div class="search-wrap">
        <input id="tier-search" class="field" placeholder="Search tiers">
      </div>
      <div class="tier-columns">
        <div class="tier-section-title">Edited tiers</div>
        <div id="edited-tier-list" class="tier-list edited-tier-list"></div>
        <div class="tier-section-title">Game tiers</div>
        <div id="source-tier-list" class="tier-list"></div>
      </div>
    </aside>

    <main class="workspace">
      <section class="top-bar">
        <div>
          <div class="eyebrow">Step 1 - edit a loot tier</div>
          <h2 id="tier-title"></h2>
        </div>
        <div class="toolbar">
          <button id="duplicate-tier">Duplicate</button>
          <button id="delete-tier" class="danger">Delete</button>
          <button id="import-doc">Import</button>
          <button id="export-doc" class="primary">Export</button>
        </div>
      </section>

      <section class="main-grid">
        <div class="card table-card">
          <div class="card-header">
            <div>
              <h3>Entries</h3>
              <p id="tier-summary"></p>
            </div>
            <button id="add-entry" class="primary">Add Entry</button>
          </div>
          <div class="entry-help">
            <span><strong>Name</strong> item or another tier to roll.</span>
            <span><strong>Count</strong> how many of that item drops when picked.</span>
            <span><strong>Weight</strong> higher number means more likely.</span>
          </div>
          <div class="entry-labels">
            <span>Name</span>
            <span>Count</span>
            <span>Weight</span>
            <span>Chance</span>
            <span></span>
          </div>
          <div id="entry-list" class="entry-list"></div>
        </div>

        <div class="side-stack">
          <div class="card crate-card">
            <div class="card-header">
              <div>
                <h3>Step 2 - test your crate</h3>
                <p>This crate uses the tier you are editing.</p>
              </div>
              <button id="run-test" class="primary">Run</button>
            </div>
            <div class="crate-form">
              <label>Test crate name<input id="test-crate-name" class="field" readonly title="This follows the tier you are editing"></label>
              <div class="two-fields">
                <label>Min loot drops<input id="test-crate-min" class="field small-number" type="number" min="0" step="1" title="Lowest number of loot drops this crate can make"><small>Lowest amount of loot this crate can spawn.</small></label>
                <label>Max loot drops<input id="test-crate-max" class="field small-number" type="number" min="0" step="1" title="Highest number of loot drops this crate can make"><small>Highest amount of loot this crate can spawn.</small></label>
              </div>
              <p class="crate-help">Click Run to break the crate once and see what loot comes out.</p>
            </div>
            <details class="spawn-details">
              <summary>Map spawn hints</summary>
              <div id="crate-spawns" class="spawn-report"></div>
            </details>
            <div id="roll-output" class="roll-output"></div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <datalist id="loot-name-options"></datalist>

  <div id="dialog-backdrop" class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <h2 id="dialog-title"></h2>
        <button id="dialog-close">Close</button>
      </div>
      <div id="dialog-body" class="dialog-body"></div>
      <div id="dialog-footer" class="dialog-footer"></div>
    </div>
  </div>
`;

const mapSelect = qs<HTMLSelectElement>("map-select");
const tierSearch = qs<HTMLInputElement>("tier-search");
const editedTierList = qs<HTMLDivElement>("edited-tier-list");
const sourceTierList = qs<HTMLDivElement>("source-tier-list");
const tierTitle = qs<HTMLHeadingElement>("tier-title");
const tierSummary = qs<HTMLParagraphElement>("tier-summary");
const entryList = qs<HTMLDivElement>("entry-list");
const lootNameOptions = qs<HTMLDataListElement>("loot-name-options");
const testCrateName = qs<HTMLInputElement>("test-crate-name");
const testCrateMin = qs<HTMLInputElement>("test-crate-min");
const testCrateMax = qs<HTMLInputElement>("test-crate-max");
const crateSpawns = qs<HTMLDivElement>("crate-spawns");
const rollOutput = qs<HTMLDivElement>("roll-output");

function qs<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
}

function loadInitialDoc(): MakerDoc {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return normalizeDoc(JSON.parse(saved));
    } catch (err) {
        console.warn("Failed to load Loot Table Maker doc", err);
    }
    return createDoc(defaultMapName);
}

function createDoc(mapName: string): MakerDoc {
    return {
        schemaVersion: 2,
        mapName,
        lootTable: {},
        customCrates: {},
        testCrate: defaultTestCrate(),
    };
}

function normalizeDoc(value: Partial<MakerDoc>): MakerDoc {
    const mapName =
        value.mapName === ALL_TIERS_MODE ||
        (value.mapName && MapDefs[value.mapName as keyof typeof MapDefs])
            ? value.mapName
            : defaultMapName;
    return {
        schemaVersion: 2,
        mapName,
        lootTable: value.schemaVersion === 2 ? cloneLootTable(value.lootTable || {}) : {},
        customCrates: value.customCrates || {},
        testCrate: normalizeTestCrate(value.testCrate),
    };
}

function defaultTestCrate(): TestCrateDef {
    return {
        name: "loot_crate_custom",
        minRolls: 1,
        maxRolls: 1,
    };
}

function normalizeTestCrate(value: Partial<TestCrateDef> | undefined): TestCrateDef {
    const fallback = defaultTestCrate();
    const oldMin = readNumber(
        (value as { min?: number } | undefined)?.min,
        fallback.minRolls,
    );
    const oldMax = readNumber(
        (value as { max?: number } | undefined)?.max,
        fallback.maxRolls,
    );
    const minRolls = Math.max(0, Math.floor(readNumber(value?.minRolls, oldMin)));
    const maxRolls = Math.max(minRolls, Math.floor(readNumber(value?.maxRolls, oldMax)));
    return {
        name: sanitizeKey(value?.name || fallback.name),
        minRolls,
        maxRolls,
    };
}

function cloneLootTable(table: LootTable): LootTable {
    return Object.fromEntries(
        lootTableEntries(table).map(([tier, entries]) => [
            tier,
            entries.map((entry) => ({ ...entry })),
        ]),
    );
}

function createAllLootTable(): LootTable {
    const table: LootTable = {};
    for (const [, map] of mapEntries) {
        for (const [tier, entries] of lootTableEntries(map.lootTable)) {
            table[tier] ||= entries.map((entry) => ({ ...entry }));
        }
    }
    return table;
}

function lootTableEntries(table: LootTable): [string, LootEntry[]][] {
    return Object.entries(table) as [string, LootEntry[]][];
}

function getSourceLootTable(): LootTable {
    if (doc.mapName === ALL_TIERS_MODE) return allLootTable;
    return MapDefs[doc.mapName as keyof typeof MapDefs]?.lootTable || allLootTable;
}

function getSelectedEntries(): LootEntry[] | undefined {
    return doc.lootTable[selectedTier] || getSourceLootTable()[selectedTier];
}

function ensureEditedTier(): LootEntry[] {
    if (!selectedTier) {
        selectedTier = "tier_new";
        doc.lootTable[selectedTier] = [];
    }
    doc.lootTable[selectedTier] ||= (getSourceLootTable()[selectedTier] || []).map(
        (entry) => ({ ...entry }),
    );
    return doc.lootTable[selectedTier];
}

function saveWorkingDoc() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

function setupControls() {
    mapSelect.innerHTML =
        `<option value="${ALL_TIERS_MODE}">All tiers - every map</option>` +
        mapEntries
            .map(
                ([name, map]) =>
                    `<option value="${escapeAttr(name)}">${escapeHtml(name)} - ${escapeHtml(map.desc.name)}</option>`,
            )
            .join("");
    mapSelect.value = doc.mapName;
    mapSelect.addEventListener("change", () => {
        if (
            !confirm(
                "Load this map's current loot table? Unsaved edits stay in local saves only.",
            )
        ) {
            mapSelect.value = doc.mapName;
            return;
        }
        doc = createDoc(mapSelect.value);
        selectedTier = Object.keys(getSourceLootTable())[0] || "";
        saveWorkingDoc();
        render();
    });

    tierSearch.addEventListener("input", renderTierList);

    qs<HTMLButtonElement>("new-tier").addEventListener("click", newTier);
    qs<HTMLButtonElement>("duplicate-tier").addEventListener("click", duplicateTier);
    qs<HTMLButtonElement>("delete-tier").addEventListener("click", deleteTier);
    qs<HTMLButtonElement>("add-entry").addEventListener("click", () =>
        addEntry({ name: "", count: 1, weight: 1 }),
    );
    qs<HTMLButtonElement>("save-doc").addEventListener("click", saveNamedDoc);
    qs<HTMLButtonElement>("load-doc").addEventListener("click", openLoadDialog);
    qs<HTMLButtonElement>("import-doc").addEventListener("click", openImportDialog);
    qs<HTMLButtonElement>("export-doc").addEventListener("click", openExportDialog);
    qs<HTMLButtonElement>("run-test").addEventListener("click", () => {
        syncTestCrate();
        lastRolls = [rollTestCrate()];
        renderRollOutput();
    });
    qs<HTMLButtonElement>("dialog-close").addEventListener("click", closeDialog);
    for (const input of [testCrateMin, testCrateMax]) {
        input.addEventListener("change", () => {
            syncTestCrate();
            commit();
        });
    }
}

function syncTestCrate() {
    const minRolls = Math.max(
        0,
        Math.floor(readNumber(testCrateMin.value, doc.testCrate.minRolls)),
    );
    const maxRolls = Math.max(
        minRolls,
        Math.floor(readNumber(testCrateMax.value, doc.testCrate.maxRolls)),
    );
    doc.testCrate = {
        name: selectedTier || doc.testCrate.name,
        minRolls,
        maxRolls,
    };
    doc.customCrates[doc.testCrate.name] = [
        { tier: selectedTier, min: doc.testCrate.minRolls, max: doc.testCrate.maxRolls },
    ];
    saveWorkingDoc();
}

function useSelectedTierForTest() {
    if (selectedTier)
        doc.customCrates[doc.testCrate.name] = [
            {
                tier: selectedTier,
                min: doc.testCrate.minRolls,
                max: doc.testCrate.maxRolls,
            },
        ];
}

function render() {
    mapSelect.value = doc.mapName;
    if (!getSelectedEntries())
        selectedTier =
            Object.keys(doc.lootTable)[0] || Object.keys(getSourceLootTable())[0] || "";
    updateDefaultCrateName();
    useSelectedTierForTest();
    renderLootNameOptions();
    renderTierList();
    renderTierEditor();
    renderCratePanel();
}

function updateDefaultCrateName() {
    if (!selectedTier) return;
    doc.testCrate.name = selectedTier;
}

function renderTierList() {
    const query = tierSearch.value.trim().toLowerCase();
    const editedTiers = Object.keys(doc.lootTable)
        .filter((tier) => tier.toLowerCase().includes(query))
        .sort((a, b) => a.localeCompare(b));
    const sourceTiers = Object.keys(getSourceLootTable())
        .filter((tier) => tier.toLowerCase().includes(query))
        .sort((a, b) => a.localeCompare(b));

    editedTierList.innerHTML = editedTiers.length
        ? editedTiers
              .map((tier) => tierButton(tier, doc.lootTable[tier], "edited"))
              .join("")
        : `<div class="empty compact">Nothing edited yet.</div>`;
    sourceTierList.innerHTML = sourceTiers
        .map((tier) =>
            tierButton(
                tier,
                getSourceLootTable()[tier],
                doc.lootTable[tier] ? "edited copy" : "game",
            ),
        )
        .join("");

    for (const list of [editedTierList, sourceTierList]) {
        list.querySelectorAll<HTMLButtonElement>("[data-tier]").forEach((button) => {
            button.addEventListener("click", () => {
                selectedTier = button.dataset.tier || selectedTier;
                lastRolls = [];
                render();
            });
        });
    }
    editedTierList
        .querySelectorAll<HTMLButtonElement>("[data-delete-tier]")
        .forEach((button) => {
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                const tier = button.dataset.deleteTier || "";
                if (!tier || !confirm(`Remove edits for ${tier}?`)) return;
                delete doc.lootTable[tier];
                if (selectedTier === tier)
                    selectedTier =
                        Object.keys(doc.lootTable)[0] ||
                        Object.keys(getSourceLootTable())[0] ||
                        "";
                commit();
            });
        });
}

function tierButton(tier: string, entries: LootEntry[], label: string): string {
    const total = totalWeight(entries);
    const deleteButton =
        label === "edited"
            ? `<button class="tier-delete danger" data-delete-tier="${escapeAttr(tier)}" title="Delete edited tier">Delete</button>`
            : "";
    return `<div class="tier-row-wrap">
                <button class="tier-row ${tier === selectedTier ? "active" : ""}" data-tier="${escapeAttr(tier)}">
                    <span>${escapeHtml(tier)}</span>
                    <small>${escapeHtml(label)} - ${entries.length} entries, ${formatNum(total)} weight</small>
                </button>
                ${deleteButton}
            </div>`;
}

function renderTierEditor() {
    const entries = getSelectedEntries() || [];
    const isEdited = Boolean(doc.lootTable[selectedTier]);
    tierTitle.textContent = selectedTier || "No tier selected";
    tierSummary.textContent = `${isEdited ? "Editing" : "Previewing game tier"} - ${entries.length} entries, ${formatNum(totalWeight(entries))} total weight`;
    entryList.innerHTML = entries.length
        ? entries.map(entryRow).join("")
        : `<div class="empty">This tier has no entries yet.</div>`;

    entryList.querySelectorAll<HTMLElement>("[data-index]").forEach((row) => {
        const index = Number(row.dataset.index);
        row.querySelector<HTMLInputElement>("[data-field=name]")?.addEventListener(
            "change",
            (event) => {
                const editable = ensureEditedTier();
                const nextName = (event.currentTarget as HTMLInputElement).value.trim();
                if (nextName && !isKnownLootName(nextName)) {
                    alert(`${nextName} does not exist in the game.`);
                    (event.currentTarget as HTMLInputElement).value =
                        editable[index].name;
                    return;
                }
                editable[index].name = nextName;
                commit();
            },
        );
        for (const field of ["count", "weight"] as const) {
            row.querySelector<HTMLInputElement>(
                `[data-field=${field}]`,
            )?.addEventListener("change", (event) => {
                ensureEditedTier()[index][field] = readNumber(
                    (event.currentTarget as HTMLInputElement).value,
                    field === "count" ? 1 : 0,
                );
                commit();
            });
        }
        row.querySelector<HTMLButtonElement>("[data-move=up]")?.addEventListener(
            "click",
            () => moveEntry(index, -1),
        );
        row.querySelector<HTMLButtonElement>("[data-move=down]")?.addEventListener(
            "click",
            () => moveEntry(index, 1),
        );
        row.querySelector<HTMLButtonElement>("[data-delete]")?.addEventListener(
            "click",
            () => {
                ensureEditedTier().splice(index, 1);
                commit();
            },
        );
    });
}

function entryRow(entry: LootEntry, index: number): string {
    const entries = getSelectedEntries() || [];
    const chance =
        totalWeight(entries) > 0 ? (entry.weight / totalWeight(entries)) * 100 : 0;
    return `<div class="entry-row" data-index="${index}">
        <input class="field" data-field="name" list="loot-name-options" value="${escapeAttr(entry.name)}" placeholder="item_or_tier" title="Item name, or another tier name like tier_world">
        <input class="field number" data-field="count" type="number" min="0" step="1" value="${formatNum(entry.count)}" title="How many drops you get if this entry is picked">
        <input class="field number" data-field="weight" type="number" min="0" step="0.001" value="${formatNum(entry.weight)}" title="How likely this entry is compared to the other weights">
        <span class="chance">${formatNum(chance)}%</span>
        <button data-move="up" title="Move up">Up</button>
        <button data-move="down" title="Move down">Down</button>
        <button data-delete class="danger" title="Delete">Delete</button>
    </div>`;
}

function renderLootNameOptions() {
    const names = [
        ...new Set([
            ...Object.keys(allLootTable),
            ...Object.keys(getSourceLootTable()),
            ...Object.keys(doc.lootTable),
            ...itemNames,
        ]),
    ].sort((a, b) => a.localeCompare(b));
    lootNameOptions.innerHTML = names
        .map((name) => `<option value="${escapeAttr(name)}"></option>`)
        .join("");
}

function isKnownLootName(name: string): boolean {
    return Boolean(
        allLootTable[name] ||
            doc.lootTable[name] ||
            GameObjectDefs[name as keyof typeof GameObjectDefs],
    );
}

function renderCratePanel() {
    testCrateName.value = doc.testCrate.name;
    testCrateMin.value = String(doc.testCrate.minRolls);
    testCrateMax.value = String(doc.testCrate.maxRolls);
    crateSpawns.innerHTML =
        spawnReport(doc.testCrate.name)
            .map((line) => `<div>${escapeHtml(line)}</div>`)
            .join("") || `<div>No existing spawn uses this crate name yet.</div>`;
    renderRollOutput();
}

function renderRollOutput() {
    if (!lastRolls.length) {
        rollOutput.innerHTML = `<div class="empty">No test run yet.</div>`;
        return;
    }
    if (lastRolls.length === 1) {
        const roll = lastRolls[0];
        rollOutput.innerHTML = roll.length
            ? roll
                  .map(
                      (item) =>
                          `<div class="roll-item depth-${Math.min(item.depth, 4)}"><strong>${escapeHtml(item.name || "(empty)")}</strong><span>x${item.count} from ${escapeHtml(item.sourceTier)}</span></div>`,
                  )
                  .join("")
            : `<div class="empty">Nothing dropped.</div>`;
        return;
    }

    const summary = new Map<string, number>();
    for (const roll of lastRolls) {
        for (const item of roll) {
            if (!item.name) continue;
            summary.set(item.name, (summary.get(item.name) || 0) + item.count);
        }
    }
    rollOutput.innerHTML =
        [...summary.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(
                ([name, count]) =>
                    `<div class="roll-item"><strong>${escapeHtml(name)}</strong><span>${formatNum(count / lastRolls.length)} avg/run, ${count} total</span></div>`,
            )
            .join("") || `<div class="empty">Runs only dropped empty results.</div>`;
}

function addEntry(entry: LootEntry) {
    if (!selectedTier) newTier();
    ensureEditedTier().push({ ...entry });
    commit();
}

function moveEntry(index: number, dir: number) {
    const entries = ensureEditedTier();
    const nextIndex = index + dir;
    if (!entries || nextIndex < 0 || nextIndex >= entries.length) return;
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);
    commit();
}

function newTier() {
    const name = prompt("Tier name", "tier_new");
    if (!name) return;
    const key = sanitizeKey(name);
    if (doc.lootTable[key] || getSourceLootTable()[key]) {
        alert("That tier already exists.");
        return;
    }
    doc.lootTable[key] = [];
    selectedTier = key;
    commit();
}

function duplicateTier() {
    if (!selectedTier) return;
    const name = prompt("Duplicate as", `${selectedTier}_copy`);
    if (!name) return;
    const key = sanitizeKey(name);
    if (doc.lootTable[key] || getSourceLootTable()[key]) {
        alert("That tier already exists.");
        return;
    }
    doc.lootTable[key] = (getSelectedEntries() || []).map((entry) => ({ ...entry }));
    selectedTier = key;
    commit();
}

function deleteTier() {
    if (
        !selectedTier ||
        !doc.lootTable[selectedTier] ||
        !confirm(`Remove edits for ${selectedTier}?`)
    )
        return;
    delete doc.lootTable[selectedTier];
    selectedTier = getSelectedEntries()
        ? selectedTier
        : Object.keys(doc.lootTable)[0] || Object.keys(getSourceLootTable())[0] || "";
    commit();
}

function commit() {
    saveWorkingDoc();
    render();
}

function rollTestCrate(): RollResult[] {
    const output: RollResult[] = [];
    const rolls = randomInt(doc.testCrate.minRolls, doc.testCrate.maxRolls);
    for (let i = 0; i < rolls; i++) {
        const item = rollTier(selectedTier, 0, new Set<string>());
        if (item) output.push(item);
    }
    return output;
}

function rollTier(
    tier: string,
    depth: number,
    visited: Set<string>,
): RollResult | undefined {
    if (visited.has(tier))
        return { name: "(recursive tier)", count: 1, sourceTier: tier, depth };
    visited.add(tier);
    const entries =
        doc.lootTable[tier] || getSourceLootTable()[tier] || allLootTable[tier];
    if (!entries?.length)
        return { name: "(missing tier)", count: 1, sourceTier: tier, depth };
    const picked = weightedPick(entries);
    if (!picked) return undefined;
    if (picked.name.startsWith("tier_")) return rollTier(picked.name, depth + 1, visited);
    return { name: picked.name, count: picked.count, sourceTier: tier, depth };
}

function weightedPick(entries: LootEntry[]): LootEntry | undefined {
    const total = totalWeight(entries);
    if (total <= 0) return entries[0];
    let rng = Math.random() * total;
    for (const entry of entries) {
        rng -= Math.max(0, entry.weight);
        if (rng <= 0) return entry;
    }
    return entries.at(-1);
}

function spawnReport(crateName: string): string[] {
    if (doc.mapName === ALL_TIERS_MODE)
        return ["Pick a specific map to see spawn hints."];
    const mapDef = MapDefs[doc.mapName as keyof typeof MapDefs];
    const lines: string[] = [];
    const density = mapDef.mapGen?.densitySpawns?.[0]?.[crateName];
    if (density !== undefined) lines.push(`Density spawn: ${formatSpawnValue(density)}`);
    const fixed = mapDef.mapGen?.fixedSpawns?.[0]?.[crateName];
    if (fixed !== undefined) lines.push(`Fixed spawn: ${formatSpawnValue(fixed)}`);
    for (const random of mapDef.mapGen?.randomSpawns || []) {
        if (random.spawns.includes(crateName))
            lines.push(
                `Random group: choose ${random.choose} from ${random.spawns.join(", ")}`,
            );
    }
    const replacement = mapDef.mapGen?.spawnReplacements?.[0]?.[crateName];
    if (replacement) lines.push(`Replacement: ${crateName} becomes ${replacement}`);
    return lines;
}

function formatSpawnValue(value: unknown): string {
    if (typeof value === "number") return String(value);
    return JSON.stringify(value);
}

function saveNamedDoc() {
    const saves = loadSaves();
    const name = `${doc.mapName}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;
    saves[name] = { savedAt: Date.now(), doc };
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    saveWorkingDoc();
    alert(`Saved ${name}`);
}

function loadSaves(): Record<string, { savedAt: number; doc: MakerDoc }> {
    try {
        return JSON.parse(localStorage.getItem(SAVES_KEY) || "{}");
    } catch (_err) {
        return {};
    }
}

function openLoadDialog() {
    const saves = loadSaves();
    const rows = Object.entries(saves)
        .sort(([, a], [, b]) => b.savedAt - a.savedAt)
        .map(
            ([name, save]) => `<div class="save-row">
            <div><strong>${escapeHtml(name)}</strong><small>${new Date(save.savedAt).toLocaleString()}</small></div>
            <button data-load="${escapeAttr(name)}">Load</button>
            <button data-delete="${escapeAttr(name)}" class="danger">Delete</button>
        </div>`,
        )
        .join("");
    openDialog("Local Saves", rows || `<div class="empty">No saves yet.</div>`, "");
    document.querySelectorAll<HTMLButtonElement>("[data-load]").forEach((button) => {
        button.addEventListener("click", () => {
            const save = saves[button.dataset.load || ""];
            if (!save) return;
            doc = normalizeDoc(save.doc);
            selectedTier = Object.keys(doc.lootTable)[0] || "";
            closeDialog();
            commit();
        });
    });
    document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
        button.addEventListener("click", () => {
            delete saves[button.dataset.delete || ""];
            localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
            openLoadDialog();
        });
    });
}

function openImportDialog() {
    openDialog(
        "Import Loot Table",
        `<textarea id="import-code" class="textarea" placeholder="Paste exported Maker JSON or a lootTable object"></textarea>`,
        `<button id="run-import" class="primary">Import</button>`,
    );
    qs<HTMLButtonElement>("run-import").addEventListener("click", () => {
        const raw = qs<HTMLTextAreaElement>("import-code").value.trim();
        try {
            const parsed = JSON.parse(raw);
            if (parsed.schemaVersion === 2) {
                doc = normalizeDoc(parsed);
            } else {
                doc.lootTable = { ...doc.lootTable, ...cloneLootTable(parsed) };
            }
            selectedTier =
                Object.keys(doc.lootTable)[0] ||
                Object.keys(getSourceLootTable())[0] ||
                "";
            closeDialog();
            commit();
        } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
        }
    });
}

function openExportDialog() {
    const currentTier = getSelectedEntries() || [];
    const text = JSON.stringify({ [selectedTier]: currentTier }, null, 2);
    const ts = `${selectedTier}: ${formatLootEntries(currentTier)},\n\n// Add this to your crate obstacle loot if you want this exact test crate:\nloot: ${formatCrateLoot()},`;
    openDialog(
        `Export ${selectedTier}`,
        `<textarea id="export-json" class="textarea" spellcheck="false">${escapeHtml(text)}</textarea>
        <textarea id="export-ts" class="textarea short" spellcheck="false">${escapeHtml(ts)}</textarea>`,
        `<button id="copy-export" class="primary">Copy JSON</button><button id="copy-ts">Copy TS snippet</button>`,
    );
    qs<HTMLButtonElement>("copy-export").addEventListener("click", () =>
        navigator.clipboard?.writeText(text),
    );
    qs<HTMLButtonElement>("copy-ts").addEventListener("click", () =>
        navigator.clipboard?.writeText(ts),
    );
}

function formatCrateLoot(): string {
    return `[{ tier: "${selectedTier}", min: ${doc.testCrate.minRolls}, max: ${doc.testCrate.maxRolls} }]`;
}

function formatLootTable(table: LootTable): string {
    const lines = ["{"];
    for (const [tier, entries] of lootTableEntries(table).sort(([a], [b]) =>
        a.localeCompare(b),
    )) {
        lines.push(`    ${tier}: [`);
        for (const entry of entries) {
            lines.push(
                `        { name: "${entry.name}", count: ${formatNum(entry.count)}, weight: ${formatNum(entry.weight)} },`,
            );
        }
        lines.push("    ],");
    }
    lines.push("}");
    return lines.join("\n");
}

function formatLootEntries(entries: LootEntry[]): string {
    return `[\n${entries
        .map(
            (entry) =>
                `        { name: "${entry.name}", count: ${formatNum(entry.count)}, weight: ${formatNum(entry.weight)} },`,
        )
        .join("\n")}\n    ]`;
}

function openDialog(title: string, body: string, footer: string) {
    qs<HTMLHeadingElement>("dialog-title").textContent = title;
    qs<HTMLDivElement>("dialog-body").innerHTML = body;
    qs<HTMLDivElement>("dialog-footer").innerHTML = footer;
    qs<HTMLDivElement>("dialog-backdrop").classList.add("active");
}

function closeDialog() {
    qs<HTMLDivElement>("dialog-backdrop").classList.remove("active");
}

function totalWeight(entries: LootEntry[]): number {
    return entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
}

function readNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sanitizeKey(value: string): string {
    return value.trim().replace(/[^a-zA-Z0-9_]/g, "_") || "tier_new";
}

function formatNum(value: number): string {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (char) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
                char
            ] || char,
    );
}

function escapeAttr(value: string): string {
    return escapeHtml(value);
}

setupControls();
render();
