import { MapObjectDefs } from "../../../shared/defs/mapObjectDefs";
import type { MapObjectDef, ObstacleDef } from "../../../shared/defs/mapObjectsTyping";
import type { BuildingDef, FloorImage } from "../../../shared/defs/types/building";
import { GameConfig } from "../../../shared/gameConfig";
import { collider } from "../../../shared/utils/collider";
import type { AABB, Circle, Collider } from "../../../shared/utils/coldet";
import { generateTerrain } from "../../../shared/utils/terrainGen";
import { v2, type Vec2 } from "../../../shared/utils/v2";
import { SharedAtlas } from "../../atlas-builder/defs/shared";
import "./styles.css";

const PPU = 16;
const STORAGE_KEY = "resurviv-building-maker-doc";
const SAVES_KEY = "resurviv-building-maker-saves";
const HISTORY_LIMIT = 80;
const MIN_CAMERA_ZOOM = 0.04;
const MAX_CAMERA_ZOOM = 12;
const DEFAULT_SCOPE = "1xscope";
const scopeOrder = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"] as const;
// Matches deathmatch/main terrain without importing server map data stripped from production clients.
const editorMapColors = {
    background: 0x20536e,
    water: 0x3282ab,
    beach: 0xcdb35b,
    riverbank: 0x905e24,
    grass: 0x80af49,
    underground: 0x1b0d03,
} as const;
const editorMapConfig = {
    baseWidth: 225,
    baseHeight: 225,
    scale: 1.28125,
    extension: 112,
    shoreInset: 20,
    grassInset: 10,
} as const;
const gameUndergroundColor = editorMapColors.underground;
const editorMap = createEditorMapEnvironment();

const layerOrder = [
    "basementFloor",
    "floor",
    "walls",
    "objects",
    "basement",
    "roof",
    "hitboxes",
] as const;

const layerLabels: Record<LayerId, string> = {
    floor: "Normal floor",
    roof: "Roof",
    basement: "Basement",
    basementFloor: "Basement floor",
    walls: "Walls",
    objects: "Objects",
    hitboxes: "Hitboxes",
};

const paletteCategories = [
    "all",
    "floors",
    "walls",
    "doors",
    "windows",
    "roof",
    "basement",
    "objects",
] as const;

type LayerId = (typeof layerOrder)[number];
type PaletteCategory = (typeof paletteCategories)[number];
type EditorMode = "base" | "roof" | "basement" | "preview";
type ItemKind =
    | "floor"
    | "roof"
    | "wall"
    | "door"
    | "window"
    | "object"
    | "basementWall"
    | "basementObject"
    | "basementFloor"
    | "hitbox";

interface LayerState {
    visible: boolean;
    locked: boolean;
}

interface EditorItem {
    id: string;
    name: string;
    kind: ItemKind;
    layer: LayerId;
    type?: string;
    sprite?: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    assetScale: number;
    fallbackWidth: number;
    fallbackHeight: number;
    alpha: number;
    tint: number;
    surfaceType?: string;
    ignoreMapSpawnReplacement?: boolean;
    localCollider?: Collider;
}

interface EditorDoc {
    schemaVersion: 1;
    name: string;
    terrain: {
        grass: boolean;
        beach: boolean;
    };
    mapColor: number;
    zIdx: number;
    gridSize: number;
    snapToGrid: boolean;
    layers: Record<LayerId, LayerState>;
    items: EditorItem[];
}

interface PaletteEntry {
    id: string;
    name: string;
    category: PaletteCategory;
    kind: ItemKind;
    layer: LayerId;
    type?: string;
    sprite?: string;
    assetScale: number;
    fallbackWidth: number;
    fallbackHeight: number;
    localCollider?: Collider;
}

interface ImageState {
    img: HTMLImageElement;
    loaded: boolean;
    failed: boolean;
}

interface CameraState {
    x: number;
    y: number;
    zoom: number;
}

interface PointerState {
    x: number;
    y: number;
    world: Vec2;
}

type DragState =
    | {
          type: "pan";
          startX: number;
          startY: number;
          camera: CameraState;
      }
    | {
          type: "move";
          startWorld: Vec2;
          originals: Array<{ id: string; x: number; y: number }>;
      }
    | {
          type: "rotate";
          itemId: string;
      }
    | {
          type: "select";
          start: Vec2;
          current: Vec2;
      };

interface PreviewState {
    pos: Vec2;
    dir: Vec2;
    speed: number;
    radius: number;
}

interface EditorMapEnvironment {
    width: number;
    height: number;
    shoreInset: number;
    grassInset: number;
    seed: number;
    terrain: ReturnType<typeof generateTerrain>;
}

const root = document.getElementById("building-maker");

if (!root) {
    throw new Error("Missing #building-maker root");
}

root.innerHTML = `
  <div id="maker-shell" class="maker-shell">
    <aside id="asset-panel" class="maker-panel left">
      <div class="panel-header">
        <h1 class="panel-title">Building Maker</h1>
        <div class="search-row">
          <input id="asset-search" class="text-field" placeholder="Search assets or object names">
          <button id="clear-search" class="tool-button" title="Clear search">Clear</button>
        </div>
        <div class="category-filter">
          <select id="asset-category" class="select-field" aria-label="Filter assets by category">
            <option value="all">All items</option>
            <option value="floors">Floors</option>
            <option value="walls">Walls</option>
            <option value="doors">Doors</option>
            <option value="windows">Windows</option>
            <option value="roof">Roof</option>
            <option value="basement">Basement</option>
            <option value="objects">Objects</option>
          </select>
        </div>
      </div>
      <div class="panel-scroll">
        <div id="asset-list" class="asset-list"></div>
      </div>
    </aside>

    <main class="stage">
      <div class="canvas-wrap">
        <canvas id="maker-canvas"></canvas>
        <div class="screen-ui top-left-ui">
          <button id="toggle-assets" class="tool-button panel-toggle active" title="Show or hide the asset browser">Assets</button>
          <input id="building-name" class="text-field name-field" aria-label="Building name">
        </div>
        <div class="screen-ui top-right-ui">
          <button id="toggle-inspector" class="tool-button panel-toggle active" title="Show or hide the inspector">Inspector</button>
          <button id="export" class="tool-button primary">Export</button>
          <button id="preview" class="tool-button primary">Playtest</button>
        </div>
        <div class="screen-ui bottom-left-ui">
          <div class="segmented" id="mode-tabs" aria-label="Editor mode">
            <button data-mode="base" class="active">Base</button>
            <button data-mode="roof">Roof</button>
            <button data-mode="basement">Basement</button>
          </div>
          <div class="segmented" id="scope-tabs" aria-label="Scope zoom">
            <button data-scope="1xscope" class="active">1x</button>
            <button data-scope="2xscope">2x</button>
            <button data-scope="4xscope">4x</button>
            <button data-scope="8xscope">8x</button>
            <button data-scope="15xscope">15x</button>
          </div>
        </div>
        <div class="screen-ui bottom-right-ui">
          <button id="zoom-out" class="tool-button" title="Zoom out">-</button>
          <button id="zoom-reset" class="tool-button">100%</button>
          <button id="zoom-in" class="tool-button" title="Zoom in">+</button>
        </div>
        <div id="preview-banner" class="preview-banner">
          <span>Preview mode</span>
          <button id="exit-preview" class="tool-button">Exit Preview</button>
        </div>
      </div>

      <div class="status-bar">
        <span id="status-left"></span>
        <span id="status-right"></span>
      </div>
    </main>

    <aside id="inspector-panel" class="maker-panel right">
      <div class="panel-header">
        <h2 class="panel-title">Inspector</h2>
        <p class="panel-subtitle">Selected parts export with their hidden layers; locks only affect editing.</p>
      </div>
      <div class="panel-scroll">
        <div class="section">
          <div class="section-header">
            <div class="section-title">File</div>
          </div>
          <div class="section-body button-grid file-grid">
            <button id="new-doc" class="mini-button">New</button>
            <button id="import" class="mini-button">Import</button>
            <button id="local-save" class="mini-button">Save</button>
            <button id="local-load" class="mini-button">Load</button>
          </div>
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-title">Edit</div>
          </div>
          <div class="section-body">
            <div class="button-grid">
              <button id="undo" class="mini-button" title="Undo">Undo</button>
              <button id="redo" class="mini-button" title="Redo">Redo</button>
              <button id="duplicate" class="mini-button" title="Duplicate selected">Duplicate</button>
              <button id="delete" class="mini-button danger" title="Delete selected">Delete</button>
            </div>
            <div class="field-grid tool-field-grid">
              <label class="check-row compact-check">
                <span>Snap</span>
                <input id="snap-toggle" type="checkbox">
              </label>
              <div class="field">
                <label for="grid-size">Grid</label>
                <input id="grid-size" class="number-field" type="number" min="0.25" step="0.25" aria-label="Grid size">
              </div>
            </div>
          </div>
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-title">Layers</div>
          </div>
          <div id="layers-panel" class="section-body"></div>
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-title">Selection</div>
          </div>
          <div id="selection-panel" class="section-body"></div>
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-title">Alignment</div>
          </div>
          <div class="section-body button-grid">
            <button id="align-left" class="mini-button">Left</button>
            <button id="align-center" class="mini-button">Center</button>
            <button id="align-right" class="mini-button">Right</button>
            <button id="align-top" class="mini-button">Top</button>
            <button id="align-middle" class="mini-button">Middle</button>
            <button id="align-bottom" class="mini-button">Bottom</button>
          </div>
        </div>
        <div class="section">
          <div class="section-header">
            <div class="section-title">Safety Checks</div>
          </div>
          <div class="section-body">
            <ul id="warning-list" class="warning-list"></ul>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <div id="dialog-backdrop" class="dialog-backdrop">
    <div class="maker-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="dialog-header">
        <h2 id="dialog-title" class="dialog-title"></h2>
        <button id="dialog-close" class="tool-button">Close</button>
      </div>
      <div id="dialog-body" class="dialog-body"></div>
      <div id="dialog-footer" class="dialog-footer"></div>
    </div>
  </div>
`;

const canvas = document.getElementById("maker-canvas") as HTMLCanvasElement;
const canvasContext = canvas.getContext("2d");

if (!canvasContext) {
    throw new Error("Building Maker needs a 2D canvas context");
}

const ctx: CanvasRenderingContext2D = canvasContext;

let viewWidth = 1;
let viewHeight = 1;
let canvasDpr = 0;
let activeCategory: PaletteCategory = "all";
let mode: EditorMode = "base";
let idCounter = 1;
let doc = loadInitialDoc();
let history: string[] = [serializeDoc(doc)];
let historyIndex = 0;
let selectedIds = new Set<string>();
let dragState: DragState | null = null;
let pointer: PointerState = { x: 0, y: 0, world: v2.create(0, 0) };
let camera: CameraState = { x: 0, y: 0, zoom: scopeToCameraZoom(DEFAULT_SCOPE) };
let activeScope = DEFAULT_SCOPE;
let preview: PreviewState | null = null;
let spaceDown = false;
let lastFrameTime = performance.now();

const imageCache = new Map<string, ImageState>();
const palette = buildPalette();
const spriteSpawnOptions = buildSpriteSpawnOptions();

const buildingNameInput = document.getElementById("building-name") as HTMLInputElement;
const assetSearch = document.getElementById("asset-search") as HTMLInputElement;
const assetCategorySelect = document.getElementById("asset-category") as HTMLSelectElement;
const gridSizeInput = document.getElementById("grid-size") as HTMLInputElement;
const snapToggle = document.getElementById("snap-toggle") as HTMLInputElement;
const statusLeft = document.getElementById("status-left") as HTMLSpanElement;
const statusRight = document.getElementById("status-right") as HTMLSpanElement;
const previewBanner = document.getElementById("preview-banner") as HTMLDivElement;
const makerShell = document.getElementById("maker-shell") as HTMLDivElement;

function defaultLayers(): Record<LayerId, LayerState> {
    return {
        floor: { visible: true, locked: false },
        roof: { visible: true, locked: false },
        basement: { visible: true, locked: false },
        basementFloor: { visible: true, locked: false },
        walls: { visible: true, locked: false },
        objects: { visible: true, locked: false },
        hitboxes: { visible: true, locked: false },
    };
}

function createEmptyDoc(): EditorDoc {
    return {
        schemaVersion: 1,
        name: "new_building_01",
        terrain: {
            grass: true,
            beach: true,
        },
        mapColor: 0x6b6b6b,
        zIdx: 1,
        gridSize: 1,
        snapToGrid: true,
        layers: defaultLayers(),
        items: [],
    };
}

function loadInitialDoc(): EditorDoc {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return normalizeDoc(JSON.parse(saved));
        }
    } catch (err) {
        console.warn("Failed to load Building Maker document", err);
    }
    return createEmptyDoc();
}

function normalizeDoc(value: Partial<EditorDoc>): EditorDoc {
    const base = createEmptyDoc();
    return {
        ...base,
        ...value,
        terrain: {
            ...base.terrain,
            ...value.terrain,
        },
        layers: {
            ...base.layers,
            ...value.layers,
        },
        items: Array.isArray(value.items) ? value.items.map(normalizeItem) : [],
    };
}

function normalizeItem(item: Partial<EditorItem>): EditorItem {
    const fallbackWidth = item.fallbackWidth ?? 4;
    const fallbackHeight = item.fallbackHeight ?? 4;
    return {
        id: item.id || makeId("item"),
        name: item.name || item.type || item.sprite || "part",
        kind: item.kind || "object",
        layer: item.layer || "objects",
        type: item.type,
        sprite: item.sprite,
        x: finite(item.x, 0),
        y: finite(item.y, 0),
        rotation: finite(item.rotation, 0),
        scale: finite(item.scale, 1),
        assetScale: finite(item.assetScale, 1),
        fallbackWidth,
        fallbackHeight,
        alpha: finite(item.alpha, 1),
        tint: finite(item.tint, 0xffffff),
        surfaceType: item.surfaceType,
        ignoreMapSpawnReplacement: item.ignoreMapSpawnReplacement,
        localCollider: item.localCollider || createAabbCollider(fallbackWidth, fallbackHeight),
    };
}

function finite(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function serializeDoc(value: EditorDoc): string {
    return JSON.stringify(value);
}

function saveWorkingDoc() {
    localStorage.setItem(STORAGE_KEY, serializeDoc(doc));
}

function makeId(prefix: string): string {
    idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function createAabbCollider(width: number, height: number): AABB {
    return collider.createAabbExtents(v2.create(0, 0), v2.create(width / 2, height / 2));
}

function createEditorMapEnvironment(): EditorMapEnvironment {
    const width = editorMapConfig.baseWidth * editorMapConfig.scale + editorMapConfig.extension;
    const height = editorMapConfig.baseHeight * editorMapConfig.scale + editorMapConfig.extension;
    const seed = 218051654;

    return {
        width,
        height,
        shoreInset: editorMapConfig.shoreInset,
        grassInset: editorMapConfig.grassInset,
        seed,
        terrain: generateTerrain(
            width,
            height,
            editorMapConfig.shoreInset,
            editorMapConfig.grassInset,
            [],
            seed,
        ),
    };
}

function buildPalette(): PaletteEntry[] {
    const entries: PaletteEntry[] = [
        {
            id: "quick-floor-surface",
            name: "floor_surface",
            category: "floors",
            kind: "floor",
            layer: "floor",
            assetScale: 1,
            fallbackWidth: 16,
            fallbackHeight: 12,
            localCollider: createAabbCollider(16, 12),
        },
        {
            id: "quick-collision-box",
            name: "collision_box",
            category: "floors",
            kind: "hitbox",
            layer: "hitboxes",
            assetScale: 1,
            fallbackWidth: 8,
            fallbackHeight: 4,
            localCollider: createAabbCollider(8, 4),
        },
    ];
    const seenSprites = new Set<string>();

    addSharedAtlasSpriteEntries(entries, seenSprites);

    for (const [name, def] of Object.entries(MapObjectDefs as Record<string, MapObjectDef>)) {
        if (def.type === "obstacle") {
            const obstacle = def as ObstacleDef;
            const sprite = obstacle.img?.sprite;
            const collisionSize = fallbackSizeFromCollider(obstacle.collision);
            const classification = classifyObstacle(name, obstacle);
            entries.push({
                id: `object-${name}`,
                name,
                category: classification.category,
                kind: classification.kind,
                layer: classification.layer,
                type: name,
                sprite,
                assetScale: obstacle.img?.scale ?? 1,
                fallbackWidth: collisionSize.width,
                fallbackHeight: collisionSize.height,
                localCollider: obstacle.collision,
            });
        } else if (def.type === "decal") {
            const decal = def as MapObjectDef & {
                img?: { sprite?: string; scale?: number };
            };
            entries.push({
                id: `decal-${name}`,
                name,
                category: "objects",
                kind: "object",
                layer: "objects",
                type: name,
                sprite: decal.img?.sprite,
                assetScale: decal.img?.scale ?? 1,
                fallbackWidth: 4,
                fallbackHeight: 4,
            });
        } else if (def.type === "loot_spawner") {
            entries.push({
                id: `loot-${name}`,
                name,
                category: "objects",
                kind: "object",
                layer: "objects",
                type: name,
                assetScale: 1,
                fallbackWidth: 2,
                fallbackHeight: 2,
            });
        } else if (def.type === "building") {
            const building = def as BuildingDef;
            for (const img of building.floor?.imgs || []) {
                addImageEntry(entries, seenSprites, img, "floor");
            }
            for (const img of building.ceiling?.imgs || []) {
                addImageEntry(entries, seenSprites, img, "roof");
            }
        }
    }

    return entries.sort((a, b) => {
        const cat = paletteCategories.indexOf(a.category) - paletteCategories.indexOf(b.category);
        return cat || a.name.localeCompare(b.name);
    });
}

function buildSpriteSpawnOptions(): PaletteEntry[] {
    const bySprite = new Map<string, PaletteEntry>();

    for (const entry of palette) {
        if (!entry.sprite || entry.sprite === "none" || bySprite.has(entry.sprite)) {
            continue;
        }
        bySprite.set(entry.sprite, {
            ...entry,
            id: `spawn-sprite-${entry.sprite}`,
            name: entry.sprite,
            type: undefined,
        });
    }

    return Array.from(bySprite.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function addSharedAtlasSpriteEntries(entries: PaletteEntry[], seenSprites: Set<string>) {
    for (const sourcePath of SharedAtlas.images) {
        const imageRole = classifyBuildingSpritePath(sourcePath);

        if (imageRole) {
            addImageEntry(
                entries,
                seenSprites,
                {
                    sprite: sourcePathToGameSprite(sourcePath),
                    scale: 0.5,
                    alpha: 1,
                    tint: 0xffffff,
                },
                imageRole,
            );
            continue;
        }

        addRawSpriteEntry(entries, seenSprites, sourcePath);
    }
}

function classifyBuildingSpritePath(sourcePath: string): "floor" | "roof" | null {
    const lower = sourcePath.toLowerCase();
    if (lower.includes("ceiling")) return "roof";
    if (lower.includes("floor")) return "floor";
    return null;
}

function sourcePathToGameSprite(sourcePath: string): string {
    const fileName = sourcePath.split("/").pop() || sourcePath;
    return fileName.replace(/\.(svg|png)$/i, ".img");
}

function addRawSpriteEntry(
    entries: PaletteEntry[],
    seenSprites: Set<string>,
    sourcePath: string,
) {
    const sprite = sourcePathToGameSprite(sourcePath);
    if (!sprite || seenSprites.has(`object:${sprite}`)) {
        return;
    }

    seenSprites.add(`object:${sprite}`);
    const basement = sprite.toLowerCase().includes("basement");
    entries.push({
        id: `sprite-${sprite}`,
        name: sprite,
        category: basement ? "basement" : "objects",
        kind: basement ? "basementObject" : "object",
        layer: basement ? "basement" : "objects",
        sprite,
        assetScale: 0.5,
        fallbackWidth: 4,
        fallbackHeight: 4,
        localCollider: createAabbCollider(4, 4),
    });
}

function addImageEntry(
    entries: PaletteEntry[],
    seenSprites: Set<string>,
    img: FloorImage,
    imageRole: "floor" | "roof",
) {
    if (!img.sprite || img.sprite === "none" || seenSprites.has(`${imageRole}:${img.sprite}`)) {
        return;
    }
    seenSprites.add(`${imageRole}:${img.sprite}`);
    const basement = img.sprite.toLowerCase().includes("basement");
    entries.push({
        id: `${imageRole}-${img.sprite}`,
        name: img.sprite,
        category: basement ? "basement" : imageRole === "roof" ? "roof" : "floors",
        kind: basement ? "basementFloor" : imageRole,
        layer: basement ? "basementFloor" : imageRole === "roof" ? "roof" : "floor",
        sprite: img.sprite,
        assetScale: img.scale ?? 1,
        fallbackWidth: imageRole === "roof" ? 22 : 20,
        fallbackHeight: imageRole === "roof" ? 16 : 14,
        localCollider: createAabbCollider(20, 14),
    });
}

function classifyObstacle(
    name: string,
    def: ObstacleDef,
): { category: PaletteCategory; kind: ItemKind; layer: LayerId } {
    const lower = name.toLowerCase();
    const basement = lower.includes("basement") || def.img?.sprite?.includes("basement");
    if (def.door || lower.includes("door")) {
        return {
            category: basement ? "basement" : "doors",
            kind: basement ? "basementObject" : "door",
            layer: basement ? "basement" : "walls",
        };
    }
    if (def.isWindow || lower.includes("window")) {
        return {
            category: basement ? "basement" : "windows",
            kind: basement ? "basementObject" : "window",
            layer: basement ? "basement" : "walls",
        };
    }
    if (def.isWall || lower.includes("wall")) {
        return {
            category: basement ? "basement" : "walls",
            kind: basement ? "basementWall" : "wall",
            layer: basement ? "basement" : "walls",
        };
    }
    return {
        category: basement ? "basement" : "objects",
        kind: basement ? "basementObject" : "object",
        layer: basement ? "basement" : "objects",
    };
}

function fallbackSizeFromCollider(col?: Collider): { width: number; height: number } {
    if (!col) return { width: 4, height: 4 };
    const box = collider.toAabb(col);
    return {
        width: Math.max(1, box.max.x - box.min.x),
        height: Math.max(1, box.max.y - box.min.y),
    };
}

function makeItemFromPalette(
    entry: PaletteEntry,
    pos: Vec2,
    targetDoc = doc,
    targetMode = mode,
): EditorItem {
    const layer = layerForMode(entry.layer, targetMode);
    const isBasementHitbox = targetMode === "basement" && entry.kind === "hitbox";
    return {
        id: makeId("part"),
        name: isBasementHitbox ? "basement_collision" : entry.name,
        kind: entry.kind,
        layer,
        type: entry.type && MapObjectDefs[entry.type] ? entry.type : undefined,
        sprite: entry.sprite,
        x: snap(pos.x, targetDoc),
        y: snap(pos.y, targetDoc),
        rotation: 0,
        scale: 1,
        assetScale: entry.assetScale || 1,
        fallbackWidth: entry.fallbackWidth,
        fallbackHeight: entry.fallbackHeight,
        alpha: 1,
        tint: 0xffffff,
        surfaceType: entry.kind === "floor" || entry.kind === "basementFloor" ? "wood" : undefined,
        localCollider: entry.localCollider || createAabbCollider(entry.fallbackWidth, entry.fallbackHeight),
    };
}

function layerForMode(layer: LayerId, activeMode = mode): LayerId {
    if (activeMode === "roof") return "roof";
    if (activeMode === "basement") {
        if (layer === "floor") return "basementFloor";
        if (layer === "walls" || layer === "objects") return "basement";
    }
    return layer;
}

function addItemFromEntry(entry: PaletteEntry, pos = v2.create(camera.x, camera.y)) {
    const item = makeItemFromPalette(entry, pos);
    doc.items.push(item);
    selectedIds = new Set([item.id]);
    commit("add item");
    renderAllPanels();
}

function snap(value: number, sourceDoc = doc): number {
    return sourceDoc.snapToGrid
        ? Math.round(value / sourceDoc.gridSize) * sourceDoc.gridSize
        : value;
}

function snapVec(pos: Vec2, sourceDoc = doc): Vec2 {
    return v2.create(snap(pos.x, sourceDoc), snap(pos.y, sourceDoc));
}

function getImage(sprite?: string): ImageState | null {
    const src = spriteToPath(sprite);
    if (!src) return null;
    const existing = imageCache.get(src);
    if (existing) return existing;

    const img = new Image();
    const state: ImageState = { img, loaded: false, failed: false };
    img.onload = () => {
        state.loaded = true;
    };
    img.onerror = () => {
        state.failed = true;
    };
    img.src = src;
    imageCache.set(src, state);
    return state;
}

function spriteToPath(sprite?: string): string {
    if (!sprite || sprite === "none") return "";
    if (sprite.startsWith("/") || sprite.startsWith("http")) return sprite;
    if (sprite.endsWith(".svg") || sprite.endsWith(".png")) {
        return sprite.includes("/") ? `/${sprite}` : `/img/map/${sprite}`;
    }
    const name = sprite.replace(/\.img$/, ".svg");
    if (name.includes("/")) return `/img/${name}`;
    if (name.startsWith("loot-")) return `/img/loot/${name}`;
    return `/img/map/${name}`;
}

function itemSize(item: EditorItem): { width: number; height: number } {
    const image = getImage(item.sprite);
    if (image?.loaded && image.img.naturalWidth > 0 && image.img.naturalHeight > 0) {
        return {
            width: (image.img.naturalWidth * item.assetScale * item.scale) / PPU,
            height: (image.img.naturalHeight * item.assetScale * item.scale) / PPU,
        };
    }
    return {
        width: item.fallbackWidth * item.scale,
        height: item.fallbackHeight * item.scale,
    };
}

function itemBounds(item: EditorItem): AABB {
    const size = itemSize(item);
    return collider.createAabbExtents(v2.create(item.x, item.y), v2.create(size.width / 2, size.height / 2));
}

function itemColliders(item: EditorItem): Collider[] {
    if (item.kind === "hitbox" || item.kind === "floor" || item.kind === "basementFloor") {
        return [
            collider.transform(
                item.localCollider || createAabbCollider(item.fallbackWidth, item.fallbackHeight),
                v2.create(item.x, item.y),
                item.rotation,
                item.scale,
            ),
        ];
    }

    if (item.type) {
        const def = MapObjectDefs[item.type];
        if (def?.type === "obstacle") {
            return [
                collider.transform(
                    (def as ObstacleDef).collision,
                    v2.create(item.x, item.y),
                    item.rotation,
                    item.scale,
                ),
            ];
        }
    }

    return [collider.transform(createAabbCollider(itemSize(item).width, itemSize(item).height), v2.create(item.x, item.y), item.rotation, 1)];
}

function worldToScreen(pos: Vec2): Vec2 {
    const z = PPU * camera.zoom;
    return v2.create(viewWidth / 2 + (pos.x - camera.x) * z, viewHeight / 2 - (pos.y - camera.y) * z);
}

function screenToWorld(pos: Vec2): Vec2 {
    const z = PPU * camera.zoom;
    return v2.create(camera.x + (pos.x - viewWidth / 2) / z, camera.y + (viewHeight / 2 - pos.y) / z);
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    const pixelWidth = Math.max(1, Math.floor(nextWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(nextHeight * dpr));
    const needsBackingResize =
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight ||
        canvasDpr !== dpr;

    viewWidth = nextWidth;
    viewHeight = nextHeight;
    if (!needsBackingResize) return;

    canvasDpr = dpr;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function renderFrame(now = performance.now()) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.08);
    lastFrameTime = now;
    if (preview) updatePreview(dt);
    else updateEditorCamera(dt);
    draw();
    requestAnimationFrame(renderFrame);
}

function draw() {
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    drawBackground();
    drawGrid();

    for (const layer of layerOrder) {
        if (!doc.layers[layer].visible) continue;
        for (const item of doc.items) {
            if (item.layer !== layer) continue;
            if (!shouldDrawInMode(item)) continue;
            drawItem(item);
        }
    }

    if (!preview) {
        drawSelectionBox();
        drawDragSelection();
    } else {
        drawPreviewPlayer();
    }

    statusLeft.textContent = `Cursor ${formatNum(pointer.world.x)}, ${formatNum(pointer.world.y)} | ${scopeLabel(activeScope)} | Zoom ${Math.round(camera.zoom * 100)}%`;
    statusRight.textContent = selectedIds.size
        ? `${selectedIds.size} selected`
        : `${doc.items.length} parts`;
}

function drawBackground() {
    const mapColors = editorMapColors;
    ctx.fillStyle = hexCss(mode === "basement" ? gameUndergroundColor : mapColors.background);
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    if (mode !== "basement") {
        drawMainMapTerrain();
    }

    const topLeft = worldToScreen(v2.create(-editorMap.width / 2, editorMap.height / 2));
    const bottomRight = worldToScreen(v2.create(editorMap.width / 2, -editorMap.height / 2));
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
        Math.min(topLeft.x, bottomRight.x),
        Math.min(topLeft.y, bottomRight.y),
        Math.abs(bottomRight.x - topLeft.x),
        Math.abs(bottomRight.y - topLeft.y),
    );
    ctx.restore();

    const origin = worldToScreen(v2.create(0, 0));
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 14, origin.y);
    ctx.lineTo(origin.x + 14, origin.y);
    ctx.moveTo(origin.x, origin.y - 14);
    ctx.lineTo(origin.x, origin.y + 14);
    ctx.stroke();
}

function drawMainMapTerrain() {
    const mapColors = editorMapColors;
    const left = -editorMap.width / 2;
    const right = editorMap.width / 2;
    const bottom = -editorMap.height / 2;
    const top = editorMap.height / 2;

    fillWorldRect(left, bottom, editorMap.width, editorMap.height, hexCss(mapColors.water));
    fillWorldPolygon(editorMap.terrain.shore, hexCss(mapColors.beach));
    fillWorldPolygon(editorMap.terrain.grass, hexCss(mapColors.grass));

    for (const river of editorMap.terrain.rivers) {
        fillWorldPolygon(river.shorePoly, hexCss(mapColors.riverbank));
        fillWorldPolygon(river.waterPoly, hexCss(mapColors.water));
    }

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    const ll = worldToScreen(v2.create(left, bottom));
    const ur = worldToScreen(v2.create(right, top));
    ctx.strokeRect(
        Math.min(ll.x, ur.x),
        Math.min(ll.y, ur.y),
        Math.abs(ur.x - ll.x),
        Math.abs(ur.y - ll.y),
    );
    ctx.restore();
}

function fillWorldRect(x: number, y: number, width: number, height: number, color: string) {
    const topLeft = worldToScreen(v2.create(x, y + height));
    const bottomRight = worldToScreen(v2.create(x + width, y));
    ctx.fillStyle = color;
    ctx.fillRect(
        Math.min(topLeft.x, bottomRight.x),
        Math.min(topLeft.y, bottomRight.y),
        Math.abs(bottomRight.x - topLeft.x),
        Math.abs(bottomRight.y - topLeft.y),
    );
}

function fillWorldPolygon(points: Vec2[], color: string) {
    if (!points.length) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach((point, index) => {
        const screen = mapPointToScreen(point);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
    ctx.fill();
}

function mapPointToScreen(point: Vec2): Vec2 {
    return worldToScreen(v2.create(point.x - editorMap.width / 2, point.y - editorMap.height / 2));
}

function drawGrid() {
    const topLeft = screenToWorld(v2.create(0, 0));
    const bottomRight = screenToWorld(v2.create(viewWidth, viewHeight));
    const mapMinX = -editorMap.width / 2;
    const mapMaxX = editorMap.width / 2;
    const mapMinY = -editorMap.height / 2;
    const mapMaxY = editorMap.height / 2;
    const minX = Math.max(topLeft.x, mapMinX);
    const maxX = Math.min(bottomRight.x, mapMaxX);
    const minY = Math.max(bottomRight.y, mapMinY);
    const maxY = Math.min(topLeft.y, mapMaxY);
    if (minX >= maxX || minY >= maxY) return;

    const addGrid = (step: number, color: string) => {
        const startX = Math.floor(minX / step) * step;
        const endX = Math.ceil(maxX / step) * step;
        const startY = Math.floor(minY / step) * step;
        const endY = Math.ceil(maxY / step) * step;

        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let y = startY; y <= endY; y += step) {
            const a = worldToScreen(v2.create(startX, y));
            const b = worldToScreen(v2.create(endX, y));
            ctx.moveTo(a.x, Math.round(a.y) + 0.5);
            ctx.lineTo(b.x, Math.round(b.y) + 0.5);
        }
        for (let x = startX; x <= endX; x += step) {
            const a = worldToScreen(v2.create(x, startY));
            const b = worldToScreen(v2.create(x, endY));
            ctx.moveTo(Math.round(a.x) + 0.5, a.y);
            ctx.lineTo(Math.round(b.x) + 0.5, b.y);
        }
        ctx.stroke();
    };

    ctx.lineWidth = 1;
    addGrid(GameConfig.map.gridSize, "rgba(0,0,0,0.16)");
    if (camera.zoom >= 1.5) {
        addGrid(doc.gridSize, "rgba(66,66,66,0.32)");
    }
    if (camera.zoom >= 4.5 && doc.gridSize > 0.25) {
        addGrid(0.25, "rgba(66,66,66,0.25)");
    }

    ctx.strokeStyle = "rgba(0,0,0,0.24)";
    ctx.beginPath();
    const a = worldToScreen(v2.create(0, minY));
    const b = worldToScreen(v2.create(0, maxY));
    const c = worldToScreen(v2.create(minX, 0));
    const d = worldToScreen(v2.create(maxX, 0));
    ctx.moveTo(Math.round(a.x) + 0.5, a.y);
    ctx.lineTo(Math.round(b.x) + 0.5, b.y);
    ctx.moveTo(c.x, Math.round(c.y) + 0.5);
    ctx.lineTo(d.x, Math.round(d.y) + 0.5);
    ctx.stroke();
}

function shouldDrawInMode(item: EditorItem): boolean {
    if (preview) return item.layer !== "hitboxes" || doc.layers.hitboxes.visible;
    if (mode === "roof") return item.layer === "roof" || item.layer === "floor" || item.layer === "walls";
    if (mode === "basement") return isBasementItem(item);
    return item.layer !== "roof" && !isBasementItem(item);
}

function isEditableInMode(item: EditorItem): boolean {
    if (preview || doc.layers[item.layer].locked) return false;
    if (mode === "roof") return item.layer === "roof";
    if (mode === "basement") return isBasementItem(item);
    return item.layer !== "roof" && !isBasementItem(item);
}

function isBasementItem(item: EditorItem): boolean {
    return item.layer === "basement" ||
        item.layer === "basementFloor" ||
        (item.layer === "hitboxes" && item.name.toLowerCase().includes("basement"));
}

function drawItem(item: EditorItem) {
    const selected = selectedIds.has(item.id);
    const screen = worldToScreen(v2.create(item.x, item.y));
    const size = itemSize(item);
    const screenWidth = size.width * PPU * camera.zoom;
    const screenHeight = size.height * PPU * camera.zoom;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(-item.rotation);
    ctx.globalAlpha = item.alpha;

    const image = getImage(item.sprite);
    if (image?.loaded && !image.failed) {
        ctx.drawImage(image.img, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
    } else {
        ctx.fillStyle = fillForItem(item);
        ctx.strokeStyle = strokeForItem(item);
        ctx.lineWidth = 2;
        ctx.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
        ctx.strokeRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shortLabel(item), 0, 0, Math.max(30, screenWidth - 8));
    }
    ctx.restore();

    if (selected || doc.layers.hitboxes.visible || item.layer === "hitboxes") {
        drawColliders(item, selected);
    }

    if (selected && !preview) {
        drawItemSelection(item);
    }
}

function fillForItem(item: EditorItem): string {
    switch (item.kind) {
        case "roof":
            return "rgba(104, 94, 47, 0.72)";
        case "floor":
        case "basementFloor":
            return "rgba(88, 96, 83, 0.68)";
        case "wall":
        case "basementWall":
            return "rgba(63, 67, 70, 0.85)";
        case "door":
            return "rgba(111, 70, 44, 0.84)";
        case "window":
            return "rgba(68, 125, 151, 0.75)";
        case "hitbox":
            return "rgba(229, 90, 77, 0.18)";
        default:
            return "rgba(58, 91, 104, 0.72)";
    }
}

function strokeForItem(item: EditorItem): string {
    return item.kind === "hitbox" ? "#e65a4d" : "rgba(0,0,0,0.55)";
}

function shortLabel(item: EditorItem): string {
    return (item.type || item.sprite || item.name).replace(/^map-/, "").replace(/\.img$/, "");
}

function drawColliders(item: EditorItem, selected: boolean) {
    const colliders = itemColliders(item);
    ctx.save();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? "#f4d35e" : "rgba(255, 226, 87, 0.62)";
    ctx.fillStyle = selected ? "rgba(244, 211, 94, 0.1)" : "rgba(255, 226, 87, 0.05)";
    for (const col of colliders) {
        drawCollider(col);
    }
    ctx.restore();
}

function drawCollider(col: Collider) {
    if (col.type === 0) {
        const center = worldToScreen(col.pos);
        const radius = col.rad * PPU * camera.zoom;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return;
    }
    const min = worldToScreen(col.min);
    const max = worldToScreen(col.max);
    const x = Math.min(min.x, max.x);
    const y = Math.min(min.y, max.y);
    const width = Math.abs(max.x - min.x);
    const height = Math.abs(max.y - min.y);
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
}

function drawItemSelection(item: EditorItem) {
    const corners = itemCorners(item);
    ctx.save();
    ctx.strokeStyle = "#65d0bf";
    ctx.fillStyle = "#65d0bf";
    ctx.lineWidth = 2;
    ctx.beginPath();
    corners.forEach((corner, idx) => {
        const p = worldToScreen(corner);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    const top = v2.mul(v2.add(corners[0], corners[1]), 0.5);
    const handleWorld = v2.add(top, v2.rotate(v2.create(0, itemSize(item).height * 0.22 + 1.2), item.rotation));
    const handle = worldToScreen(handleWorld);
    const topScreen = worldToScreen(top);
    ctx.beginPath();
    ctx.moveTo(topScreen.x, topScreen.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSelectionBox() {
    if (selectedIds.size < 2) return;
    const bounds = selectionBounds();
    if (!bounds) return;
    const min = worldToScreen(bounds.min);
    const max = worldToScreen(bounds.max);
    ctx.save();
    ctx.strokeStyle = "#65d0bf";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.abs(max.x - min.x), Math.abs(max.y - min.y));
    ctx.restore();
}

function drawDragSelection() {
    if (dragState?.type !== "select") return;
    const min = worldToScreen(v2.minElems(dragState.start, dragState.current));
    const max = worldToScreen(v2.maxElems(dragState.start, dragState.current));
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.setLineDash([4, 4]);
    ctx.fillRect(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.abs(max.x - min.x), Math.abs(max.y - min.y));
    ctx.strokeRect(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.abs(max.x - min.x), Math.abs(max.y - min.y));
    ctx.restore();
}

function drawPreviewPlayer() {
    if (!preview) return;
    const p = worldToScreen(preview.pos);
    const r = preview.radius * PPU * camera.zoom;
    ctx.save();
    ctx.fillStyle = "#f0d36a";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const dirEnd = worldToScreen(v2.add(preview.pos, v2.mul(preview.dir, preview.radius * 1.35)));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(dirEnd.x, dirEnd.y);
    ctx.stroke();
    ctx.restore();
}

function itemCorners(item: EditorItem): Vec2[] {
    const size = itemSize(item);
    const points = [
        v2.create(-size.width / 2, size.height / 2),
        v2.create(size.width / 2, size.height / 2),
        v2.create(size.width / 2, -size.height / 2),
        v2.create(-size.width / 2, -size.height / 2),
    ];
    return points.map((p) => v2.add(v2.create(item.x, item.y), v2.rotate(p, item.rotation)));
}

function selectionBounds(): AABB | null {
    const selected = selectedItems();
    if (!selected.length) return null;
    const min = v2.create(Number.MAX_VALUE, Number.MAX_VALUE);
    const max = v2.create(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (const item of selected) {
        const box = itemBounds(item);
        min.x = Math.min(min.x, box.min.x);
        min.y = Math.min(min.y, box.min.y);
        max.x = Math.max(max.x, box.max.x);
        max.y = Math.max(max.y, box.max.y);
    }
    return collider.createAabb(min, max);
}

function selectedItems(): EditorItem[] {
    return doc.items.filter((item) => selectedIds.has(item.id));
}

function hitTest(pos: Vec2): EditorItem | null {
    for (let i = layerOrder.length - 1; i >= 0; i--) {
        const layer = layerOrder[i];
        if (!doc.layers[layer].visible) continue;
        for (let j = doc.items.length - 1; j >= 0; j--) {
            const item = doc.items[j];
            if (item.layer !== layer || !shouldDrawInMode(item) || !isEditableInMode(item)) continue;
            if (pointInItem(pos, item)) return item;
        }
    }
    return null;
}

function pointInItem(pos: Vec2, item: EditorItem): boolean {
    const local = v2.rotate(v2.sub(pos, v2.create(item.x, item.y)), -item.rotation);
    const size = itemSize(item);
    return Math.abs(local.x) <= size.width / 2 && Math.abs(local.y) <= size.height / 2;
}

function handleAt(pos: Vec2): "rotate" | null {
    if (selectedIds.size !== 1) return null;
    const item = selectedItems()[0];
    if (!item || !isEditableInMode(item)) return null;
    const corners = itemCorners(item);
    const top = v2.mul(v2.add(corners[0], corners[1]), 0.5);
    const handleWorld = v2.add(top, v2.rotate(v2.create(0, itemSize(item).height * 0.22 + 1.2), item.rotation));
    if (v2.length(v2.sub(pos, handleWorld)) <= 0.9 / camera.zoom) return "rotate";
    return null;
}

canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    updatePointer(event);
    if (preview) return;

    if (event.button === 1 || event.button === 2 || spaceDown) {
        dragState = {
            type: "pan",
            startX: event.clientX,
            startY: event.clientY,
            camera: { ...camera },
        };
        return;
    }

    const handle = handleAt(pointer.world);
    if (handle === "rotate") {
        dragState = {
            type: "rotate",
            itemId: selectedItems()[0].id,
        };
        return;
    }

    const hit = hitTest(pointer.world);
    if (hit) {
        if (event.shiftKey) {
            if (selectedIds.has(hit.id)) selectedIds.delete(hit.id);
            else selectedIds.add(hit.id);
        } else if (!selectedIds.has(hit.id)) {
            selectedIds = new Set([hit.id]);
        }
        dragState = {
            type: "move",
            startWorld: pointer.world,
            originals: selectedItems().map((item) => ({ id: item.id, x: item.x, y: item.y })),
        };
        renderSelectionPanel();
        return;
    }

    if (!event.shiftKey) selectedIds.clear();
    dragState = {
        type: "select",
        start: pointer.world,
        current: pointer.world,
    };
    renderSelectionPanel();
});

canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
    const state = dragState;
    if (!state) return;
    if (state.type === "pan") {
        const z = PPU * camera.zoom;
        camera.x = state.camera.x - (event.clientX - state.startX) / z;
        camera.y = state.camera.y + (event.clientY - state.startY) / z;
        return;
    }
    if (preview) return;

    if (state.type === "move") {
        const delta = v2.sub(pointer.world, state.startWorld);
        for (const original of state.originals) {
            const item = doc.items.find((candidate) => candidate.id === original.id);
            if (!item) continue;
            const next = snapVec(v2.create(original.x + delta.x, original.y + delta.y));
            item.x = next.x;
            item.y = next.y;
        }
        renderSelectionPanel();
        return;
    }
    if (state.type === "rotate") {
        const item = doc.items.find((candidate) => candidate.id === state.itemId);
        if (!item) return;
        item.rotation = Math.atan2(pointer.world.y - item.y, pointer.world.x - item.x) - Math.PI / 2;
        if (doc.snapToGrid) item.rotation = oriToRad(radToOri(item.rotation));
        renderSelectionPanel();
        return;
    }
    if (state.type === "select") {
        state.current = pointer.world;
        const min = v2.minElems(state.start, state.current);
        const max = v2.maxElems(state.start, state.current);
        selectedIds = new Set(
            doc.items
                .filter((item) => shouldDrawInMode(item) && isEditableInMode(item))
                .filter((item) => {
                    const bounds = itemBounds(item);
                    return bounds.min.x >= min.x && bounds.max.x <= max.x && bounds.min.y >= min.y && bounds.max.y <= max.y;
                })
                .map((item) => item.id),
        );
        renderSelectionPanel();
    }
});

canvas.addEventListener("pointerup", () => {
    if (dragState && dragState.type !== "pan" && dragState.type !== "select") {
        commit("edit item");
    }
    dragState = null;
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.ctrlKey || event.altKey || event.metaKey) {
        zoomAtScreenPoint(
            v2.create(event.offsetX, event.offsetY),
            event.deltaY > 0 ? 0.82 : 1.22,
        );
        return;
    }

    const z = PPU * camera.zoom;
    const horizontalDelta = event.deltaX + (event.shiftKey ? event.deltaY : 0);
    const verticalDelta = event.shiftKey ? 0 : event.deltaY;
    camera.x += horizontalDelta / z;
    camera.y -= verticalDelta / z;
}, { passive: false });

window.addEventListener("wheel", (event) => {
    const target = event.target;
    if (!(target instanceof Node) || !root.contains(target)) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
    }
}, { passive: false });

canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
});

canvas.addEventListener("drop", (event) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData("text/plain");
    const entry = palette.find((candidate) => candidate.id === id);
    if (!entry) return;
    const rect = canvas.getBoundingClientRect();
    const pos = screenToWorld(v2.create(event.clientX - rect.left, event.clientY - rect.top));
    addItemFromEntry(entry, pos);
});

function updatePointer(event: PointerEvent | WheelEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.world = screenToWorld(v2.create(pointer.x, pointer.y));
}

window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
        event.preventDefault();
        spaceDown = true;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSelection();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
    }
    if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
    }
    if (event.key.toLowerCase() === "r") {
        rotateSelection(1);
    }
    if (event.key === "Escape" && preview) {
        exitPreviewMode();
    }
});

window.addEventListener("keyup", (event) => {
    if (event.code === "Space") spaceDown = false;
});

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function commit(_label: string) {
    saveWorkingDoc();
    const snapshot = serializeDoc(doc);
    if (history[historyIndex] === snapshot) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
    renderAllPanels();
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    doc = normalizeDoc(JSON.parse(history[historyIndex]));
    selectedIds.clear();
    saveWorkingDoc();
    syncStaticControls();
    renderAllPanels();
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    doc = normalizeDoc(JSON.parse(history[historyIndex]));
    selectedIds.clear();
    saveWorkingDoc();
    syncStaticControls();
    renderAllPanels();
}

function duplicateSelection() {
    const selected = selectedItems();
    if (!selected.length) return;
    const clones = selected.map((item) => ({
        ...structuredClone(item),
        id: makeId("part"),
        x: item.x + doc.gridSize,
        y: item.y - doc.gridSize,
    }));
    doc.items.push(...clones);
    selectedIds = new Set(clones.map((item) => item.id));
    commit("duplicate");
}

function deleteSelection() {
    if (!selectedIds.size) return;
    doc.items = doc.items.filter((item) => !selectedIds.has(item.id));
    selectedIds.clear();
    commit("delete");
}

let clipboardItems: EditorItem[] = [];

function copySelection() {
    clipboardItems = selectedItems().map((item) => structuredClone(item));
}

function pasteSelection() {
    if (!clipboardItems.length) return;
    const clones = clipboardItems.map((item) => ({
        ...structuredClone(item),
        id: makeId("part"),
        x: item.x + doc.gridSize * 2,
        y: item.y - doc.gridSize * 2,
    }));
    doc.items.push(...clones);
    selectedIds = new Set(clones.map((item) => item.id));
    commit("paste");
}

function rotateSelection(direction: 1 | -1) {
    const selected = selectedItems();
    if (!selected.length) return;
    for (const item of selected) {
        item.rotation = oriToRad(radToOri(item.rotation) + direction);
    }
    commit("rotate");
}

function alignSelection(which: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    const selected = selectedItems();
    if (selected.length < 2) return;
    const bounds = selectionBounds();
    if (!bounds) return;
    for (const item of selected) {
        const itemBox = itemBounds(item);
        if (which === "left") item.x += bounds.min.x - itemBox.min.x;
        if (which === "right") item.x += bounds.max.x - itemBox.max.x;
        if (which === "center") item.x += (bounds.min.x + bounds.max.x - itemBox.min.x - itemBox.max.x) / 2;
        if (which === "bottom") item.y += bounds.min.y - itemBox.min.y;
        if (which === "top") item.y += bounds.max.y - itemBox.max.y;
        if (which === "middle") item.y += (bounds.min.y + bounds.max.y - itemBox.min.y - itemBox.max.y) / 2;
        item.x = snap(item.x);
        item.y = snap(item.y);
    }
    commit("align");
}

function enterPreviewMode() {
    selectedIds.clear();
    mode = "preview";
    preview = {
        pos: v2.create(camera.x, camera.y),
        dir: v2.create(0, 1),
        speed: 14,
        radius: 1.35,
    };
    previewBanner.classList.add("active");
    syncModeButtons();
    renderAllPanels();
}

function exitPreviewMode() {
    preview = null;
    mode = "base";
    previewBanner.classList.remove("active");
    syncModeButtons();
    renderAllPanels();
}

function updatePreview(dt: number) {
    if (!preview) return;
    const keys = pressedKeys;
    const move = v2.create(
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    );
    if (v2.lengthSqr(move) > 0) {
        const dir = v2.normalize(move);
        preview.dir = dir;
        movePreview(v2.mul(dir, preview.speed * dt));
    }
    camera.x = preview.pos.x;
    camera.y = preview.pos.y;
}

function updateEditorCamera(dt: number) {
    if (isTypingTarget(document.activeElement)) return;

    const move = v2.create(
        (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0) -
            (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0),
        (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0) -
            (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0),
    );

    if (v2.lengthSqr(move) === 0) return;

    const panSpeed = (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight") ? 52 : 28) /
        Math.max(camera.zoom, 0.25);
    const delta = v2.mul(v2.normalize(move), panSpeed * dt);
    camera.x += delta.x;
    camera.y += delta.y;
}

const pressedKeys = new Set<string>();
window.addEventListener("keydown", (event) => {
    if (!isTypingTarget(event.target)) pressedKeys.add(event.code);
});
window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.code);
});

function movePreview(delta: Vec2) {
    if (!preview) return;
    const nextX = v2.create(preview.pos.x + delta.x, preview.pos.y);
    preview.pos = resolvePlayerCollisions(nextX, preview.radius);
    const nextY = v2.create(preview.pos.x, preview.pos.y + delta.y);
    preview.pos = resolvePlayerCollisions(nextY, preview.radius);
}

function resolvePlayerCollisions(pos: Vec2, radius: number): Vec2 {
    let resolved = v2.copy(pos);
    const playerCollider = (): Circle => ({ type: 0, pos: resolved, rad: radius });
    for (let pass = 0; pass < 3; pass++) {
        for (const col of previewColliders()) {
            const hit = collider.intersect(col, playerCollider());
            if (hit) {
                resolved = v2.add(resolved, v2.mul(hit.dir, hit.pen + 0.001));
            }
        }
    }
    return resolved;
}

function previewColliders(): Collider[] {
    const out: Collider[] = [];
    for (const item of doc.items) {
        if (item.layer === "roof" || item.layer === "floor" || item.layer === "basementFloor") continue;
        if (item.kind === "hitbox" || item.type) {
            if (item.type) {
                const def = MapObjectDefs[item.type];
                if (def?.type === "obstacle" && !(def as ObstacleDef).collidable) continue;
            }
            out.push(...itemColliders(item));
        }
    }
    return out;
}

function renderAllPanels() {
    renderPalette();
    renderLayersPanel();
    renderSelectionPanel();
    renderWarnings();
    syncStaticControls();
}

function renderPalette() {
    const search = assetSearch.value.trim().toLowerCase();
    const list = document.getElementById("asset-list") as HTMLDivElement;
    const filtered = palette
        .filter((entry) => activeCategory === "all" || entry.category === activeCategory)
        .filter((entry) => {
            if (!search) return true;
            return `${entry.name} ${entry.type || ""} ${entry.sprite || ""}`.toLowerCase().includes(search);
        });

    list.innerHTML = "";
    for (const entry of filtered) {
        const row = document.createElement("div");
        row.className = "asset-row";
        row.draggable = true;
        row.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", entry.id);
        });

        const thumb = document.createElement("div");
        thumb.className = "asset-thumb";
        const src = spriteToPath(entry.sprite);
        if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.loading = "lazy";
            thumb.appendChild(img);
        } else {
            thumb.textContent = entry.kind === "hitbox" ? "Box" : "Obj";
        }

        const meta = document.createElement("div");
        meta.className = "asset-meta";
        meta.innerHTML = `<div class="asset-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</div>
          <div class="asset-kind">${escapeHtml(layerLabels[entry.layer])} · ${escapeHtml(entry.kind)}</div>`;

        const add = document.createElement("button");
        add.className = "mini-button";
        add.textContent = "Add";
        add.addEventListener("click", () => addItemFromEntry(entry));

        row.append(thumb, meta, add);
        list.appendChild(row);
    }
}

function renderLayersPanel() {
    const panel = document.getElementById("layers-panel") as HTMLDivElement;
    panel.innerHTML = "";
    for (const layer of layerOrder) {
        const state = doc.layers[layer];
        const row = document.createElement("div");
        row.className = "layer-row";
        const label = document.createElement("span");
        label.textContent = layerLabels[layer];
        const actions = document.createElement("span");
        actions.className = "layer-actions";
        const visible = document.createElement("button");
        visible.textContent = state.visible ? "On" : "Off";
        visible.className = state.visible ? "active" : "";
        visible.title = "Toggle visibility";
        visible.addEventListener("click", () => {
            state.visible = !state.visible;
            commit("toggle layer");
        });
        const locked = document.createElement("button");
        locked.textContent = state.locked ? "Lock" : "Free";
        locked.className = state.locked ? "active" : "";
        locked.title = "Toggle lock";
        locked.addEventListener("click", () => {
            state.locked = !state.locked;
            commit("lock layer");
        });
        actions.append(visible, locked);
        row.append(label, actions);
        panel.appendChild(row);
    }
}

function renderSelectionPanel() {
    const panel = document.getElementById("selection-panel") as HTMLDivElement;
    const selected = selectedItems();
    if (!selected.length) {
        panel.innerHTML = `<div class="selection-empty">Select a part on the canvas. Drag from the asset list to place at the cursor.</div>`;
        return;
    }
    if (selected.length > 1) {
        panel.innerHTML = `<div class="selection-empty">${selected.length} parts selected. Use alignment, duplicate, delete, or drag them together.</div>`;
        return;
    }

    const item = selected[0];
    panel.innerHTML = `
      <div class="field">
        <label for="sel-name">Name</label>
        <input id="sel-name" class="text-field" value="${escapeAttr(item.name)}">
      </div>
      <div class="field" style="margin-top: 8px;">
        <label for="sel-type">Object type</label>
        <input id="sel-type" class="text-field" value="${escapeAttr(item.type || "")}" list="object-type-list">
      </div>
      <div class="field" style="margin-top: 8px;">
        <label for="sel-sprite">Sprite</label>
        <input id="sel-sprite" class="text-field" value="${escapeAttr(item.sprite || "")}" list="sprite-name-list">
      </div>
      <div class="field-grid" style="margin-top: 8px;">
        <div class="field">
          <label for="sel-layer">Layer</label>
          <select id="sel-layer" class="select-field">
            ${layerOrder.map((layer) => `<option value="${layer}" ${item.layer === layer ? "selected" : ""}>${layerLabels[layer]}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="sel-kind">Kind</label>
          <select id="sel-kind" class="select-field">
            ${["floor", "roof", "wall", "door", "window", "object", "basementWall", "basementObject", "basementFloor", "hitbox"]
                .map((kind) => `<option value="${kind}" ${item.kind === kind ? "selected" : ""}>${kind}</option>`)
                .join("")}
          </select>
        </div>
      </div>
      <div class="field-grid three" style="margin-top: 8px;">
        <div class="field">
          <label for="sel-x">X</label>
          <input id="sel-x" class="number-field" type="number" step="0.25" value="${formatNum(item.x)}">
        </div>
        <div class="field">
          <label for="sel-y">Y</label>
          <input id="sel-y" class="number-field" type="number" step="0.25" value="${formatNum(item.y)}">
        </div>
        <div class="field">
          <label for="sel-ori">Ori</label>
          <input id="sel-ori" class="number-field" type="number" min="0" max="3" step="1" value="${radToOri(item.rotation)}">
        </div>
      </div>
      <div class="field-grid" style="margin-top: 8px;">
        <div class="field">
          <label for="sel-alpha">Alpha</label>
          <input id="sel-alpha" class="number-field" type="number" step="0.05" min="0" max="1" value="${formatNum(item.alpha)}">
        </div>
        <div class="field">
          <label for="sel-tint">Tint hex</label>
          <input id="sel-tint" class="text-field" value="${hexColor(item.tint)}">
        </div>
      </div>
      <div class="field" style="margin-top: 8px;">
        <label for="sel-surface">Surface type</label>
        <input id="sel-surface" class="text-field" value="${escapeAttr(item.surfaceType || "")}" placeholder="wood, tile, asphalt">
      </div>
      <label class="check-row">
        <span>Ignore map spawn replacement</span>
        <input id="sel-ignore-replacement" type="checkbox" ${item.ignoreMapSpawnReplacement ? "checked" : ""}>
      </label>
      <datalist id="object-type-list">
        ${Object.keys(MapObjectDefs)
            .map((name) => `<option value="${escapeAttr(name)}"></option>`)
            .join("")}
      </datalist>
      <datalist id="sprite-name-list">
        ${spriteSpawnOptions
            .map((entry) => `<option value="${escapeAttr(entry.sprite || entry.name)}"></option>`)
            .join("")}
      </datalist>
    `;

    bindText("sel-name", (value) => (item.name = value || item.name));
    bindText("sel-type", (value) => {
        item.type = value || undefined;
        const def = item.type ? MapObjectDefs[item.type] : undefined;
        if (def?.type === "obstacle") {
            const obstacle = def as ObstacleDef;
            item.sprite = obstacle.img?.sprite;
            item.assetScale = obstacle.img?.scale ?? item.assetScale;
            item.localCollider = obstacle.collision;
        }
    });
    bindText("sel-sprite", (value) => (item.sprite = value || undefined));
    bindSelect("sel-layer", (value) => (item.layer = value as LayerId));
    bindSelect("sel-kind", (value) => (item.kind = value as ItemKind));
    bindNumber("sel-x", (value) => (item.x = snap(value)));
    bindNumber("sel-y", (value) => (item.y = snap(value)));
    bindNumber("sel-ori", (value) => (item.rotation = oriToRad(value)));
    bindNumber("sel-alpha", (value) => (item.alpha = clamp(value, 0, 1)));
    bindText("sel-tint", (value) => (item.tint = parseHexColor(value, item.tint)));
    bindText("sel-surface", (value) => (item.surfaceType = value || undefined));
    const ignore = document.getElementById("sel-ignore-replacement") as HTMLInputElement;
    ignore.addEventListener("change", () => {
        item.ignoreMapSpawnReplacement = ignore.checked;
        commit("edit selected");
    });
}

function bindText(id: string, update: (value: string) => void) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.addEventListener("change", () => {
        update(input.value.trim());
        commit("edit selected");
    });
}

function bindSelect(id: string, update: (value: string) => void) {
    const input = document.getElementById(id) as HTMLSelectElement;
    input.addEventListener("change", () => {
        update(input.value);
        commit("edit selected");
    });
}

function bindNumber(id: string, update: (value: number) => void) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.addEventListener("change", () => {
        const value = Number(input.value);
        if (Number.isFinite(value)) {
            update(value);
            commit("edit selected");
        }
    });
}

function renderWarnings() {
    const list = document.getElementById("warning-list") as HTMLUListElement;
    const warnings = validateDoc();
    if (!warnings.length) {
        list.innerHTML = `<li class="ok">Export checks passed.</li>`;
        return;
    }
    list.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function validateDoc(): string[] {
    const warnings: string[] = [];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(doc.name)) {
        warnings.push("Building name must be a valid TypeScript object key.");
    }
    if (!doc.items.some((item) => item.layer === "floor" || item.kind === "floor")) {
        warnings.push("Normal building has no floor image or surface.");
    }
    if (!doc.items.some((item) => item.layer === "hitboxes" || item.layer === "walls")) {
        warnings.push("No collision/hitbox or wall objects are present.");
    }
    const hasBasement = doc.items.some((item) => item.layer === "basement" || item.layer === "basementFloor");
    if (hasBasement && !doc.items.some((item) => item.layer === "basementFloor")) {
        warnings.push("Basement mode has objects but no basement floor.");
    }
    if (!doc.items.some((item) => item.layer === "roof")) {
        warnings.push("No roof images are present. This is valid, but the exported ceiling will be empty.");
    }
    for (const item of doc.items) {
        if (item.type && !MapObjectDefs[item.type]) {
            warnings.push(`${item.name} uses unknown object type "${item.type}".`);
        }
        if (item.sprite && !item.sprite.endsWith(".img") && !item.sprite.endsWith(".svg") && !item.sprite.endsWith(".png")) {
            warnings.push(`${item.name} sprite "${item.sprite}" does not look like a game asset name.`);
        }
        if (Math.abs(item.rotation - oriToRad(radToOri(item.rotation))) > 0.001) {
            warnings.push(`${item.name} rotation will export as nearest ori ${radToOri(item.rotation)}.`);
        }
    }
    return Array.from(new Set(warnings)).slice(0, 12);
}

function syncStaticControls() {
    buildingNameInput.value = doc.name;
    snapToggle.checked = doc.snapToGrid;
    gridSizeInput.value = String(doc.gridSize);
    (document.getElementById("undo") as HTMLButtonElement).disabled = historyIndex <= 0;
    (document.getElementById("redo") as HTMLButtonElement).disabled = historyIndex >= history.length - 1;
}

function syncModeButtons() {
    document.querySelectorAll<HTMLButtonElement>("#mode-tabs button").forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === mode);
    });
}

function syncScopeButtons() {
    document.querySelectorAll<HTMLButtonElement>("#scope-tabs button").forEach((button) => {
        button.classList.toggle("active", button.dataset.scope === activeScope);
    });
}

function syncPanelToggles() {
    const assetToggle = document.getElementById("toggle-assets") as HTMLButtonElement | null;
    const inspectorToggle = document.getElementById("toggle-inspector") as HTMLButtonElement | null;
    const assetsOpen = !makerShell.classList.contains("assets-collapsed");
    const inspectorOpen = !makerShell.classList.contains("inspector-collapsed");
    assetToggle?.classList.toggle("active", assetsOpen);
    assetToggle?.setAttribute("aria-pressed", String(assetsOpen));
    inspectorToggle?.classList.toggle("active", inspectorOpen);
    inspectorToggle?.setAttribute("aria-pressed", String(inspectorOpen));
}

function zoomAtScreenPoint(screenPoint: Vec2, factor: number) {
    const before = screenToWorld(screenPoint);
    camera.zoom = clamp(camera.zoom * factor, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
    activeScope = customScopeName(camera.zoom);
    const after = screenToWorld(screenPoint);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    syncScopeButtons();
}

function setupControls() {
    buildingNameInput.addEventListener("change", () => {
        doc.name = sanitizeKey(buildingNameInput.value.trim() || "new_building_01");
        commit("rename");
    });
    snapToggle.addEventListener("change", () => {
        doc.snapToGrid = snapToggle.checked;
        commit("snap");
    });
    gridSizeInput.addEventListener("change", () => {
        doc.gridSize = Math.max(0.25, Number(gridSizeInput.value) || 1);
        commit("grid");
    });
    assetSearch.addEventListener("input", renderPalette);
    assetCategorySelect.addEventListener("change", () => {
        activeCategory = assetCategorySelect.value as PaletteCategory;
        renderPalette();
    });
    document.getElementById("clear-search")?.addEventListener("click", () => {
        assetSearch.value = "";
        renderPalette();
    });
    document.getElementById("toggle-assets")?.addEventListener("click", () => {
        makerShell.classList.toggle("assets-collapsed");
        syncPanelToggles();
        resizeCanvas();
    });
    document.getElementById("toggle-inspector")?.addEventListener("click", () => {
        makerShell.classList.toggle("inspector-collapsed");
        syncPanelToggles();
    });
    document.querySelectorAll<HTMLButtonElement>("#mode-tabs button").forEach((button) => {
        button.addEventListener("click", () => {
            mode = button.dataset.mode as EditorMode;
            selectedIds.clear();
            syncModeButtons();
            renderSelectionPanel();
        });
    });
    document.getElementById("new-doc")?.addEventListener("click", () => {
        doc = createEmptyDoc();
        selectedIds.clear();
        history = [serializeDoc(doc)];
        historyIndex = 0;
        commit("new");
    });
    document.getElementById("undo")?.addEventListener("click", undo);
    document.getElementById("redo")?.addEventListener("click", redo);
    document.getElementById("duplicate")?.addEventListener("click", duplicateSelection);
    document.getElementById("delete")?.addEventListener("click", deleteSelection);
    document.getElementById("zoom-in")?.addEventListener("click", () => {
        zoomAtScreenPoint(v2.create(viewWidth / 2, viewHeight / 2), 1.28);
    });
    document.getElementById("zoom-out")?.addEventListener("click", () => {
        zoomAtScreenPoint(v2.create(viewWidth / 2, viewHeight / 2), 1 / 1.28);
    });
    document.getElementById("zoom-reset")?.addEventListener("click", () => {
        activeScope = DEFAULT_SCOPE;
        camera.zoom = scopeToCameraZoom(activeScope);
        syncScopeButtons();
    });
    document.querySelectorAll<HTMLButtonElement>("#scope-tabs button").forEach((button) => {
        button.addEventListener("click", () => {
            activeScope = button.dataset.scope || DEFAULT_SCOPE;
            camera.zoom = scopeToCameraZoom(activeScope);
            syncScopeButtons();
        });
    });
    document.getElementById("export")?.addEventListener("click", openExportDialog);
    document.getElementById("import")?.addEventListener("click", openImportDialog);
    document.getElementById("local-save")?.addEventListener("click", saveNamedDoc);
    document.getElementById("local-load")?.addEventListener("click", openLoadDialog);
    document.getElementById("preview")?.addEventListener("click", enterPreviewMode);
    document.getElementById("exit-preview")?.addEventListener("click", exitPreviewMode);
    document.getElementById("dialog-close")?.addEventListener("click", closeDialog);
    document.getElementById("align-left")?.addEventListener("click", () => alignSelection("left"));
    document.getElementById("align-center")?.addEventListener("click", () => alignSelection("center"));
    document.getElementById("align-right")?.addEventListener("click", () => alignSelection("right"));
    document.getElementById("align-top")?.addEventListener("click", () => alignSelection("top"));
    document.getElementById("align-middle")?.addEventListener("click", () => alignSelection("middle"));
    document.getElementById("align-bottom")?.addEventListener("click", () => alignSelection("bottom"));
}

function sanitizeKey(value: string): string {
    const key = value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z_]+/, "");
    return key || "new_building_01";
}

function openExportDialog() {
    const code = generateExport();
    openDialog(
        "Export Building Definition",
        `<textarea id="export-code" class="textarea-field" spellcheck="false"></textarea>
        <p class="small-note">Paste this inside MapObjectDefs. Hidden layers are included; locks are editor-only.</p>`,
        `<button id="copy-export" class="tool-button primary">Copy</button>
         <button id="download-json" class="tool-button">Editor JSON</button>`,
    );
    const textarea = document.getElementById("export-code") as HTMLTextAreaElement;
    textarea.value = code;
    document.getElementById("copy-export")?.addEventListener("click", () => {
        void navigator.clipboard?.writeText(textarea.value);
    });
    document.getElementById("download-json")?.addEventListener("click", () => {
        textarea.value = serializeDoc(doc);
    });
}

function openImportDialog() {
    openDialog(
        "Import Building Definition",
        `<textarea id="import-code" class="textarea-field" spellcheck="false" placeholder="Paste an exported editor JSON object or an existing BuildingDef entry"></textarea>
        <p class="small-note">Literal defs with v2.create(...) and collider.createAabbExtents(...) are supported.</p>`,
        `<button id="run-import" class="tool-button primary">Import</button>`,
    );
    document.getElementById("run-import")?.addEventListener("click", () => {
        const textarea = document.getElementById("import-code") as HTMLTextAreaElement;
        try {
            doc = importDocument(textarea.value);
            selectedIds.clear();
            history = [serializeDoc(doc)];
            historyIndex = 0;
            saveWorkingDoc();
            closeDialog();
            renderAllPanels();
        } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
        }
    });
}

function openLoadDialog() {
    const saves = loadSavedDocs();
    const rows = Object.entries(saves)
        .sort(([, a], [, b]) => b.savedAt - a.savedAt)
        .map(
            ([name, save]) => `<div class="local-save-row">
              <div>
                <strong>${escapeHtml(name)}</strong>
                <div class="small-note">${new Date(save.savedAt).toLocaleString()}</div>
              </div>
              <button class="mini-button" data-load="${escapeAttr(name)}">Load</button>
              <button class="mini-button" data-delete-save="${escapeAttr(name)}">Delete</button>
            </div>`,
        )
        .join("");
    openDialog("Local Saves", rows || `<div class="selection-empty">No local saves yet.</div>`, `<span></span>`);
    document.querySelectorAll<HTMLButtonElement>("[data-load]").forEach((button) => {
        button.addEventListener("click", () => {
            const save = saves[button.dataset.load || ""];
            if (!save) return;
            doc = normalizeDoc(save.doc);
            selectedIds.clear();
            history = [serializeDoc(doc)];
            historyIndex = 0;
            saveWorkingDoc();
            closeDialog();
            renderAllPanels();
        });
    });
    document.querySelectorAll<HTMLButtonElement>("[data-delete-save]").forEach((button) => {
        button.addEventListener("click", () => {
            const name = button.dataset.deleteSave || "";
            delete saves[name];
            localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
            openLoadDialog();
        });
    });
}

function saveNamedDoc() {
    const saves = loadSavedDocs();
    saves[doc.name] = {
        savedAt: Date.now(),
        doc: structuredClone(doc),
    };
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    saveWorkingDoc();
}

function loadSavedDocs(): Record<string, { savedAt: number; doc: EditorDoc }> {
    try {
        return JSON.parse(localStorage.getItem(SAVES_KEY) || "{}");
    } catch (_err) {
        return {};
    }
}

function openDialog(title: string, body: string, footer: string) {
    (document.getElementById("dialog-title") as HTMLHeadingElement).textContent = title;
    (document.getElementById("dialog-body") as HTMLDivElement).innerHTML = body;
    (document.getElementById("dialog-footer") as HTMLDivElement).innerHTML = footer;
    document.getElementById("dialog-backdrop")?.classList.add("active");
}

function closeDialog() {
    document.getElementById("dialog-backdrop")?.classList.remove("active");
}

function generateExport(): string {
    const hasBasement = doc.items.some((item) => item.layer === "basement" || item.layer === "basementFloor");
    const base = buildBuildingDef("base");
    const baseCode = `${doc.name}: ${formatBuilding(base, hasBasement ? doc.name + "_basement" : undefined)}`;
    if (!hasBasement) return `${baseCode},`;
    const basement = buildBuildingDef("basement");
    return `${baseCode},\n\n${doc.name}_basement: ${formatBuilding(basement)},`;
}

function buildBuildingDef(section: "base" | "basement") {
    const isBasement = section === "basement";
    const floorLayers: LayerId[] = isBasement ? ["basementFloor"] : ["floor"];
    const objectLayers: LayerId[] = isBasement ? ["basement"] : ["walls", "objects"];
    const floorItems = doc.items.filter((item) => floorLayers.includes(item.layer));
    const roofItems = isBasement ? [] : doc.items.filter((item) => item.layer === "roof");
    const hitboxes = doc.items.filter((item) => {
        if (item.layer !== "hitboxes") return false;
        const basementHitbox = item.name.toLowerCase().includes("basement");
        return isBasement ? basementHitbox : !basementHitbox;
    });
    const mapObjects = doc.items.filter((item) => objectLayers.includes(item.layer) && item.type);

    const surfaceColliders = hitboxes.length
        ? hitboxes.map((item) => firstAabb(itemColliders(item)[0]))
        : floorItems.map((item) => firstAabb(itemColliders(item)[0]));
    const zoomColliders = roofItems.length
        ? [boundsForItems([...floorItems, ...mapObjects])]
        : surfaceColliders;

    return {
        mapDisplay: !isBasement,
        mapColor: doc.mapColor,
        zIdx: isBasement ? 0 : doc.zIdx,
        floorImgs: floorItems.filter((item) => item.sprite).map(itemToFloorImage),
        floorSurfaces: [
            {
                type: floorItems[0]?.surfaceType || "wood",
                collision: surfaceColliders.filter(Boolean) as AABB[],
            },
        ],
        ceilingImgs: roofItems.filter((item) => item.sprite).map(itemToFloorImage),
        zoomRegions: zoomColliders.filter(Boolean) as AABB[],
        mapObjects: mapObjects.map(itemToMapObject),
    };
}

function itemToFloorImage(item: EditorItem) {
    return {
        sprite: item.sprite || "none",
        pos: v2.create(item.x, item.y),
        scale: item.assetScale * item.scale,
        alpha: item.alpha,
        tint: item.tint,
        rot: radToOri(item.rotation),
    };
}

function itemToMapObject(item: EditorItem) {
    return {
        type: item.type || item.name,
        pos: v2.create(item.x, item.y),
        scale: item.scale,
        ori: radToOri(item.rotation),
        ignoreMapSpawnReplacement: item.ignoreMapSpawnReplacement,
    };
}

function boundsForItems(items: EditorItem[]): AABB | null {
    if (!items.length) return null;
    const min = v2.create(Number.MAX_VALUE, Number.MAX_VALUE);
    const max = v2.create(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (const item of items) {
        const box = itemBounds(item);
        min.x = Math.min(min.x, box.min.x);
        min.y = Math.min(min.y, box.min.y);
        max.x = Math.max(max.x, box.max.x);
        max.y = Math.max(max.y, box.max.y);
    }
    return collider.createAabb(min, max);
}

function firstAabb(col?: Collider): AABB | null {
    if (!col) return null;
    return collider.toAabb(col);
}

function formatBuilding(
    building: ReturnType<typeof buildBuildingDef>,
    basementName?: string,
): string {
    const lines: string[] = [];
    lines.push("{");
    lines.push(`    type: "building",`);
    lines.push(
        `    map: { display: ${building.mapDisplay}, color: ${hexColor(building.mapColor)}, scale: 1 },`,
    );
    lines.push(`    terrain: { grass: ${doc.terrain.grass}, beach: ${doc.terrain.beach} },`);
    lines.push(`    zIdx: ${building.zIdx},`);
    lines.push(`    floor: {`);
    lines.push(`        surfaces: [`);
    for (const surface of building.floorSurfaces) {
        lines.push(`            {`);
        lines.push(`                type: "${surface.type}",`);
        lines.push(`                collision: [`);
        for (const col of surface.collision) {
            lines.push(`                    ${formatAabb(col)},`);
        }
        lines.push(`                ],`);
        lines.push(`            },`);
    }
    lines.push(`        ],`);
    lines.push(`        imgs: [`);
    for (const img of building.floorImgs) {
        lines.push(`            ${formatFloorImage(img)},`);
    }
    lines.push(`        ],`);
    lines.push(`    },`);
    lines.push(`    ceiling: {`);
    lines.push(`        zoomRegions: [`);
    for (const col of building.zoomRegions) {
        lines.push(`            { zoomIn: ${formatAabb(col)} },`);
    }
    lines.push(`        ],`);
    lines.push(`        imgs: [`);
    for (const img of building.ceilingImgs) {
        lines.push(`            ${formatFloorImage(img)},`);
    }
    lines.push(`        ],`);
    lines.push(`    },`);
    lines.push(`    mapObjects: [`);
    for (const obj of building.mapObjects) {
        const extra = obj.ignoreMapSpawnReplacement
            ? `,\n            ignoreMapSpawnReplacement: true`
            : "";
        lines.push(`        {`);
        lines.push(`            type: "${obj.type}",`);
        lines.push(`            pos: ${formatVec(obj.pos)},`);
        lines.push(`            scale: ${formatNum(obj.scale)},`);
        lines.push(`            ori: ${obj.ori}${extra ? extra : ""},`);
        lines.push(`        },`);
    }
    lines.push(`    ],`);
    if (basementName) {
        lines.push(`    basement: "${basementName}",`);
    }
    lines.push("}");
    return lines.join("\n");
}

function formatFloorImage(img: ReturnType<typeof itemToFloorImage>): string {
    const parts = [
        `sprite: "${img.sprite}"`,
        `pos: ${formatVec(img.pos)}`,
        `scale: ${formatNum(img.scale)}`,
        `alpha: ${formatNum(img.alpha)}`,
        `tint: ${hexColor(img.tint)}`,
    ];
    if (img.rot) parts.push(`rot: ${img.rot}`);
    return `{ ${parts.join(", ")} }`;
}

function formatAabb(col: AABB): string {
    const center = v2.mul(v2.add(col.min, col.max), 0.5);
    const extents = v2.mul(v2.sub(col.max, col.min), 0.5);
    return `collider.createAabbExtents(${formatVec(center)}, ${formatVec(extents)})`;
}

function formatVec(pos: Vec2): string {
    return `v2.create(${formatNum(pos.x)}, ${formatNum(pos.y)})`;
}

function importDocument(text: string): EditorDoc {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Paste a building definition first.");
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed.schemaVersion === 1) return normalizeDoc(parsed);
    } catch (_err) {
        // Try TypeScript object literal below.
    }

    const evaluated = evaluateBuildingSnippet(trimmed) as any;
    if (evaluated.schemaVersion === 1) return normalizeDoc(evaluated);

    const defs: Record<string, BuildingDef> =
        evaluated.type === "building" ? { [doc.name]: evaluated as BuildingDef } : evaluated;
    const [name, baseDef] =
        Object.entries(defs).find(([, def]) => def?.type === "building") || [];
    if (!name || !baseDef) throw new Error("Could not find a BuildingDef in that import.");

    const next = createEmptyDoc();
    next.name = sanitizeKey(name);
    importBuildingIntoDoc(next, baseDef, false);
    if (baseDef.basement && defs[baseDef.basement]) {
        importBuildingIntoDoc(next, defs[baseDef.basement], true);
    }
    return next;
}

function evaluateBuildingSnippet(text: string): Record<string, BuildingDef> | BuildingDef | EditorDoc {
    const expression = expressionFromSnippet(text);
    const fakeUtil = {
        mergeDeep: (_base: unknown, value: unknown) => value,
    };
    const randomObstacleType = (value: unknown) => value;
    const fn = new Function(
        "v2",
        "collider",
        "randomObstacleType",
        "util",
        `"use strict"; return (${expression});`,
    );
    return fn(v2, collider, randomObstacleType, fakeUtil);
}

function expressionFromSnippet(text: string): string {
    const trimmed = text.trim().replace(/,\s*$/, "");
    if (trimmed.startsWith("{")) return trimmed;
    const assignment = trimmed.match(/=\s*({[\s\S]*})\s*;?$/);
    if (assignment) return assignment[1];
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(trimmed)) {
        return `{${trimmed}}`;
    }
    return trimmed;
}

function importBuildingIntoDoc(next: EditorDoc, building: BuildingDef, basement: boolean) {
    const floorLayer: LayerId = basement ? "basementFloor" : "floor";
    const objectLayer: LayerId = basement ? "basement" : "objects";
    const wallLayer: LayerId = basement ? "basement" : "walls";

    for (const img of building.floor?.imgs || []) {
        next.items.push({
            id: makeId("part"),
            name: img.sprite,
            kind: basement ? "basementFloor" : "floor",
            layer: floorLayer,
            sprite: img.sprite,
            x: img.pos?.x || 0,
            y: img.pos?.y || 0,
            rotation: oriToRad(img.rot || 0),
            scale: 1,
            assetScale: img.scale || 1,
            fallbackWidth: 16,
            fallbackHeight: 12,
            alpha: img.alpha ?? 1,
            tint: img.tint ?? 0xffffff,
            surfaceType: building.floor.surfaces?.[0]?.type || "wood",
            localCollider: createAabbCollider(16, 12),
        });
    }
    if (!basement) {
        for (const img of building.ceiling?.imgs || []) {
            next.items.push({
                id: makeId("part"),
                name: img.sprite,
                kind: "roof",
                layer: "roof",
                sprite: img.sprite,
                x: img.pos?.x || 0,
                y: img.pos?.y || 0,
                rotation: oriToRad(img.rot || 0),
                scale: 1,
                assetScale: img.scale || 1,
                fallbackWidth: 18,
                fallbackHeight: 14,
                alpha: img.alpha ?? 1,
                tint: img.tint ?? 0xffffff,
                localCollider: createAabbCollider(18, 14),
            });
        }
    }
    for (const surface of building.floor?.surfaces || []) {
        for (const col of surface.collision || []) {
            const box = collider.toAabb(col);
            const size = v2.sub(box.max, box.min);
            const center = v2.mul(v2.add(box.min, box.max), 0.5);
            next.items.push({
                id: makeId("part"),
                name: basement ? "basement_collision" : "floor_collision",
                kind: "hitbox",
                layer: "hitboxes",
                x: center.x,
                y: center.y,
                rotation: 0,
                scale: 1,
                assetScale: 1,
                fallbackWidth: size.x,
                fallbackHeight: size.y,
                alpha: 1,
                tint: 0xffffff,
                surfaceType: surface.type,
                localCollider: createAabbCollider(size.x, size.y),
            });
        }
    }
    for (const obj of building.mapObjects || []) {
        if (!obj.type || typeof obj.type !== "string") continue;
        const def = MapObjectDefs[obj.type];
        const obstacle = def?.type === "obstacle" ? (def as ObstacleDef) : undefined;
        const classification = obstacle
            ? classifyObstacle(obj.type, obstacle)
            : { kind: "object" as ItemKind, layer: objectLayer };
        next.items.push({
            id: makeId("part"),
            name: obj.type,
            kind: basement ? classification.kind === "wall" ? "basementWall" : "basementObject" : classification.kind,
            layer: basement ? objectLayer : classification.layer === "walls" ? wallLayer : objectLayer,
            type: obj.type,
            sprite: obstacle?.img?.sprite,
            x: obj.pos.x,
            y: obj.pos.y,
            rotation: oriToRad(obj.ori || 0),
            scale: obj.scale || 1,
            assetScale: obstacle?.img?.scale ?? 1,
            fallbackWidth: obstacle ? fallbackSizeFromCollider(obstacle.collision).width : 3,
            fallbackHeight: obstacle ? fallbackSizeFromCollider(obstacle.collision).height : 3,
            alpha: 1,
            tint: 0xffffff,
            ignoreMapSpawnReplacement: obj.ignoreMapSpawnReplacement,
            localCollider: obstacle?.collision || createAabbCollider(3, 3),
        });
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return entities[char];
    });
}

function escapeAttr(value: string): string {
    return escapeHtml(value);
}

function formatNum(value: number): string {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function hexColor(value: number): string {
    return `0x${Math.round(value).toString(16).padStart(6, "0")}`;
}

function parseHexColor(value: string, fallback: number): number {
    const clean = value.trim().replace(/^#/, "").replace(/^0x/, "");
    const parsed = Number.parseInt(clean, 16);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function hexCss(value: number): string {
    return `#${Math.round(value).toString(16).padStart(6, "0")}`;
}

function scopeToCameraZoom(scope: string): number {
    const desktopScopes = GameConfig.scopeZoomRadius.desktop;
    const radius = desktopScopes[scope] || desktopScopes[DEFAULT_SCOPE];
    return clamp((desktopScopes[DEFAULT_SCOPE] / radius) * 1.6, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
}

function scopeLabel(scope: string): string {
    return scope === "custom" ? "Custom scope" : scope.replace("scope", " scope");
}

function customScopeName(zoom: number): string {
    const matchingScope = scopeOrder.find(
        (scope) => Math.abs(scopeToCameraZoom(scope) - zoom) < 0.005,
    );
    return matchingScope || "custom";
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function oriToRad(ori: number): number {
    return (((Math.round(ori) % 4) + 4) % 4) * Math.PI * 0.5;
}

function radToOri(rad: number): number {
    return ((Math.round(rad / (Math.PI * 0.5)) % 4) + 4) % 4;
}

window.addEventListener("resize", resizeCanvas);
if ("ResizeObserver" in window) {
    new ResizeObserver(() => resizeCanvas()).observe(canvas.parentElement ?? canvas);
}
resizeCanvas();
setupControls();
renderAllPanels();
syncModeButtons();
syncScopeButtons();
syncPanelToggles();
requestAnimationFrame(renderFrame);
