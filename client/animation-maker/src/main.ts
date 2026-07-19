import * as PIXI from "pixi.js-legacy";
import atlasDefs from "virtual-atlases-low";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { GunDef } from "../../../shared/defs/gameObjects/gunDefs";
import type { MeleeDef } from "../../../shared/defs/gameObjects/meleeDefs";
import { Animations, Bones, IdlePoses } from "../../src/animData";
import "./styles.css";

const STORAGE_KEY = "resurviv-animation-maker-v1";
const BONE_IDS = [Bones.HandL, Bones.HandR, Bones.FootL, Bones.FootR] as const;
const BONE_NAMES: Record<number, string> = {
    [Bones.HandL]: "Left hand",
    [Bones.HandR]: "Right hand",
    [Bones.FootL]: "Left foot",
    [Bones.FootR]: "Right foot",
};
const BONE_SHORT: Record<number, string> = {
    [Bones.HandL]: "LH",
    [Bones.HandR]: "RH",
    [Bones.FootL]: "LF",
    [Bones.FootR]: "RF",
};
const BONE_COLORS: Record<number, number> = {
    [Bones.HandL]: 0x5fd1ff,
    [Bones.HandR]: 0xffa85f,
    [Bones.FootL]: 0x79df87,
    [Bones.FootR]: 0xd58cff,
};
const GAME_SPRITE_NAMES = new Set(
    Object.values(atlasDefs as Record<string, PIXI.ISpritesheetData[]>).flatMap(
        (sheets) => sheets.flatMap((sheet) => Object.keys(sheet.frames)),
    ),
);

interface Point {
    x: number;
    y: number;
}
interface EditorPose {
    pos: Point;
    pivot: Point;
    rot: number;
}
interface EditorFrame {
    id: string;
    time: number;
    bones: Record<number, EditorPose>;
}
interface EditorEffect {
    id: string;
    time: number;
    fn: string;
    args: string;
}
interface EditorImage {
    id: string;
    sprite: string;
    attach: "body" | "handL" | "handR";
    pos: Point;
    rot: number;
    scale: Point;
    tint: number;
    alpha: number;
    startTime: number;
    endTime: number;
    onTop: boolean;
}
interface EditorDoc {
    name: string;
    idlePose: string;
    weapon: string;
    duration: number;
    loop: boolean;
    mirror: boolean;
    frames: EditorFrame[];
    effects: EditorEffect[];
    images: EditorImage[];
}

const root = document.getElementById("animation-maker");
if (!root) throw new Error("Missing #animation-maker root");

root.innerHTML = `
<div class="app-shell">
  <header class="topbar">
    <div class="brand"><span class="brand-mark">R</span><div><h1>Animation Maker</h1><p>Runtime-accurate pose editor</p></div></div>
    <label class="compact-field name-field"><span>Animation name</span><input id="anim-name" spellcheck="false"></label>
    <div class="top-actions">
      <button id="new-doc" class="button ghost">New</button>
      <button id="import" class="button ghost">Import</button>
      <button id="export" class="button primary">Copy game code</button>
    </div>
  </header>
  <main class="workspace">
    <aside class="sidebar left-sidebar">
      <section class="panel-section">
        <div class="section-heading"><h2>Setup</h2><span class="hint">Preview context</span></div>
        <label class="field"><span>Start from animation</span><select id="existing-animation"></select></label>
        <label class="field"><span>Idle pose</span><select id="idle-pose"></select></label>
        <label class="field"><span>Held item</span><select id="weapon"></select></label>
        <div class="two-fields">
          <label class="field"><span>Duration</span><div class="unit-input"><input id="duration" type="number" min="0.01" step="0.01"><b>s</b></div></label>
          <label class="field"><span>Playback</span><select id="speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        </div>
        <div class="toggle-row"><label><input id="loop" type="checkbox" checked><span>Loop</span></label><label><input id="mirror" type="checkbox"><span>Mirror</span></label></div>
      </section>
      <section class="panel-section grow">
        <div class="section-heading"><h2>Keyframes</h2><button id="add-frame" class="icon-button" title="Add keyframe">+</button></div>
        <div id="frame-list" class="item-list"></div>
      </section>
      <section class="panel-section">
        <div class="section-heading"><h2>Events</h2><button id="add-effect" class="icon-button" title="Add event">+</button></div>
        <div id="effect-list" class="effect-list"></div>
      </section>
      <section class="panel-section">
        <div class="section-heading"><h2>Images</h2><button id="add-image" class="icon-button" title="Add animation image">+</button></div>
        <div id="image-list" class="image-list"></div>
      </section>
    </aside>
    <section class="stage-column">
      <div class="stage-toolbar">
        <div class="playback-controls"><button id="jump-start" class="round-button" title="Start">|◀</button><button id="play" class="play-button" title="Play or pause">▶</button><button id="jump-end" class="round-button" title="End">▶|</button></div>
        <div class="time-readout"><strong id="current-time">0.000</strong><span>/</span><span id="total-time">0.250 s</span></div>
        <div class="stage-help">Click an image to edit it in the side card · drag to move · Shift+wheel scale · Alt+wheel rotate</div>
        <button id="reset-view" class="button ghost small">Reset view</button>
      </div>
      <div id="canvas-wrap" class="canvas-wrap"><canvas id="preview-canvas"></canvas><div class="handle-legend"><span class="cyan">LH <b>Left hand</b></span><span class="orange">RH <b>Right hand</b></span><span class="green">LF <b>Left foot</b></span><span class="purple">RF <b>Right foot</b></span></div><div id="loading" class="loading"><span></span>Loading game sprites…</div><div class="axis-label x">aim direction</div></div>
      <div class="timeline-panel">
        <div class="timeline-tools"><button id="frame-at-playhead" class="button primary small">+ Key at playhead</button><span id="snap-label">Snap 0.01s</span><label class="range-label">Timeline zoom<input id="timeline-zoom" type="range" min="1" max="4" step="0.25" value="1"></label></div>
        <div id="timeline-scroll" class="timeline-scroll"><div id="timeline" class="timeline"></div></div>
      </div>
    </section>
    <aside class="sidebar right-sidebar">
      <section class="panel-section inspector">
        <div class="section-heading"><h2>Bone transform</h2><span id="bone-chip" class="bone-chip">Right hand</span></div>
        <div class="bone-tabs" id="bone-tabs"></div>
        <div class="inspector-group"><h3>Position</h3><div class="two-fields"><label class="field"><span>X</span><input id="pos-x" type="number" step="0.25"></label><label class="field"><span>Y</span><input id="pos-y" type="number" step="0.25"></label></div></div>
        <div class="inspector-group"><h3>Rotation</h3><label class="field"><span>Angle</span><div class="unit-input"><input id="rotation" type="number" step="1"><b>deg</b></div></label><input id="rotation-range" class="wide-range" type="range" min="-360" max="360" step="1"></div>
        <div class="inspector-group"><h3>Extra offset</h3><div class="two-fields"><label class="field"><span>X</span><input id="pivot-x" type="number" step="0.25"></label><label class="field"><span>Y</span><input id="pivot-y" type="number" step="0.25"></label></div><p class="field-note">Advanced Pose position offset. Most game animations leave this at 0.</p></div>
        <div class="inspector-actions"><button id="copy-pose" class="button ghost">Copy pose</button><button id="paste-pose" class="button ghost">Paste</button><button id="reset-pose" class="button danger">Reset to idle</button></div>
      </section>
      <section id="image-inspector" class="panel-section image-inspector hidden">
        <div class="section-heading"><h2>Image transform</h2><span class="image-selected-chip">LIVE</span></div>
        <div class="selected-image-row"><div><strong id="ins-image-name"></strong><span id="ins-image-time-label"></span></div><button id="change-image-sprite" class="button ghost small">Change</button></div>
        <label class="field"><span>Follow</span><select id="ins-image-attach"><option value="body">Player body</option><option value="handL">Left hand (automatic)</option><option value="handR">Right hand (automatic)</option></select></label>
        <p id="ins-image-follow-note" class="image-follow-note"></p>
        <div class="two-fields"><label class="field"><span>Position X</span><input id="ins-image-x" type="number" step="0.25"></label><label class="field"><span>Position Y</span><input id="ins-image-y" type="number" step="0.25"></label></div>
        <label class="field"><span>Rotation</span><div class="unit-input"><input id="ins-image-rotation" type="number" step="1"><b>deg</b></div></label>
        <div class="two-fields"><label class="field"><span>Scale X</span><input id="ins-image-scale-x" type="number" step="0.05"></label><label class="field"><span>Scale Y</span><input id="ins-image-scale-y" type="number" step="0.05"></label></div>
        <div class="two-fields"><label class="field"><span>Start</span><div class="unit-input"><input id="ins-image-start" type="number" min="0" step="0.01"><b>s</b></div></label><label class="field"><span>End</span><div class="unit-input"><input id="ins-image-end" type="number" min="0" step="0.01"><b>s</b></div></label></div>
        <div class="two-fields"><label class="field"><span>Opacity</span><input id="ins-image-alpha" type="number" min="0" max="1" step="0.05"></label><label class="field"><span>Tint</span><input id="ins-image-tint" placeholder="#ffffff"></label></div>
        <label class="image-checkbox"><input id="ins-image-on-top" type="checkbox"><span>Draw above attachment</span></label>
        <button id="ins-delete-image" class="button danger image-delete-button">Delete image</button>
      </section>
      <section class="panel-section tips"><h2>Game-ready output</h2><p>Every key includes all four bones and uses <code>Pose</code>, <code>v2.create</code>, radians, and effect helpers from <code>animData.ts</code>.</p><div class="status-line"><i></i><span>Autosaved in this browser</span></div></section>
    </aside>
  </main>
  <div id="toast" class="toast"></div>
  <dialog id="code-dialog"><div class="dialog-head"><div><h2 id="dialog-title">Export</h2><p id="dialog-subtitle"></p></div><button id="close-dialog" class="round-button">×</button></div><textarea id="code-area" spellcheck="false"></textarea><div class="dialog-actions"><button id="dialog-copy" class="button primary">Copy to clipboard</button><button id="dialog-load" class="button primary hidden">Load animation</button></div></dialog>
  <dialog id="image-dialog" class="image-dialog"><div class="dialog-head"><div><h2>Choose game sprite</h2><p>Click a thumbnail to use it. Position, timing, and appearance are edited in the side card.</p></div><button id="close-image-dialog" class="round-button">×</button></div><div class="image-form"><label class="field image-sprite-field"><span>Selected sprite</span><input id="image-sprite" placeholder="Choose a sprite below" readonly></label><label class="field"><span>Attach to</span><select id="image-attach"><option value="body">Body</option><option value="handL">Left hand</option><option value="handR">Right hand</option></select></label><div class="sprite-browser"><div class="sprite-browser-tools"><input id="sprite-search" placeholder="Search sprites, e.g. frag or bazooka" spellcheck="false"><select id="sprite-category"><option value="all">All sprites</option><option value="projectile">Projectiles</option><option value="weapon">Weapons</option><option value="loot">Loot</option><option value="particle">Particles</option><option value="player">Player</option><option value="map">Map</option></select><span id="sprite-result-count"></span></div><div id="sprite-gallery" class="sprite-gallery"></div></div><label class="field"><span>Position X</span><input id="image-x" type="number" step="0.25"></label><label class="field"><span>Position Y</span><input id="image-y" type="number" step="0.25"></label><label class="field"><span>Rotation</span><div class="unit-input"><input id="image-rotation" type="number" step="1"><b>deg</b></div></label><label class="field"><span>Opacity</span><input id="image-alpha" type="number" min="0" max="1" step="0.05"></label><label class="field"><span>Scale X</span><input id="image-scale-x" type="number" step="0.05"></label><label class="field"><span>Scale Y</span><input id="image-scale-y" type="number" step="0.05"></label><label class="field"><span>Start time</span><div class="unit-input"><input id="image-start" type="number" min="0" step="0.01"><b>s</b></div></label><label class="field"><span>End time</span><div class="unit-input"><input id="image-end" type="number" min="0" step="0.01"><b>s</b></div></label><label class="field"><span>Tint</span><input id="image-tint" placeholder="#ffffff"></label><label class="image-checkbox"><input id="image-on-top" type="checkbox" checked><span>Draw above attachment</span></label></div><div class="dialog-actions"><button id="delete-image" class="button danger">Delete</button><button id="save-image" class="button primary">Use selected sprite</button></div></dialog>
</div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("preview-canvas");
const canvasWrap = $("canvas-wrap");
const app = new PIXI.Application({
    view: canvas,
    resizeTo: canvasWrap,
    antialias: true,
    backgroundColor: 0x668b52,
    resolution: window.devicePixelRatio,
    autoDensity: true,
});
const world = new PIXI.Container();
const player = new PIXI.Container();
const grid = new PIXI.Graphics();
const body = new PIXI.Sprite();
const imageSelectionOutline = new PIXI.Graphics();
const imageRotationHandle = new PIXI.Graphics();
const boneContainers: Record<number, PIXI.Container> = {};
const boneSprites: Record<number, PIXI.Sprite> = {};
const handles: Record<number, PIXI.Graphics> = {};
let weaponObjects: PIXI.DisplayObject[] = [];
let animationImageObjects: Array<{ id: string; sprite: PIXI.Sprite }> = [];
let animationImageRevision = 0;
let editingImageId = "";
let selectedAnimationImageId = "";
let imageDrag:
    | {
          id: string;
          parent: PIXI.Container;
          offset: Point;
      }
    | undefined;
let imageRotateDrag:
    | {
          id: string;
          center: Point;
          startAngle: number;
          startDisplayRotation: number;
      }
    | undefined;
let imageGizmoCenter = { x: 0, y: 0 };
const atlasSheetLoads = new Map<string, Promise<void>>();
let spriteGalleryRevision = 0;
let spriteSearchTimer = 0;
let playing = false;
let playhead = 0;
let playbackSpeed = 1;
let selectedFrameId = "";
let selectedBone: number = Bones.HandR;
let poseClipboard: EditorPose | undefined;
let camera = { x: 0, y: 0, zoom: 3.2 };
let panStart: { x: number; y: number; cameraX: number; cameraY: number } | undefined;
let dragBone: number | undefined;
let dragPointerOffset = { x: 0, y: 0 };
let timelineDrag:
    | { type: "keyframe"; frameId: string }
    | { type: "playhead" }
    | {
          type: "image-range";
          imageId: string;
          edge: "start" | "end" | "move";
          grabOffset: number;
          duration: number;
      }
    | undefined;
let timelineZoom = 1;
let toastTimer = 0;

app.stage.addChild(grid, world, imageSelectionOutline, imageRotationHandle);
imageRotationHandle.eventMode = "static";
imageRotationHandle.cursor = "crosshair";
imageRotationHandle.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
    const preview = animationImageObjects.find(
        (item) => item.id === selectedAnimationImageId,
    );
    if (!preview) return;
    imageRotateDrag = {
        id: selectedAnimationImageId,
        center: { ...imageGizmoCenter },
        startAngle: Math.atan2(
            event.global.y - imageGizmoCenter.y,
            event.global.x - imageGizmoCenter.x,
        ),
        startDisplayRotation: preview.sprite.rotation,
    };
    playing = false;
    event.stopPropagation();
});
world.addChild(player);
player.addChild(body);
for (const bone of BONE_IDS) {
    const container = new PIXI.Container();
    const sprite = new PIXI.Sprite();
    sprite.anchor.set(0.5);
    container.addChild(sprite);
    boneContainers[bone] = container;
    boneSprites[bone] = sprite;
    player.addChild(container);
}
for (const bone of BONE_IDS) {
    const handle = new PIXI.Graphics();
    handle.eventMode = "static";
    handle.cursor = "grab";
    handle.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
        const pointer = event.getLocalPosition(world);
        dragPointerOffset = {
            x: pointer.x - handle.position.x,
            y: pointer.y - handle.position.y,
        };
        selectedBone = bone;
        const frameAtPlayhead = doc.frames.find(
            (frame) => Math.abs(frame.time - playhead) < 0.0001,
        );
        if (frameAtPlayhead) selectedFrameId = frameAtPlayhead.id;
        else addFrame(playhead);
        dragBone = bone;
        handle.cursor = "grabbing";
        world.addChild(handle);
        event.stopPropagation();
        renderAll();
    });
    handles[bone] = handle;
    world.addChild(handle);
}

function id() {
    return Math.random().toString(36).slice(2, 10);
}
function clonePose(pose: EditorPose): EditorPose {
    return { pos: { ...pose.pos }, pivot: { ...pose.pivot }, rot: pose.rot };
}
function idlePoseFor(bone: number, idleName: string): EditorPose {
    const key = bone as Bones;
    const pose = IdlePoses[idleName]?.[key] ??
        IdlePoses.fists[key] ?? { pos: { x: 0, y: 0 }, pivot: { x: 0, y: 0 }, rot: 0 };
    return {
        pos: { x: pose.pos.x, y: pose.pos.y },
        pivot: { x: pose.pivot.x, y: pose.pivot.y },
        rot: pose.rot,
    };
}
function completeBones(
    source: Partial<Record<number, EditorPose>>,
    idleName: string,
): Record<number, EditorPose> {
    return Object.fromEntries(
        BONE_IDS.map((bone) => [
            bone,
            clonePose(source[bone] ?? idlePoseFor(bone, idleName)),
        ]),
    );
}
function blankDoc(): EditorDoc {
    const idlePose = "fists";
    return {
        name: "myAnimation",
        idlePose,
        weapon: "fists",
        duration: 0.25,
        loop: true,
        mirror: false,
        frames: [
            { id: id(), time: 0, bones: completeBones({}, idlePose) },
            { id: id(), time: 0.25, bones: completeBones({}, idlePose) },
        ],
        effects: [],
        images: [],
    };
}
function docFromAnimation(name: string): EditorDoc {
    const anim = Animations[name];
    const idlePose = inferIdlePose(name);
    const frames: EditorFrame[] = anim.keyframes.map((frame) => ({
        id: id(),
        time: frame.time,
        bones: completeBones(
            Object.fromEntries(
                BONE_IDS.flatMap((bone) => {
                    const pose = frame.bones[bone];
                    return pose
                        ? [
                              [
                                  bone,
                                  {
                                      pos: { x: pose.pos.x, y: pose.pos.y },
                                      pivot: { x: pose.pivot.x, y: pose.pivot.y },
                                      rot: pose.rot,
                                  } as EditorPose,
                              ],
                          ]
                        : [];
                }),
            ),
            idlePose,
        ),
    }));
    if (!frames.length) return blankDoc();
    return {
        name,
        idlePose,
        weapon: inferWeapon(name),
        duration: Math.max(0.05, frames.at(-1)!.time),
        loop: true,
        mirror: false,
        frames,
        effects: anim.effects.map((effect) => ({
            id: id(),
            time: effect.time,
            fn: String(effect.fn),
            args: JSON.stringify(effect.args ?? {}),
        })),
        images: (anim.images ?? []).map((image) => ({
            id: id(),
            sprite: image.sprite,
            attach: image.attach,
            pos: { x: image.pos.x, y: image.pos.y },
            rot: image.rot,
            scale: { x: image.scale.x, y: image.scale.y },
            tint: image.tint ?? 0xffffff,
            alpha: image.alpha ?? 1,
            startTime: image.startTime ?? 0,
            endTime: image.endTime ?? Math.max(0.05, frames.at(-1)!.time),
            onTop: image.onTop !== false,
        })),
    };
}
function inferIdlePose(name: string) {
    if (IdlePoses[name]) return name;
    if (name.toLowerCase().includes("lasr")) return "meleeLasrSwrd";
    if (["slash", "spin"].some((part) => name.includes(part))) return "slash";
    if (name.includes("katana")) return "meleeKatana";
    return "fists";
}
function inferWeapon(name: string) {
    if (name.toLowerCase().includes("lasr")) return "lasr_swrd";
    if (name.includes("katana")) return "katana";
    if (name === "slash" || name === "spin") return "karambit";
    return "fists";
}

function idlePoseForWeapon(weapon: string) {
    const def = (GameObjectDefs as unknown as Record<string, GunDef | MeleeDef>)[weapon];
    if (!def) return "fists";
    if (def.type === "melee") return def.anim?.idlePose || "fists";
    if (def.pistol) return def.isDual ? "dualPistol" : "pistol";
    if (def.isBullpup) return "bullpup";
    if (def.isLauncher) return "launcher";
    return def.isDual ? "dualRifle" : "rifle";
}

function samePose(a: EditorPose, b: EditorPose) {
    return (
        Math.abs(a.pivot.x - b.pivot.x) < 0.0001 &&
        Math.abs(a.pivot.y - b.pivot.y) < 0.0001 &&
        Math.abs(a.pos.x - b.pos.x) < 0.0001 &&
        Math.abs(a.pos.y - b.pos.y) < 0.0001 &&
        Math.abs(a.rot - b.rot) < 0.0001
    );
}

function changeIdlePose(nextIdlePose: string) {
    const previousIdlePose = doc.idlePose;
    if (previousIdlePose === nextIdlePose) return;
    for (const frame of doc.frames) {
        for (const bone of BONE_IDS) {
            if (samePose(frame.bones[bone], idlePoseFor(bone, previousIdlePose))) {
                frame.bones[bone] = idlePoseFor(bone, nextIdlePose);
            }
        }
    }
    doc.idlePose = nextIdlePose;
}
function normalizeDoc(value: EditorDoc): EditorDoc {
    const base = blankDoc();
    const idlePose = IdlePoses[value.idlePose] ? value.idlePose : "fists";
    const frames = Array.isArray(value.frames)
        ? value.frames
              .map((frame) => ({
                  id: frame.id || id(),
                  time: Number(frame.time) || 0,
                  bones: completeBones(frame.bones || {}, idlePose),
              }))
              .sort((a, b) => a.time - b.time)
        : base.frames;
    return {
        ...base,
        ...value,
        idlePose,
        duration: Math.max(Number(value.duration) || 0.25, frames.at(-1)?.time ?? 0.25),
        frames,
        effects: Array.isArray(value.effects) ? value.effects : [],
        images: Array.isArray(value.images)
            ? value.images.map((image) => ({
                  id: image.id || id(),
                  sprite: String(image.sprite || ""),
                  attach: ["body", "handL", "handR"].includes(image.attach)
                      ? image.attach
                      : "body",
                  pos: { x: Number(image.pos?.x) || 0, y: Number(image.pos?.y) || 0 },
                  rot: Number(image.rot) || 0,
                  scale: {
                      x: Number(image.scale?.x) || 0.25,
                      y: Number(image.scale?.y) || 0.25,
                  },
                  tint: Number(image.tint) || 0xffffff,
                  alpha: Number.isFinite(Number(image.alpha))
                      ? clamp(Number(image.alpha), 0, 1)
                      : 1,
                  startTime: Math.max(0, Number(image.startTime) || 0),
                  endTime: Math.max(0, Number(image.endTime) || value.duration || 0.25),
                  onTop: image.onTop !== false,
              }))
            : [],
    };
}
let doc = (() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? normalizeDoc(JSON.parse(saved)) : docFromAnimation("fists");
    } catch {
        return docFromAnimation("fists");
    }
})();
// Migrate documents saved before weapon selection automatically chose the
// matching in-game idle pose.
const savedWeaponIdlePose = idlePoseForWeapon(doc.weapon);
if (doc.idlePose === "fists" && savedWeaponIdlePose !== "fists") {
    changeIdlePose(savedWeaponIdlePose);
}
selectedFrameId = doc.frames[0].id;

function selectedFrame() {
    return doc.frames.find((frame) => frame.id === selectedFrameId) ?? doc.frames[0];
}
function selectedPose() {
    return selectedFrame().bones[selectedBone];
}
function selectedImage() {
    return doc.images.find((image) => image.id === selectedAnimationImageId);
}
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}
function changed() {
    doc.frames.sort((a, b) => a.time - b.time);
    doc.duration = Math.max(doc.duration, doc.frames.at(-1)?.time ?? 0);
    save();
    renderAll();
}
function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
function round(value: number, precision = 3) {
    const p = 10 ** precision;
    return Math.round(value * p) / p;
}
function esc(value: string) {
    return value.replace(
        /[&<>"']/g,
        (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
}

function populateSelects() {
    $("existing-animation").innerHTML =
        `<option value="">Choose a built-in…</option>${Object.keys(Animations)
            .filter((name) => name !== "none")
            .sort()
            .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`)
            .join("")}`;
    $("idle-pose").innerHTML = Object.keys(IdlePoses)
        .sort()
        .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`)
        .join("");
    const weapons = Object.entries(
        GameObjectDefs as Record<string, { type?: string; name?: string }>,
    )
        .filter(([, def]) => def.type === "gun" || def.type === "melee")
        .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
    $("weapon").innerHTML = weapons
        .map(
            ([key, def]) =>
                `<option value="${esc(key)}">${esc(def.name || key)} · ${def.type}</option>`,
        )
        .join("");
    $("bone-tabs").innerHTML = BONE_IDS.map(
        (bone) =>
            `<button data-bone="${bone}" style="--bone-color:#${BONE_COLORS[bone].toString(16).padStart(6, "0")}">${BONE_SHORT[bone]}<span>${BONE_NAMES[bone]}</span></button>`,
    ).join("");
}

async function loadSprites() {
    const defs = atlasDefs as Record<string, PIXI.ISpritesheetData[]>;
    // Player, hand, gun, and melee world sprites all live in the loadout atlas.
    // Loading just this atlas keeps the maker quick while using the exact game art.
    for (const sheets of [defs.loadout ?? []]) {
        for (const data of sheets) {
            await loadAtlasSheet(data);
        }
    }
    body.texture = PIXI.Texture.from("player-base-01.img");
    body.anchor.set(0.5);
    body.scale.set(0.25);
    body.tint = 0xf8c574;
    for (const bone of [Bones.HandL, Bones.HandR]) {
        boneSprites[bone].texture = PIXI.Texture.from("player-hands-01.img");
        boneSprites[bone].scale.set(0.175);
        boneSprites[bone].tint = 0xf8c574;
    }
    for (const bone of [Bones.FootL, Bones.FootR]) {
        boneSprites[bone].texture = PIXI.Texture.from("player-feet-01.img");
        boneSprites[bone].scale.set(0.45);
        boneSprites[bone].rotation = Math.PI / 2;
        boneSprites[bone].visible = false;
    }
    $("loading").classList.add("hidden");
    updateWeapon();
    await updateAnimationImages();
}

function loadAtlasSheet(data: PIXI.ISpritesheetData): Promise<void> {
    const image = data.meta.image!;
    const existing = atlasSheetLoads.get(image);
    if (existing) return existing;
    const load = (async () => {
        const texture = PIXI.BaseTexture.from(image);
        const sheet = new PIXI.Spritesheet(texture, data);
        await sheet.parse();
    })();
    atlasSheetLoads.set(image, load);
    return load;
}

async function ensureSpriteTexture(sprite: string) {
    if (PIXI.utils.TextureCache[sprite]) return;
    const defs = atlasDefs as Record<string, PIXI.ISpritesheetData[]>;
    for (const sheets of Object.values(defs)) {
        const data = sheets.find((sheet) => sprite in sheet.frames);
        if (data) {
            await loadAtlasSheet(data);
            return;
        }
    }
}

async function updateAnimationImages() {
    const revision = ++animationImageRevision;
    for (const image of animationImageObjects) image.sprite.destroy();
    animationImageObjects = [];
    for (const image of doc.images) {
        if (!image.sprite) continue;
        await ensureSpriteTexture(image.sprite);
        if (revision !== animationImageRevision) return;
        const sprite = PIXI.Sprite.from(image.sprite);
        sprite.anchor.set(0.5);
        sprite.position.set(image.pos.x, doc.mirror ? -image.pos.y : image.pos.y);
        sprite.rotation = doc.mirror ? -image.rot : image.rot;
        sprite.scale.set(image.scale.x, image.scale.y);
        sprite.tint = image.tint;
        sprite.alpha = image.alpha;
        let attach = image.attach;
        if (doc.mirror) {
            if (attach === "handL") attach = "handR";
            else if (attach === "handR") attach = "handL";
        }
        const parent =
            attach === "handL"
                ? boneContainers[Bones.HandL]
                : attach === "handR"
                  ? boneContainers[Bones.HandR]
                  : player;
        if (image.onTop) parent.addChild(sprite);
        else parent.addChildAt(sprite, 0);
        sprite.eventMode = "static";
        sprite.cursor = "move";
        sprite.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
            const point = event.getLocalPosition(parent);
            selectedAnimationImageId = image.id;
            imageDrag = {
                id: image.id,
                parent,
                offset: {
                    x: point.x - sprite.position.x,
                    y: point.y - sprite.position.y,
                },
            };
            playing = false;
            sprite.cursor = "grabbing";
            renderImages();
            renderImageInspector();
            updateImageGizmo();
            event.stopPropagation();
        });
        animationImageObjects.push({ id: image.id, sprite });
    }
    updateStage();
}

function updateImageGizmo() {
    const preview = animationImageObjects.find(
        (item) => item.id === selectedAnimationImageId,
    );
    if (!preview?.sprite.visible) {
        imageSelectionOutline.visible = false;
        imageRotationHandle.visible = false;
        return;
    }
    const bounds = preview.sprite.getBounds();
    imageGizmoCenter = {
        x: bounds.x + bounds.width * 0.5,
        y: bounds.y + bounds.height * 0.5,
    };
    const worldRotation = Math.atan2(
        preview.sprite.worldTransform.b,
        preview.sprite.worldTransform.a,
    );
    const handleAngle = worldRotation - Math.PI * 0.5;
    const handleRadius = Math.max(bounds.width, bounds.height) * 0.5 + 25;
    const handlePosition = {
        x: imageGizmoCenter.x + Math.cos(handleAngle) * handleRadius,
        y: imageGizmoCenter.y + Math.sin(handleAngle) * handleRadius,
    };
    imageSelectionOutline.visible = true;
    imageSelectionOutline
        .clear()
        .lineStyle(1.5, 0x5dc3a7, 0.95)
        .drawRoundedRect(
            bounds.x - 3,
            bounds.y - 3,
            bounds.width + 6,
            bounds.height + 6,
            3,
        )
        .moveTo(imageGizmoCenter.x, imageGizmoCenter.y)
        .lineTo(handlePosition.x, handlePosition.y);
    imageRotationHandle.visible = true;
    imageRotationHandle.position.set(handlePosition.x, handlePosition.y);
    imageRotationHandle
        .clear()
        .lineStyle(2, 0xffffff, 0.95)
        .beginFill(0x5dc3a7, 1)
        .drawCircle(0, 0, 7)
        .endFill()
        .moveTo(-3, 0)
        .arc(0, 0, 3, Math.PI, Math.PI * 1.8);
}

function updateWeapon() {
    for (const object of weaponObjects) object.destroy({ children: true });
    weaponObjects = [];
    const def = (GameObjectDefs as unknown as Record<string, GunDef | MeleeDef>)[
        doc.weapon
    ];
    if (!def || doc.weapon === "fists") return;
    if (def.type === "melee" && def.worldImg?.sprite) {
        const img = def.worldImg;
        const weaponSprite = PIXI.Sprite.from(img.sprite);
        weaponSprite.pivot.set(-img.pos.x, -img.pos.y);
        weaponSprite.scale.set(img.scale.x, img.scale.y);
        weaponSprite.rotation = img.rot;
        weaponSprite.tint = img.tint;
        const right = boneContainers[Bones.HandR];
        right.addChildAt(weaponSprite, img.renderOnHand ? right.children.length : 0);
        weaponObjects.push(weaponSprite);
    } else if (def.type === "gun") {
        const addGun = (bone: Bones) => {
            const img = def.worldImg;
            const gun = new PIXI.Container();
            gun.rotation = Math.PI * 0.5;

            const barrel = PIXI.Sprite.from(img.sprite);
            barrel.anchor.set(0.5, 1);
            barrel.scale.set(img.scale.x * 0.5, img.scale.y * 0.5);
            barrel.tint = img.tint;
            gun.addChild(barrel);

            if (img.magImg) {
                const mag = PIXI.Sprite.from(img.magImg.sprite);
                mag.anchor.set(0.5);
                mag.position.set(img.magImg.pos.x, img.magImg.pos.y);
                mag.scale.set(0.25);
                if (img.magImg.top) gun.addChild(mag);
                else gun.addChildAt(mag, 0);
            }

            if (img.loadingBullet) {
                const bullet = PIXI.Sprite.from(img.loadingBullet.sprite);
                bullet.anchor.set(0.5);
                bullet.position.set(img.loadingBullet.pos.x, img.loadingBullet.pos.y);
                bullet.scale.set(0.25);
                if (img.loadingBullet.top) gun.addChild(bullet);
                else gun.addChildAt(bullet, 0);
            }

            const offset = def.isDual ? { x: -5.95, y: 0 } : { x: -4.25, y: -1.75 };
            if (img.gunOffset) {
                offset.x += img.gunOffset.x;
                offset.y += img.gunOffset.y;
            }
            gun.position.set(offset.x, offset.y);
            boneContainers[bone].addChildAt(gun, 0);
            weaponObjects.push(gun);
        };
        addGun(Bones.HandR);
        if (def.isDual) addGun(Bones.HandL);
    }
}

function sample(time: number): Record<number, EditorPose> {
    const frames = doc.frames;
    if (!frames.length) return completeBones({}, doc.idlePose);
    if (time <= frames[0].time) return completeBones(frames[0].bones, doc.idlePose);
    let b = frames.findIndex((frame) => frame.time >= time);
    if (b < 0) b = frames.length - 1;
    const a = Math.max(0, b - 1);
    if (a === b) return completeBones(frames[a].bones, doc.idlePose);
    const span = frames[b].time - frames[a].time;
    const t = span <= 0 ? 1 : clamp((time - frames[a].time) / span, 0, 1);
    return Object.fromEntries(
        BONE_IDS.map((bone) => {
            const pa = frames[a].bones[bone],
                pb = frames[b].bones[bone];
            return [
                bone,
                {
                    pos: {
                        x: pa.pos.x + (pb.pos.x - pa.pos.x) * t,
                        y: pa.pos.y + (pb.pos.y - pa.pos.y) * t,
                    },
                    pivot: {
                        x: pa.pivot.x + (pb.pivot.x - pa.pivot.x) * t,
                        y: pa.pivot.y + (pb.pivot.y - pa.pivot.y) * t,
                    },
                    rot: pa.rot + (pb.rot - pa.rot) * t,
                },
            ];
        }),
    );
}

function updateStage() {
    world.position.set(app.screen.width / 2 + camera.x, app.screen.height / 2 + camera.y);
    world.scale.set(camera.zoom);
    grid.clear();
    grid.lineStyle(1, 0xffffff, 0.08);
    const spacing = 32 * camera.zoom;
    const ox = (app.screen.width / 2 + camera.x) % spacing;
    const oy = (app.screen.height / 2 + camera.y) % spacing;
    for (let x = ox; x < app.screen.width; x += spacing)
        grid.moveTo(x, 0).lineTo(x, app.screen.height);
    for (let y = oy; y < app.screen.height; y += spacing)
        grid.moveTo(0, y).lineTo(app.screen.width, y);
    grid.lineStyle(2, 0xffffff, 0.2)
        .moveTo(0, app.screen.height / 2 + camera.y)
        .lineTo(app.screen.width, app.screen.height / 2 + camera.y);
    grid.lineStyle(2, 0xffffff, 0.2)
        .moveTo(app.screen.width / 2 + camera.x, 0)
        .lineTo(app.screen.width / 2 + camera.x, app.screen.height);
    const poses = sample(playhead);
    for (const preview of animationImageObjects) {
        const image = doc.images.find((item) => item.id === preview.id);
        preview.sprite.visible = Boolean(
            image && playhead >= image.startTime && playhead <= image.endTime,
        );
    }
    const weaponDef = (GameObjectDefs as unknown as Record<string, GunDef | MeleeDef>)[
        doc.weapon
    ];
    const editingFeet = selectedBone === Bones.FootL || selectedBone === Bones.FootR;
    const showFeet =
        editingFeet ||
        doc.idlePose === "downed" ||
        doc.name.toLowerCase().includes("crawl");
    for (const bone of BONE_IDS) {
        let pose = poses[bone];
        let targetBone = bone;
        if (doc.mirror) {
            targetBone = bone % 2 === 0 ? bone + 1 : bone - 1;
            const source = poses[targetBone];
            pose = {
                pos: { x: source.pos.x, y: -source.pos.y },
                pivot: { x: source.pivot.x, y: -source.pivot.y },
                rot: -source.rot,
            };
        }
        const container = boneContainers[bone];
        const weaponOffset =
            bone === Bones.HandL &&
            weaponDef?.type === "gun" &&
            weaponDef.worldImg.leftHandOffset
                ? weaponDef.worldImg.leftHandOffset
                : { x: 0, y: 0 };
        container.position.set(pose.pos.x + weaponOffset.x, pose.pos.y + weaponOffset.y);
        container.pivot.set(-pose.pivot.x, -pose.pivot.y);
        container.rotation = pose.rot;
        const cos = Math.cos(pose.rot);
        const sin = Math.sin(pose.rot);
        const local = {
            x: pose.pos.x + weaponOffset.x + pose.pivot.x * cos - pose.pivot.y * sin,
            y: pose.pos.y + weaponOffset.y + pose.pivot.x * sin + pose.pivot.y * cos,
        };
        const handle = handles[bone];
        handle.visible = bone < Bones.FootL || showFeet;
        handle.position.set(local.x, local.y);
        handle
            .clear()
            .lineStyle(1.25 / camera.zoom, 0xffffff, bone === selectedBone ? 0.95 : 0.45)
            .beginFill(BONE_COLORS[bone], bone === selectedBone ? 0.95 : 0.65)
            .drawCircle(0, 0, (bone === selectedBone ? 5 : 4) / camera.zoom)
            .endFill();
        handle
            .lineStyle(1 / camera.zoom, BONE_COLORS[bone], 0.7)
            .moveTo(-9 / camera.zoom, 0)
            .lineTo(9 / camera.zoom, 0)
            .moveTo(0, -9 / camera.zoom)
            .lineTo(0, 9 / camera.zoom);
    }
    updateImageGizmo();
}

function renderFrameList() {
    $("frame-list").innerHTML = doc.frames
        .map(
            (frame, index) =>
                `<button class="frame-card ${frame.id === selectedFrameId ? "selected" : ""}" data-frame="${frame.id}"><span class="frame-index">${String(index + 1).padStart(2, "0")}</span><span><strong>${frame.time.toFixed(3)}s</strong><small>4 bones</small></span><i style="left:${clamp((frame.time / doc.duration) * 100, 0, 100)}%"></i></button>`,
        )
        .join("");
}
function renderEffects() {
    $("effect-list").innerHTML = doc.effects.length
        ? doc.effects
              .map(
                  (effect) =>
                      `<div class="effect-card" data-effect="${effect.id}"><select class="effect-fn"><option value="animPlaySound" ${effect.fn === "animPlaySound" ? "selected" : ""}>Play sound</option><option value="animMeleeCollision" ${effect.fn === "animMeleeCollision" ? "selected" : ""}>Melee hit</option><option value="animSetThrowableState" ${effect.fn === "animSetThrowableState" ? "selected" : ""}>Set throwable</option><option value="animThrowableParticles" ${effect.fn === "animThrowableParticles" ? "selected" : ""}>Throwable particles</option></select><input class="effect-time" type="number" min="0" step="0.01" value="${effect.time}"><input class="effect-args" value="${esc(effect.args)}" title="JSON arguments"><button class="delete-effect">×</button></div>`,
              )
              .join("")
        : `<p class="empty-state">No sound, hit, or particle events.</p>`;
}
function renderImages() {
    $("image-list").innerHTML = doc.images.length
        ? doc.images
              .map(
                  (image) =>
                      `<div class="image-card ${image.id === selectedAnimationImageId ? "selected" : ""}" data-image="${image.id}"><button class="edit-image"><strong>${esc(image.sprite)}</strong><span>${image.attach} · ${image.startTime.toFixed(2)}–${image.endTime.toFixed(2)}s</span></button><button class="quick-delete-image" title="Delete image">×</button></div>`,
              )
              .join("")
        : `<p class="empty-state">No images attached to this animation.</p>`;
}
function renderImageInspector() {
    const image = selectedImage();
    $("image-inspector").classList.toggle("hidden", !image);
    if (!image) return;
    $("ins-image-name").textContent = image.sprite;
    $("ins-image-time-label").textContent =
        `${image.startTime.toFixed(2)}s – ${image.endTime.toFixed(2)}s`;
    $<HTMLSelectElement>("ins-image-attach").value = image.attach;
    $("ins-image-follow-note").textContent =
        image.attach === "body"
            ? "This image stays relative to the player body."
            : `This image follows the ${image.attach === "handL" ? "left" : "right"} hand automatically through every animation keyframe.`;
    setImageField("ins-image-x", round(image.pos.x, 3));
    setImageField("ins-image-y", round(image.pos.y, 3));
    setImageField("ins-image-rotation", round((image.rot * 180) / Math.PI, 2));
    setImageField("ins-image-scale-x", round(image.scale.x, 3));
    setImageField("ins-image-scale-y", round(image.scale.y, 3));
    setImageField("ins-image-start", image.startTime);
    setImageField("ins-image-end", image.endTime);
    setImageField("ins-image-alpha", image.alpha);
    setImageField("ins-image-tint", `#${image.tint.toString(16).padStart(6, "0")}`);
    $<HTMLInputElement>("ins-image-on-top").checked = image.onTop;
}
function renderInspector() {
    const pose = selectedPose();
    $("bone-chip").textContent = BONE_NAMES[selectedBone];
    $("bone-chip").style.borderColor =
        `#${BONE_COLORS[selectedBone].toString(16).padStart(6, "0")}`;
    document
        .querySelectorAll<HTMLButtonElement>("[data-bone]")
        .forEach((button) =>
            button.classList.toggle(
                "active",
                Number(button.dataset.bone) === selectedBone,
            ),
        );
    $<HTMLInputElement>("pos-x").value = String(round(pose.pivot.x));
    $<HTMLInputElement>("pos-y").value = String(round(pose.pivot.y));
    $<HTMLInputElement>("pivot-x").value = String(round(pose.pos.x));
    $<HTMLInputElement>("pivot-y").value = String(round(pose.pos.y));
    const degrees = round((pose.rot * 180) / Math.PI, 1);
    $<HTMLInputElement>("rotation").value = String(degrees);
    $<HTMLInputElement>("rotation-range").value = String(clamp(degrees, -360, 360));
}
function renderTimeline() {
    const requestedWidth = Math.max(720, doc.duration * 900 * timelineZoom);
    const width = Math.max(requestedWidth, $("timeline-scroll").clientWidth);
    const tick = doc.duration <= 0.5 ? 0.05 : doc.duration <= 2 ? 0.1 : 0.5;
    const ticks: string[] = [];
    for (let time = 0; time <= doc.duration + 0.0001; time += tick)
        ticks.push(
            `<span class="tick" style="left:${(time / doc.duration) * 100}%"><i></i><b>${round(time, 2)}s</b></span>`,
        );
    const rows = BONE_IDS.map(
        (bone) =>
            `<div class="timeline-row"><label><i style="background:#${BONE_COLORS[bone].toString(16).padStart(6, "0")}"></i>${BONE_SHORT[bone]}</label><div class="track">${doc.frames.map((frame) => `<button class="key ${frame.id === selectedFrameId && bone === selectedBone ? "selected" : ""}" data-frame="${frame.id}" data-timeline-bone="${bone}" style="left:${(frame.time / doc.duration) * 100}%;--key:#${BONE_COLORS[bone].toString(16).padStart(6, "0")}" title="${BONE_NAMES[bone]} at ${frame.time.toFixed(3)}s"></button>`).join("")}</div></div>`,
    ).join("");
    const imageRows = doc.images
        .map((image) => {
            const start = clamp(image.startTime, 0, doc.duration);
            const end = clamp(image.endTime, start, doc.duration);
            return `<div class="timeline-row image-timeline-row"><label title="${esc(image.sprite)}"><i></i>IMG</label><div class="track"><div class="image-range ${image.id === selectedAnimationImageId ? "selected" : ""}" data-image-range="${image.id}" style="left:${(start / doc.duration) * 100}%;width:${((end - start) / doc.duration) * 100}%"><button class="image-range-handle start" data-image-edge="start" title="Start: ${start.toFixed(2)}s"></button><span>${esc(image.sprite)}</span><button class="image-range-handle end" data-image-edge="end" title="End: ${end.toFixed(2)}s"></button></div></div></div>`;
        })
        .join("");
    $("timeline").style.width = `${width}px`;
    $("timeline").style.height = `${32 + (BONE_IDS.length + doc.images.length) * 29}px`;
    $("timeline").innerHTML =
        `<div class="ruler"><label>TIME</label><div class="ruler-track">${ticks.join("")}</div></div>${rows}${imageRows}<div id="playhead" class="playhead" style="left:calc(62px + ${(playhead / doc.duration) * (width - 62)}px)"><i></i></div>`;
}
function renderControls() {
    $<HTMLInputElement>("anim-name").value = doc.name;
    $<HTMLSelectElement>("idle-pose").value = doc.idlePose;
    $<HTMLSelectElement>("weapon").value = doc.weapon;
    $<HTMLInputElement>("duration").value = String(doc.duration);
    $<HTMLInputElement>("loop").checked = doc.loop;
    $<HTMLInputElement>("mirror").checked = doc.mirror;
    $("current-time").textContent = playhead.toFixed(3);
    $("total-time").textContent = `${doc.duration.toFixed(3)} s`;
    $("play").textContent = playing ? "❚❚" : "▶";
    $("play").classList.toggle("playing", playing);
}
function renderAll() {
    renderControls();
    renderFrameList();
    renderEffects();
    renderImages();
    renderImageInspector();
    renderInspector();
    renderTimeline();
    updateStage();
}

function addFrame(time = playhead) {
    const existing = doc.frames.find((frame) => Math.abs(frame.time - time) < 0.0001);
    if (existing) {
        selectedFrameId = existing.id;
        renderAll();
        return;
    }
    const frame = {
        id: id(),
        time: round(clamp(time, 0, doc.duration)),
        bones: completeBones(sample(time), doc.idlePose),
    };
    doc.frames.push(frame);
    selectedFrameId = frame.id;
    changed();
}
function deleteFrame(frameId: string) {
    if (doc.frames.length <= 1)
        return showToast("An animation needs at least one keyframe");
    const index = doc.frames.findIndex((frame) => frame.id === frameId);
    doc.frames.splice(index, 1);
    selectedFrameId = doc.frames[Math.max(0, index - 1)].id;
    changed();
}
function showToast(message: string) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}
function fmt(value: number) {
    const n = round(value, 4);
    return Number.isInteger(n) ? String(n) : String(n);
}
function generateCode() {
    const frames = doc.frames
        .map(
            (frame) =>
                `            frame(${fmt(frame.time)}, {\n${BONE_IDS.map((bone) => {
                    const p = frame.bones[bone];
                    const rotate =
                        Math.abs(p.rot) > 0.00001 ? `.rotate(${fmt(p.rot)})` : "";
                    const pose =
                        Math.abs(p.pos.x) > 0.00001 || Math.abs(p.pos.y) > 0.00001
                            ? `new Pose(v2.create(${fmt(p.pivot.x)}, ${fmt(p.pivot.y)}), ${fmt(p.rot)}, v2.create(${fmt(p.pos.x)}, ${fmt(p.pos.y)}))`
                            : `new Pose(v2.create(${fmt(p.pivot.x)}, ${fmt(p.pivot.y)}))${rotate}`;
                    return `                [Bones.${Bones[bone]}]: ${pose},`;
                }).join("\n")}\n            })`,
        )
        .join(",\n");
    const effects = doc.effects
        .map((effect) => {
            let args = effect.args.trim() || "{}";
            try {
                args = JSON.stringify(JSON.parse(args));
            } catch {
                /* preserve hand-written expression */
            }
            return `            effect(${fmt(effect.time)}, "${effect.fn}", ${args})`;
        })
        .join(",\n");
    const images = doc.images
        .map(
            (image) =>
                `            { sprite: "${image.sprite}", attach: "${image.attach}", pos: v2.create(${fmt(image.pos.x)}, ${fmt(image.pos.y)}), rot: ${fmt(image.rot)}, scale: v2.create(${fmt(image.scale.x)}, ${fmt(image.scale.y)}), tint: 0x${image.tint.toString(16).padStart(6, "0")}, alpha: ${fmt(image.alpha)}, startTime: ${fmt(image.startTime)}, endTime: ${fmt(image.endTime)}, onTop: ${image.onTop} }`,
        )
        .join(",\n");
    return `    ${doc.name}: {\n        keyframes: [\n${frames}\n        ],\n        effects: [${effects ? `\n${effects}\n        ` : ""}],\n        images: [${images ? `\n${images}\n        ` : ""}],\n    },`;
}
function openDialog(mode: "export" | "import") {
    const dialog = $<HTMLDialogElement>("code-dialog");
    $("dialog-title").textContent =
        mode === "export" ? "Game-ready animation" : "Import editor JSON";
    $("dialog-subtitle").textContent =
        mode === "export"
            ? "Paste this entry inside the Animations object in client/src/animData.ts."
            : "Paste JSON previously copied from this maker.";
    $<HTMLTextAreaElement>("code-area").value = mode === "export" ? generateCode() : "";
    $("dialog-copy").classList.toggle("hidden", mode !== "export");
    $("dialog-load").classList.toggle("hidden", mode !== "import");
    dialog.showModal();
}

function setImageField(idValue: string, value: string | number) {
    $<HTMLInputElement>(idValue).value = String(value);
}

function matchesSpriteCategory(name: string, category: string) {
    if (category === "all") return true;
    if (category === "projectile") return name.includes("proj");
    if (category === "weapon") return name.startsWith("gun-") || name.includes("melee");
    if (category === "loot") return name.startsWith("loot-");
    if (category === "particle")
        return (
            name.startsWith("part-") ||
            name.includes("particle") ||
            name.startsWith("fx-")
        );
    if (category === "player") return name.startsWith("player-");
    if (category === "map") return name.startsWith("map-");
    return true;
}

async function renderSpriteGallery() {
    const revision = ++spriteGalleryRevision;
    const query = $<HTMLInputElement>("sprite-search").value.trim().toLowerCase();
    const category = $<HTMLSelectElement>("sprite-category").value;
    const selected = $<HTMLInputElement>("image-sprite").value;
    const matches = [...GAME_SPRITE_NAMES]
        .filter(
            (name) =>
                name.endsWith(".img") &&
                matchesSpriteCategory(name, category) &&
                (!query || name.toLowerCase().includes(query)),
        )
        .sort((a, b) => {
            if (a === selected) return -1;
            if (b === selected) return 1;
            return a.localeCompare(b);
        });
    const visible = matches.slice(0, 80);
    $("sprite-result-count").textContent =
        matches.length > visible.length
            ? `Showing ${visible.length} of ${matches.length}`
            : `${matches.length} sprites`;
    $("sprite-gallery").innerHTML = visible.length
        ? visible
              .map(
                  (name) =>
                      `<button class="sprite-choice ${name === selected ? "selected" : ""}" data-sprite="${esc(name)}" title="${esc(name)}"><span class="sprite-thumbnail"><i></i></span><b>${esc(name)}</b></button>`,
              )
              .join("")
        : `<p class="empty-state">No sprites match that search.</p>`;

    for (const name of visible) {
        await ensureSpriteTexture(name);
        if (revision !== spriteGalleryRevision) return;
        const target = document.querySelector<HTMLElement>(
            `.sprite-choice[data-sprite="${CSS.escape(name)}"] .sprite-thumbnail`,
        );
        const texture = PIXI.utils.TextureCache[name];
        if (!target || !texture) continue;
        try {
            const sprite = new PIXI.Sprite(texture);
            const preview = app.renderer.extract.canvas(sprite) as HTMLCanvasElement;
            sprite.destroy();
            preview.className = "sprite-preview-canvas";
            target.replaceChildren(preview);
        } catch {
            target.classList.add("preview-failed");
        }
    }
}

function openImageEditor(image?: EditorImage) {
    editingImageId = image?.id ?? "";
    setImageField("image-sprite", image?.sprite ?? "");
    const defaultAttach =
        selectedBone === Bones.HandL
            ? "handL"
            : selectedBone === Bones.HandR
              ? "handR"
              : "body";
    $<HTMLSelectElement>("image-attach").value = image?.attach ?? defaultAttach;
    setImageField("image-x", image?.pos.x ?? 0);
    setImageField("image-y", image?.pos.y ?? 0);
    setImageField("image-rotation", image ? round((image.rot * 180) / Math.PI, 2) : 0);
    setImageField("image-alpha", image?.alpha ?? 1);
    setImageField("image-scale-x", image?.scale.x ?? 0.25);
    setImageField("image-scale-y", image?.scale.y ?? 0.25);
    setImageField("image-start", image?.startTime ?? 0);
    setImageField("image-end", image?.endTime ?? doc.duration);
    setImageField(
        "image-tint",
        `#${(image?.tint ?? 0xffffff).toString(16).padStart(6, "0")}`,
    );
    $<HTMLInputElement>("image-on-top").checked = image?.onTop ?? true;
    $<HTMLInputElement>("sprite-search").value = "";
    $<HTMLSelectElement>("sprite-category").value = "all";
    $("delete-image").classList.toggle("hidden", !image);
    $<HTMLDialogElement>("image-dialog").showModal();
    void renderSpriteGallery();
}

function readImageEditor(): EditorImage | undefined {
    const sprite = $<HTMLInputElement>("image-sprite").value.trim();
    if (!sprite.endsWith(".img")) {
        showToast("Enter a game sprite name ending in .img");
        return;
    }
    if (!GAME_SPRITE_NAMES.has(sprite) && !PIXI.utils.TextureCache[sprite]) {
        showToast("That sprite is not present in the game atlases");
        return;
    }
    const tintText = $<HTMLInputElement>("image-tint")
        .value.trim()
        .replace(/^#|^0x/i, "");
    const tint = Number.parseInt(tintText, 16);
    const startTime = clamp(
        Number($<HTMLInputElement>("image-start").value) || 0,
        0,
        doc.duration,
    );
    const endTime = Math.max(
        startTime,
        Number($<HTMLInputElement>("image-end").value) || doc.duration,
    );
    return {
        id: editingImageId || id(),
        sprite,
        attach: $<HTMLSelectElement>("image-attach").value as EditorImage["attach"],
        pos: {
            x: Number($<HTMLInputElement>("image-x").value) || 0,
            y: Number($<HTMLInputElement>("image-y").value) || 0,
        },
        rot: ((Number($<HTMLInputElement>("image-rotation").value) || 0) * Math.PI) / 180,
        scale: {
            x: Number($<HTMLInputElement>("image-scale-x").value) || 0.25,
            y: Number($<HTMLInputElement>("image-scale-y").value) || 0.25,
        },
        tint: Number.isFinite(tint) ? clamp(tint, 0, 0xffffff) : 0xffffff,
        alpha: clamp(Number($<HTMLInputElement>("image-alpha").value) || 0, 0, 1),
        startTime,
        endTime,
        onTop: $<HTMLInputElement>("image-on-top").checked,
    };
}

function deleteAnimationImage(imageId: string) {
    doc.images = doc.images.filter((image) => image.id !== imageId);
    if (selectedAnimationImageId === imageId) selectedAnimationImageId = "";
    save();
    updateAnimationImages();
    renderImages();
    renderImageInspector();
}

function updateSelectedImageVisual() {
    const image = selectedImage();
    const preview = animationImageObjects.find(
        (item) => item.id === selectedAnimationImageId,
    );
    if (!image || !preview) return;
    preview.sprite.position.set(image.pos.x, doc.mirror ? -image.pos.y : image.pos.y);
    preview.sprite.rotation = doc.mirror ? -image.rot : image.rot;
    preview.sprite.scale.set(image.scale.x, image.scale.y);
    preview.sprite.tint = image.tint;
    preview.sprite.alpha = image.alpha;
    save();
    updateStage();
    renderImages();
}

function bindImageInspectorInput(
    idValue: string,
    update: (image: EditorImage, value: string) => void,
) {
    $(idValue).addEventListener("input", (event) => {
        const image = selectedImage();
        if (!image) return;
        update(image, (event.target as HTMLInputElement).value);
        updateSelectedImageVisual();
    });
}

function bindInput(idValue: string, callback: (value: string) => void, event = "change") {
    $(idValue).addEventListener(event, (e) =>
        callback((e.target as HTMLInputElement).value),
    );
}
populateSelects();
bindInput(
    "anim-name",
    (value) => {
        doc.name = value.replace(/[^a-zA-Z0-9_$]/g, "");
        save();
    },
    "input",
);
bindInput("idle-pose", (value) => {
    changeIdlePose(value);
    changed();
});
bindInput("weapon", (value) => {
    doc.weapon = value;
    changeIdlePose(idlePoseForWeapon(value));
    updateWeapon();
    changed();
});
bindInput("duration", (value) => {
    doc.duration = Math.max(0.01, Number(value) || 0.25, doc.frames.at(-1)?.time ?? 0);
    playhead = Math.min(playhead, doc.duration);
    changed();
});
bindInput("speed", (value) => {
    playbackSpeed = Number(value);
});
bindInput(
    "timeline-zoom",
    (value) => {
        timelineZoom = Number(value);
        renderTimeline();
    },
    "input",
);
$<HTMLInputElement>("loop").addEventListener("change", (e) => {
    doc.loop = (e.target as HTMLInputElement).checked;
    changed();
});
$<HTMLInputElement>("mirror").addEventListener("change", (e) => {
    doc.mirror = (e.target as HTMLInputElement).checked;
    updateAnimationImages();
    changed();
});
$("existing-animation").addEventListener("change", (e) => {
    const name = (e.target as HTMLSelectElement).value;
    if (!name) return;
    doc = docFromAnimation(name);
    selectedFrameId = doc.frames[0].id;
    playhead = 0;
    updateWeapon();
    updateAnimationImages();
    changed();
    (e.target as HTMLSelectElement).value = "";
});
$("add-frame").addEventListener("click", () => addFrame());
$("frame-at-playhead").addEventListener("click", () => addFrame());
$("new-doc").addEventListener("click", () => {
    doc = blankDoc();
    selectedFrameId = doc.frames[0].id;
    playhead = 0;
    updateWeapon();
    updateAnimationImages();
    changed();
});
$("frame-list").addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-frame]");
    if (!card) return;
    selectedFrameId = card.dataset.frame!;
    playhead = selectedFrame().time;
    renderAll();
});
$("frame-list").addEventListener("dblclick", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-frame]");
    if (card) deleteFrame(card.dataset.frame!);
});
$("bone-tabs").addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-bone]");
    if (!button) return;
    selectedBone = Number(button.dataset.bone);
    world.addChild(handles[selectedBone]);
    renderAll();
});
for (const [field, path] of [
    ["pos-x", "pivot.x"],
    ["pos-y", "pivot.y"],
    ["pivot-x", "pos.x"],
    ["pivot-y", "pos.y"],
] as const)
    bindInput(
        field,
        (value) => {
            const [group, key] = path.split(".") as ["pos" | "pivot", "x" | "y"];
            selectedPose()[group][key] = Number(value) || 0;
            changed();
        },
        "input",
    );
const setRotation = (value: string) => {
    selectedPose().rot = ((Number(value) || 0) * Math.PI) / 180;
    changed();
};
bindInput("rotation", setRotation, "input");
bindInput("rotation-range", setRotation, "input");
$("copy-pose").addEventListener("click", () => {
    poseClipboard = clonePose(selectedPose());
    showToast("Pose copied");
});
$("paste-pose").addEventListener("click", () => {
    if (!poseClipboard) return showToast("Copy a pose first");
    selectedFrame().bones[selectedBone] = clonePose(poseClipboard);
    changed();
});
$("reset-pose").addEventListener("click", () => {
    selectedFrame().bones[selectedBone] = idlePoseFor(selectedBone, doc.idlePose);
    changed();
});
$("add-effect").addEventListener("click", () => {
    doc.effects.push({
        id: id(),
        time: round(playhead),
        fn: "animPlaySound",
        args: '{"sound":"swing"}',
    });
    changed();
});
$("effect-list").addEventListener("input", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-effect]");
    if (!card) return;
    const effect = doc.effects.find((item) => item.id === card.dataset.effect)!;
    const target = e.target as HTMLInputElement;
    if (target.classList.contains("effect-time"))
        effect.time = clamp(Number(target.value) || 0, 0, doc.duration);
    if (target.classList.contains("effect-args")) effect.args = target.value;
    if (target.classList.contains("effect-fn")) effect.fn = target.value;
    save();
    renderTimeline();
});
$("effect-list").addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest(".delete-effect");
    if (!button) return;
    const card = button.closest<HTMLElement>("[data-effect]")!;
    doc.effects = doc.effects.filter((item) => item.id !== card.dataset.effect);
    changed();
});
bindImageInspectorInput("ins-image-x", (image, value) => {
    image.pos.x = Number(value) || 0;
});
bindImageInspectorInput("ins-image-y", (image, value) => {
    image.pos.y = Number(value) || 0;
});
bindImageInspectorInput("ins-image-rotation", (image, value) => {
    image.rot = ((Number(value) || 0) * Math.PI) / 180;
});
bindImageInspectorInput("ins-image-scale-x", (image, value) => {
    image.scale.x = Number(value) || 0.01;
});
bindImageInspectorInput("ins-image-scale-y", (image, value) => {
    image.scale.y = Number(value) || 0.01;
});
bindImageInspectorInput("ins-image-alpha", (image, value) => {
    image.alpha = clamp(Number(value), 0, 1);
});
bindImageInspectorInput("ins-image-tint", (image, value) => {
    const tint = Number.parseInt(value.trim().replace(/^#|^0x/i, ""), 16);
    if (Number.isFinite(tint)) image.tint = clamp(tint, 0, 0xffffff);
});
$("ins-image-attach").addEventListener("change", (event) => {
    const image = selectedImage();
    if (!image) return;
    image.attach = (event.target as HTMLSelectElement).value as EditorImage["attach"];
    save();
    void updateAnimationImages();
    renderImageInspector();
    showToast(
        image.attach === "body"
            ? "Image attached to the player body"
            : `Image now follows the ${image.attach === "handL" ? "left" : "right"} hand`,
    );
});
$("ins-image-on-top").addEventListener("change", (event) => {
    const image = selectedImage();
    if (!image) return;
    image.onTop = (event.target as HTMLInputElement).checked;
    save();
    void updateAnimationImages();
});
$("ins-image-start").addEventListener("change", (event) => {
    const image = selectedImage();
    if (!image) return;
    image.startTime = round(
        clamp(Number((event.target as HTMLInputElement).value) || 0, 0, image.endTime),
        2,
    );
    save();
    renderAll();
});
$("ins-image-end").addEventListener("change", (event) => {
    const image = selectedImage();
    if (!image) return;
    image.endTime = round(
        Math.max(
            image.startTime,
            Number((event.target as HTMLInputElement).value) || image.endTime,
        ),
        2,
    );
    doc.duration = Math.max(doc.duration, image.endTime);
    save();
    renderAll();
});
$("change-image-sprite").addEventListener("click", () => {
    const image = selectedImage();
    if (image) openImageEditor(image);
});
$("ins-delete-image").addEventListener("click", () => {
    if (selectedAnimationImageId) deleteAnimationImage(selectedAnimationImageId);
});
$("add-image").addEventListener("click", () => openImageEditor());
$("sprite-search").addEventListener("input", () => {
    window.clearTimeout(spriteSearchTimer);
    spriteSearchTimer = window.setTimeout(() => void renderSpriteGallery(), 120);
});
$("sprite-category").addEventListener("change", () => void renderSpriteGallery());
$("sprite-gallery").addEventListener("click", (e) => {
    const choice = (e.target as HTMLElement).closest<HTMLElement>("[data-sprite]");
    if (!choice) return;
    setImageField("image-sprite", choice.dataset.sprite!);
    document
        .querySelectorAll(".sprite-choice.selected")
        .forEach((item) => item.classList.remove("selected"));
    choice.classList.add("selected");
    $("save-image").click();
});
$("image-list").addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-image]");
    if (!card) return;
    const image = doc.images.find((item) => item.id === card.dataset.image);
    if (!image) return;
    if ((e.target as HTMLElement).closest(".quick-delete-image")) {
        deleteAnimationImage(image.id);
    } else {
        selectedAnimationImageId = image.id;
        renderAll();
    }
});
$("close-image-dialog").addEventListener("click", () =>
    $<HTMLDialogElement>("image-dialog").close(),
);
$("save-image").addEventListener("click", () => {
    const image = readImageEditor();
    if (!image) return;
    const index = doc.images.findIndex((item) => item.id === image.id);
    if (index >= 0) doc.images[index] = image;
    else doc.images.push(image);
    selectedAnimationImageId = image.id;
    doc.duration = Math.max(doc.duration, image.endTime);
    save();
    updateAnimationImages();
    renderAll();
    $<HTMLDialogElement>("image-dialog").close();
});
$("delete-image").addEventListener("click", () => {
    if (editingImageId) deleteAnimationImage(editingImageId);
    $<HTMLDialogElement>("image-dialog").close();
});
$("play").addEventListener("click", () => {
    if (playhead >= doc.duration) playhead = 0;
    playing = !playing;
    renderControls();
});
$("jump-start").addEventListener("click", () => {
    playing = false;
    playhead = 0;
    renderAll();
});
$("jump-end").addEventListener("click", () => {
    playing = false;
    playhead = doc.duration;
    renderAll();
});
$("reset-view").addEventListener("click", () => {
    camera = { x: 0, y: 0, zoom: 3.2 };
    updateStage();
});
$("export").addEventListener("click", () => openDialog("export"));
$("import").addEventListener("click", () => openDialog("import"));
$("close-dialog").addEventListener("click", () =>
    $<HTMLDialogElement>("code-dialog").close(),
);
$("dialog-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($<HTMLTextAreaElement>("code-area").value);
    showToast("Game code copied");
    $<HTMLDialogElement>("code-dialog").close();
});
$("dialog-load").addEventListener("click", () => {
    try {
        doc = normalizeDoc(JSON.parse($<HTMLTextAreaElement>("code-area").value));
        selectedFrameId = doc.frames[0].id;
        playhead = 0;
        updateWeapon();
        updateAnimationImages();
        changed();
        $<HTMLDialogElement>("code-dialog").close();
    } catch {
        showToast("That is not valid editor JSON");
    }
});

$("timeline").addEventListener("pointerdown", (e: PointerEvent) => {
    if (e.button !== 0) return;
    const range = (e.target as HTMLElement).closest<HTMLElement>("[data-image-range]");
    if (range) {
        const image = doc.images.find((item) => item.id === range.dataset.imageRange);
        if (!image) return;
        const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-image-edge]")
            ?.dataset.imageEdge as "start" | "end" | undefined;
        const pointerTime = timelineTimeAt(e.clientX);
        selectedAnimationImageId = image.id;
        timelineDrag = {
            type: "image-range",
            imageId: image.id,
            edge: edge ?? "move",
            grabOffset: pointerTime - image.startTime,
            duration: image.endTime - image.startTime,
        };
        playing = false;
        renderImages();
        renderImageInspector();
        renderTimeline();
        e.preventDefault();
        return;
    }
    const key = (e.target as HTMLElement).closest<HTMLElement>(".key");
    if (key) {
        selectedFrameId = key.dataset.frame!;
        selectedBone = Number(key.dataset.timelineBone);
        playhead = selectedFrame().time;
        timelineDrag = { type: "keyframe", frameId: selectedFrameId };
        playing = false;
        e.preventDefault();
        renderAll();
        return;
    }
    timelineDrag = { type: "playhead" };
    playing = false;
    setPlayheadFromPointer(e.clientX);
    e.preventDefault();
});

function timelineTimeAt(clientX: number) {
    const rect = $("timeline").getBoundingClientRect();
    const x = clamp(clientX - rect.left - 62, 0, rect.width - 62);
    return round((x / (rect.width - 62)) * doc.duration, 2);
}

function refreshTimelinePreview() {
    updateStage();
    renderControls();
    renderTimeline();
}

function setPlayheadFromPointer(clientX: number) {
    playhead = timelineTimeAt(clientX);
    refreshTimelinePreview();
}

function moveKeyframeFromPointer(frameId: string, clientX: number) {
    const frame = doc.frames.find((item) => item.id === frameId);
    if (!frame) return;
    const nextTime = timelineTimeAt(clientX);
    const occupied = doc.frames.some(
        (item) => item.id !== frameId && Math.abs(item.time - nextTime) < 0.0001,
    );
    if (occupied) return;
    frame.time = nextTime;
    playhead = nextTime;
    doc.frames.sort((a, b) => a.time - b.time);
    save();
    renderFrameList();
    refreshTimelinePreview();
}

function moveImageRangeFromPointer(
    drag: Extract<NonNullable<typeof timelineDrag>, { type: "image-range" }>,
    clientX: number,
) {
    const image = doc.images.find((item) => item.id === drag.imageId);
    if (!image) return;
    const time = timelineTimeAt(clientX);
    if (drag.edge === "start") {
        image.startTime = clamp(time, 0, image.endTime);
        playhead = image.startTime;
    } else if (drag.edge === "end") {
        image.endTime = clamp(time, image.startTime, doc.duration);
        playhead = image.endTime;
    } else {
        const start = clamp(time - drag.grabOffset, 0, doc.duration - drag.duration);
        image.startTime = start;
        image.endTime = round(start + drag.duration, 2);
        playhead = start;
    }
    image.startTime = round(image.startTime, 2);
    image.endTime = round(image.endTime, 2);
    save();
    renderImages();
    renderImageInspector();
    refreshTimelinePreview();
}

canvas.addEventListener("pointerdown", (e) => {
    if (dragBone !== undefined || imageDrag || imageRotateDrag) return;
    panStart = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y };
    canvas.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
    if (imageRotateDrag) {
        const rect = canvas.getBoundingClientRect();
        const pointer = {
            x: ((e.clientX - rect.left) / rect.width) * app.screen.width,
            y: ((e.clientY - rect.top) / rect.height) * app.screen.height,
        };
        const angle = Math.atan2(
            pointer.y - imageRotateDrag.center.y,
            pointer.x - imageRotateDrag.center.x,
        );
        const displayRotation =
            imageRotateDrag.startDisplayRotation + angle - imageRotateDrag.startAngle;
        const image = doc.images.find((item) => item.id === imageRotateDrag!.id);
        const preview = animationImageObjects.find(
            (item) => item.id === imageRotateDrag!.id,
        );
        if (image && preview) {
            image.rot = round(doc.mirror ? -displayRotation : displayRotation, 4);
            preview.sprite.rotation = displayRotation;
            save();
            updateImageGizmo();
            renderImageInspector();
        }
    } else if (imageDrag) {
        const rect = canvas.getBoundingClientRect();
        const global = new PIXI.Point(
            ((e.clientX - rect.left) / rect.width) * app.screen.width,
            ((e.clientY - rect.top) / rect.height) * app.screen.height,
        );
        const local = imageDrag.parent.toLocal(global, app.stage);
        const image = doc.images.find((item) => item.id === imageDrag!.id);
        const preview = animationImageObjects.find((item) => item.id === imageDrag!.id);
        if (image && preview) {
            const displayX = local.x - imageDrag.offset.x;
            const displayY = local.y - imageDrag.offset.y;
            image.pos.x = round(displayX, 2);
            image.pos.y = round(doc.mirror ? -displayY : displayY, 2);
            preview.sprite.position.set(displayX, displayY);
            save();
            renderImages();
            renderImageInspector();
            updateImageGizmo();
        }
    } else if (timelineDrag?.type === "image-range") {
        moveImageRangeFromPointer(timelineDrag, e.clientX);
    } else if (timelineDrag?.type === "keyframe") {
        moveKeyframeFromPointer(timelineDrag.frameId, e.clientX);
    } else if (timelineDrag?.type === "playhead") {
        setPlayheadFromPointer(e.clientX);
    } else if (dragBone !== undefined) {
        const rect = canvas.getBoundingClientRect();
        const x =
            (e.clientX - rect.left - app.screen.width / 2 - camera.x) / camera.zoom -
            dragPointerOffset.x;
        const y =
            (e.clientY - rect.top - app.screen.height / 2 - camera.y) / camera.zoom -
            dragPointerOffset.y;
        const pose = selectedFrame().bones[dragBone];
        const weaponDef = (
            GameObjectDefs as unknown as Record<string, GunDef | MeleeDef>
        )[doc.weapon];
        const weaponOffset =
            dragBone === Bones.HandL &&
            weaponDef?.type === "gun" &&
            weaponDef.worldImg.leftHandOffset
                ? weaponDef.worldImg.leftHandOffset
                : { x: 0, y: 0 };
        const dx = x - pose.pos.x - weaponOffset.x;
        const dy = y - pose.pos.y - weaponOffset.y;
        const cos = Math.cos(-pose.rot);
        const sin = Math.sin(-pose.rot);
        pose.pivot = {
            x: round(dx * cos - dy * sin, 2),
            y: round(dx * sin + dy * cos, 2),
        };
        playhead = selectedFrame().time;
        save();
        renderInspector();
        updateStage();
        renderTimeline();
    } else if (panStart) {
        camera.x = panStart.cameraX + e.clientX - panStart.x;
        camera.y = panStart.cameraY + e.clientY - panStart.y;
        updateStage();
    }
});
window.addEventListener("pointerup", () => {
    if (dragBone !== undefined) handles[dragBone].cursor = "grab";
    if (imageDrag) {
        const preview = animationImageObjects.find((item) => item.id === imageDrag!.id);
        if (preview) preview.sprite.cursor = "move";
    }
    imageRotateDrag = undefined;
    imageDrag = undefined;
    timelineDrag = undefined;
    dragBone = undefined;
    panStart = undefined;
});
canvas.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const image = doc.images.find((item) => item.id === selectedAnimationImageId);
        const preview = animationImageObjects.find(
            (item) => item.id === selectedAnimationImageId,
        );
        if (image && preview && e.shiftKey) {
            const factor = Math.exp(-e.deltaY * 0.0015);
            image.scale.x = round(clamp(image.scale.x * factor, 0.01, 10), 3);
            image.scale.y = round(clamp(image.scale.y * factor, 0.01, 10), 3);
            preview.sprite.scale.set(image.scale.x, image.scale.y);
            save();
            updateImageGizmo();
            renderImageInspector();
            return;
        }
        if (image && preview && e.altKey) {
            image.rot = round(image.rot + Math.sign(e.deltaY) * (Math.PI / 36), 4);
            preview.sprite.rotation = doc.mirror ? -image.rot : image.rot;
            save();
            updateImageGizmo();
            renderImageInspector();
            return;
        }
        camera.zoom = clamp(camera.zoom * Math.exp(-e.deltaY * 0.001), 1, 8);
        updateStage();
    },
    { passive: false },
);
window.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).matches("input, textarea, select")) return;
    if (e.code === "Space") {
        e.preventDefault();
        $("play").click();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAnimationImageId) deleteAnimationImage(selectedAnimationImageId);
        else deleteFrame(selectedFrameId);
    }
    if (e.key === "Escape") {
        selectedAnimationImageId = "";
        renderImages();
        renderImageInspector();
        updateImageGizmo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        poseClipboard = clonePose(selectedPose());
        e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && poseClipboard) {
        selectedFrame().bones[selectedBone] = clonePose(poseClipboard);
        changed();
        e.preventDefault();
    }
});
window.addEventListener("resize", renderTimeline);

let lastTime = performance.now();
app.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (!playing) return;
    playhead += dt * playbackSpeed;
    if (playhead >= doc.duration) {
        if (doc.loop) playhead %= doc.duration;
        else {
            playhead = doc.duration;
            playing = false;
        }
    }
    updateStage();
    renderControls();
    const marker = $("playhead");
    if (marker)
        marker.style.left = `calc(62px + ${(playhead / doc.duration) * ($("timeline").clientWidth - 62)}px)`;
});

renderAll();
void loadSprites().catch((error) => {
    console.error(error);
    $("loading").textContent = "Could not load sprites. Pose editing still works.";
});
