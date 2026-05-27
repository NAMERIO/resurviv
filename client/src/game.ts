import * as PIXI from "pixi.js-legacy";
import { AmongUsSecurityCameraDefs } from "../../shared/defs/amongUsSecurityCameraDefs";
import { AmongUsTaskDefs, type AmongUsTaskId } from "../../shared/defs/amongUsTaskDefs";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import type { OutfitDef } from "../../shared/defs/gameObjects/outfitDefs";
import { RoleDefs } from "../../shared/defs/gameObjects/roleDefs";
import { MapObjectDefs } from "../../shared/defs/mapObjectDefs";
import type {
    BuildingDef,
    DecalDef,
    ObstacleDef,
} from "../../shared/defs/mapObjectsTyping";
import { GameConfig, Input, TeamMode, WeaponSlot } from "../../shared/gameConfig";
import * as net from "../../shared/net/net";
import { ObjectType } from "../../shared/net/objectSerializeFns";
import { collider } from "../../shared/utils/collider";
import { math } from "../../shared/utils/math";
import { type Vec2, v2 } from "../../shared/utils/v2";
import type { Ambiance } from "./ambiance";
import type { AudioManager } from "./audioManager";
import { Camera } from "./camera";
import type { ConfigManager, DebugRenderOpts } from "./config";
import { DebugHUD } from "./debug/debugHUD";
import { debugLines } from "./debug/debugLines";

import { Editor } from "./debug/editor";

import { device } from "./device";
import { discordPresence } from "./discordPresence";
import { EmoteBarn } from "./emote";
import { Gas } from "./gas";
import { helpers } from "./helpers";
import { type InputHandler, Key } from "./input";
import type { InputBinds, InputBindUi } from "./inputBinds";
import type { SoundHandle } from "./lib/createJS";
import { Map } from "./map";
import { AirdropBarn } from "./objects/airdrop";
import type { Building } from "./objects/building";
import { BulletBarn, createBullet } from "./objects/bullet";
import { DeadBodyBarn } from "./objects/deadBody";
import { DecalBarn } from "./objects/decal";
import { ExplosionBarn } from "./objects/explosion";
import { FlareBarn } from "./objects/flare";
import { LootBarn } from "./objects/loot";
import { Creator } from "./objects/objectPool";
import type { Obstacle } from "./objects/obstacle";
import { ParticleBarn } from "./objects/particles";
import { PlaneBarn } from "./objects/plane";
import { type Player, PlayerBarn } from "./objects/player";
import { ProjectileBarn } from "./objects/projectile";
import { ShotBarn } from "./objects/shot";
import { SmokeBarn } from "./objects/smoke";
import { Renderer } from "./renderer";
import type { ResourceManager } from "./resources";
import { SDK } from "./sdk/sdk";
import type { Localization } from "./ui/localization";
import { Touch } from "./ui/touch";
import { UiManager } from "./ui/ui";
import { UiManager2 } from "./ui/ui2";

const amongUsVisionDarkAlpha = 0.82;
const amongUsVisionFadeDistance = 8;
const amongUsVisionClearRadiusScale = 0.35;
const amongUsVisionTextureFadeRadiusScale = 0.1;
const amongUsCameraFeedRadius = 22;
const amongUsCameraFeedWorldSize = amongUsCameraFeedRadius * 2;
const amongUsCameraMaxPixelRatio = 2;
const amongUsCameraRenderIntervalMs = 1000 / 60;
const cafeteriaFloorSprite = {
    img: "/img/map/map-cafeteria.svg",
    center: v2.create(-5.875, -5.469),
    worldWidth: (4911 / 16) * 0.5,
    worldHeight: (2355 / 16) * 0.5,
};

type AmongUsCameraSpriteImage = {
    scale?: number;
    alpha?: number;
    mirrorX?: boolean;
    mirrorY?: boolean;
};

interface AmongUsCameraSpriteFrame {
    source: CanvasImageSource;
    frame: PIXI.Rectangle;
    width: number;
    height: number;
    trim: PIXI.Rectangle | null;
}

interface AmongUsCameraStaticObjectRender {
    type: string;
    key: string;
    pos: Vec2;
    rot: number;
    scale: number;
    sprite?: string;
    img: AmongUsCameraSpriteImage;
}

interface AmongUsCameraStaticObjectCache {
    cafeteriaId: number;
    cafeteriaPos: Vec2;
    cafeteriaRot: number;
    cafeteriaScale: number;
    entriesByFeed: AmongUsCameraStaticObjectRender[][];
    keySetsByFeed: Set<string>[];
    allKeys: Set<string>;
}

interface AmongUsCameraBaseSceneCache {
    width: number;
    height: number;
    feedX: number;
    feedY: number;
    worldFeedX: number;
    worldFeedY: number;
    imageLoaded: boolean;
    cafeteriaId: number;
    cafeteriaPos: Vec2;
    cafeteriaRot: number;
    cafeteriaScale: number;
    canvas: HTMLCanvasElement;
}

interface AmongUsCameraPlayerTrack {
    pos: Vec2;
    target: Vec2;
    lastRenderTime: number;
}

function colorToCss(tint: number) {
    return `#${(tint & 0xffffff).toString(16).padStart(6, "0")}`;
}

function createAmongUsVisionGradient() {
    const size = 1024;
    const center = size * 0.5;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const fadeRadius = center * amongUsVisionTextureFadeRadiusScale;
    const gradient = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        fadeRadius,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(amongUsVisionClearRadiusScale, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, `rgba(0, 0, 0, ${amongUsVisionDarkAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    sprite.anchor.set(0.5, 0.5);
    sprite.visible = false;
    return sprite;
}

export interface Ctx {
    audioManager: AudioManager;
    renderer: Renderer;
    particleBarn: ParticleBarn;
    map: Map;
    smokeBarn: SmokeBarn;
    decalBarn: DecalBarn;
}

export class Game {
    initialized = false;
    teamMode: TeamMode = TeamMode.Solo;

    victoryMusic: SoundHandle | null = null;
    m_ws: WebSocket | null = null;
    connecting = false;
    connected = false;

    m_touch!: Touch;
    m_camera!: Camera;
    m_renderer!: Renderer;
    m_particleBarn!: ParticleBarn;
    m_decalBarn!: DecalBarn;
    m_map!: Map;
    m_playerBarn!: PlayerBarn;
    m_bulletBarn!: BulletBarn;
    m_flareBarn!: FlareBarn;
    m_projectileBarn!: ProjectileBarn;
    m_explosionBarn!: ExplosionBarn;
    m_planeBarn!: PlaneBarn;
    m_airdropBarn!: AirdropBarn;
    m_smokeBarn!: SmokeBarn;
    m_deadBodyBarn!: DeadBodyBarn;
    m_lootBarn!: LootBarn;
    m_gas!: Gas;
    m_uiManager!: UiManager;
    m_ui2Manager!: UiManager2;
    m_emoteBarn!: EmoteBarn;
    m_shotBarn!: ShotBarn;
    m_objectCreator!: Creator;

    m_debugDisplay!: PIXI.Graphics;
    m_hideAndSeekBlindOverlay!: PIXI.Graphics;
    m_amongUsVisionGradient!: PIXI.Sprite;
    m_hideAndSeekHunterReleaseLastSecond = -1;
    m_hideAndSeekHunterReleaseWasActive = false;
    m_infectedRespawnLastSecond = -1;
    m_infectedRespawnWasActive = false;
    m_miniGameWinCountdownLastSecond = -1;
    m_amongUsEmergencyMeetingSeq = 0;
    m_amongUsMeeting: net.AmongUsMeetingStateMsg | null = null;
    m_amongUsMeetingDeadline = 0;
    m_amongUsMeetingSelectedId = -1;
    m_amongUsMeetingChatMessages: Array<{ playerId: number; message: string }> = [];
    m_amongUsTask: AmongUsTaskId | null = null;
    m_amongUsCompletedTasks = new Set<AmongUsTaskId>();
    m_amongUsTaskCloseTimeout = 0;
    m_amongUsDraggedTaskItem: HTMLButtonElement | null = null;
    m_amongUsCamerasOpen = false;
    m_amongUsCameraCanvases: HTMLCanvasElement[] = [];
    m_amongUsCameraImage: HTMLImageElement | null = null;
    m_amongUsCameraImageLoaded = false;
    m_amongUsCameraKeyHandler: ((event: KeyboardEvent) => void) | null = null;
    m_amongUsCameraLastRenderTime = 0;
    m_amongUsCameraSpriteCache = new globalThis.Map<string, AmongUsCameraSpriteFrame>();
    m_amongUsCameraTintedSpriteCache = new globalThis.Map<
        string,
        AmongUsCameraSpriteFrame
    >();
    m_amongUsCameraStaticObjectCache: AmongUsCameraStaticObjectCache | null = null;
    m_amongUsCameraBaseSceneCache: Array<AmongUsCameraBaseSceneCache | undefined> = [];
    m_amongUsCameraPlayerTracks = new globalThis.Map<number, AmongUsCameraPlayerTrack>();
    m_canvasMode!: boolean;

    m_updatePass!: boolean;
    m_updatePassDelay!: number;
    m_disconnectMsg!: string;
    m_playing!: boolean;
    m_gameOver!: boolean;
    m_spectating!: boolean;
    m_spectateCooldown!: number;
    m_inputMsgTimeout!: number;
    m_prevInputMsg!: net.InputMsg;
    m_playingTicker!: number;
    m_updateRecvCount!: number;
    m_localId!: number;
    m_activeId!: number;
    m_activePlayer!: Player;
    m_validateAlpha!: boolean;
    m_targetZoom!: number;
    m_debugZoom!: number;
    m_useDebugZoom!: boolean;

    editor?: Editor;
    debugHUD!: DebugHUD;

    seq!: number;
    seqInFlight!: boolean;
    seqSendTime!: number;
    pings!: number[];
    m_arenaPrivate = false;
    debugPingTime!: number;
    lastUpdateTime!: number;
    updateIntervals!: number[];

    constructor(
        public m_pixi: PIXI.Application,
        public m_audioManager: AudioManager,
        public m_localization: Localization,
        public m_config: ConfigManager,
        public m_input: InputHandler,
        public m_inputBinds: InputBinds,
        public m_inputBindUi: InputBindUi,
        public m_ambience: Ambiance,
        public m_resourceManager: ResourceManager,
        public onJoin: () => void,
        public onQuit: (err?: string) => void,
    ) {
        this.m_pixi = m_pixi;
        this.m_audioManager = m_audioManager;
        this.m_ambience = m_ambience;
        this.m_localization = m_localization;
        this.m_config = m_config;
        this.m_input = m_input;
        this.m_inputBinds = m_inputBinds;
        this.m_inputBindUi = m_inputBindUi;
        this.m_resourceManager = m_resourceManager;

        if (IS_DEV || this.canUseDeveloper()) {
            this.editor = new Editor(this.m_config);
        }
    }

    canUseDeveloper() {
        return Boolean(this.m_config.get("profile")?.canUseDeveloper);
    }

    tryJoinGame(
        url: string,
        matchPriv: string,
        questPriv: string,
        onConnectFail: () => void,
        battleRoyaleMode = false,
    ) {
        if (!this.connecting && !this.connected && !this.initialized) {
            if (this.m_ws) {
                this.m_ws.onerror = function () {};
                this.m_ws.onopen = function () {};
                this.m_ws.onmessage = function () {};
                this.m_ws.onclose = function () {};
                this.m_ws.close();
                this.m_ws = null;
            }
            this.connecting = true;
            this.connected = false;
            try {
                this.m_ws = new WebSocket(url);
                this.m_ws.binaryType = "arraybuffer";
                this.m_ws.onerror = (_err) => {
                    this.m_ws?.close();
                };
                this.m_ws.onopen = () => {
                    this.connecting = false;
                    this.connected = true;
                    const name = this.m_config.get("playerName")!;
                    const joinMessage = new net.JoinMsg();
                    joinMessage.protocol = GameConfig.protocolVersion;
                    joinMessage.matchPriv = matchPriv;
                    joinMessage.questPriv = questPriv;
                    joinMessage.name = name;
                    joinMessage.useTouch = device.touch;
                    joinMessage.isMobile = device.mobile || window.mobile!;
                    joinMessage.bot = false;
                    joinMessage.showClanTag = this.m_config.get("showClanTags")!;
                    const playerLoadout = this.m_config.get("loadout")!;
                    joinMessage.loadout = {
                        ...playerLoadout,
                        death_effect: playerLoadout.death_effect || "death_basic",
                        heal: playerLoadout.heal || "heal_basic",
                        boost: playerLoadout.boost || "boost_basic",
                        perk: battleRoyaleMode
                            ? ""
                            : playerLoadout.perk || "quick_reload",
                        streak: battleRoyaleMode
                            ? ""
                            : playerLoadout.streak || "streak_rapid_fire",
                    };

                    this.m_sendMessage(net.MsgType.Join, joinMessage, 8192);
                };
                this.m_ws.onmessage = (e) => {
                    const msgStream = new net.MsgStream(e.data);
                    while (true) {
                        const type = msgStream.deserializeMsgType();
                        if (type == net.MsgType.None) {
                            break;
                        }
                        this.m_onMsg(type, msgStream.getStream());
                        msgStream.stream.readAlignToNextByte();
                    }
                    this.debugHUD?.netInGraph.addEntry(
                        msgStream.stream.buffer.byteLength,
                    );
                };
                this.m_ws.onclose = () => {
                    const displayingStats = this.m_uiManager?.displayingStats;
                    const connecting = this.connecting;
                    const connected = this.connected;
                    this.connecting = false;
                    this.connected = false;
                    if (connecting) {
                        onConnectFail();
                    } else if (connected && !this.m_gameOver && !displayingStats) {
                        const errMsg = this.m_disconnectMsg || "index-host-closed";
                        this.onQuit(errMsg);
                    }
                };
            } catch (err) {
                console.error(err);
                this.connecting = false;
                this.connected = false;
                onConnectFail();
            }
        }
    }

    init() {
        this.m_canvasMode = this.m_pixi.renderer.type == PIXI.RENDERER_TYPE.CANVAS;

        // Modules
        this.m_touch = new Touch(this.m_input, this.m_config);
        this.m_camera = new Camera();
        this.m_renderer = new Renderer(this, this.m_canvasMode);
        this.m_particleBarn = new ParticleBarn(this.m_renderer);
        this.m_decalBarn = new DecalBarn();
        this.m_map = new Map(this.m_decalBarn);
        this.m_playerBarn = new PlayerBarn();
        this.m_bulletBarn = new BulletBarn();
        this.m_flareBarn = new FlareBarn();
        this.m_projectileBarn = new ProjectileBarn();
        this.m_explosionBarn = new ExplosionBarn();
        this.m_planeBarn = new PlaneBarn(this.m_audioManager);
        this.m_airdropBarn = new AirdropBarn();
        this.m_smokeBarn = new SmokeBarn();
        this.m_deadBodyBarn = new DeadBodyBarn();
        this.m_lootBarn = new LootBarn();
        this.m_gas = new Gas(this.m_canvasMode);
        this.m_uiManager = new UiManager(
            this,
            this.m_audioManager,
            this.m_particleBarn,
            this.m_planeBarn,
            this.m_localization,
            this.m_canvasMode,
            this.m_touch,
            this.m_inputBinds,
            this.m_inputBindUi,
        );
        this.m_ui2Manager = new UiManager2(this.m_localization, this.m_inputBinds);
        this.initAmongUsMeetingUi();
        this.initAmongUsTaskUi();
        this.initAmongUsCameraUi();
        {
            const loadout = this.m_config.get("loadout");
            this.m_ui2Manager.setChosenStreakType(loadout?.streak || "");
        }
        this.m_emoteBarn = new EmoteBarn(
            this.m_audioManager,
            this.m_uiManager,
            this.m_playerBarn,
            this.m_camera,
            this.m_map,
        );
        this.m_shotBarn = new ShotBarn();
        this.debugHUD = new DebugHUD(this.m_config);

        // this.particleBarn,
        // this.audioManager,
        // this.uiManager

        // Register types
        const TypeToPool = {
            [ObjectType.Player]: this.m_playerBarn.playerPool,
            [ObjectType.Obstacle]: this.m_map.m_obstaclePool,
            [ObjectType.Loot]: this.m_lootBarn.lootPool,
            [ObjectType.DeadBody]: this.m_deadBodyBarn.deadBodyPool,
            [ObjectType.Building]: this.m_map.m_buildingPool,
            [ObjectType.Structure]: this.m_map.m_structurePool,
            [ObjectType.Decal]: this.m_decalBarn.decalPool,
            [ObjectType.Projectile]: this.m_projectileBarn.projectilePool,
            [ObjectType.Smoke]: this.m_smokeBarn.m_smokePool,
            [ObjectType.Airdrop]: this.m_airdropBarn.airdropPool,
        };

        this.m_objectCreator = new Creator();
        for (const type in TypeToPool) {
            if (TypeToPool.hasOwnProperty(type)) {
                this.m_objectCreator.m_registerType(
                    type,
                    TypeToPool[type as unknown as keyof typeof TypeToPool],
                );
            }
        }
        // Render ordering
        this.m_debugDisplay = new PIXI.Graphics();
        this.m_hideAndSeekBlindOverlay = new PIXI.Graphics();
        this.m_amongUsVisionGradient = createAmongUsVisionGradient();
        const pixiContainers = [
            this.m_map.display.ground,
            this.m_renderer.layers[0],
            this.m_renderer.ground,
            this.m_renderer.layers[1],
            this.m_renderer.layers[2],
            this.m_renderer.layers[3],
            this.m_debugDisplay,
            this.m_gas.gasRenderer.display,
            this.m_amongUsVisionGradient,
            this.m_hideAndSeekBlindOverlay,
            this.m_touch.container,
            this.m_emoteBarn.container,
            this.m_uiManager.container,
            this.m_uiManager.m_pieTimer.container,
            this.m_emoteBarn.indContainer,
            this.debugHUD.container,
        ];
        for (let i = 0; i < pixiContainers.length; i++) {
            const container = pixiContainers[i];
            if (container) {
                container.interactiveChildren = false;
                this.m_pixi.stage.addChild(container);
            }
        }
        // Local vars
        this.m_disconnectMsg = "";
        this.m_playing = false;
        this.m_gameOver = false;
        this.m_spectating = false;
        this.m_spectateCooldown = 0;
        this.m_inputMsgTimeout = 0;
        this.m_prevInputMsg = new net.InputMsg();
        this.m_playingTicker = 0;
        this.m_updateRecvCount = 0;
        this.m_updatePass = false;
        this.m_updatePassDelay = 0;
        this.m_localId = 0;
        this.m_activeId = 0;
        this.m_activePlayer = null as unknown as Player;
        this.m_validateAlpha = false;
        this.m_targetZoom = 1;
        this.m_debugZoom = 1;
        this.m_useDebugZoom = false;

        // Latency determination

        this.seq = 0;
        this.seqInFlight = false;
        this.seqSendTime = 0;
        this.pings = [];
        this.updateIntervals = [];
        this.lastUpdateTime = 0;
        this.debugPingTime = 0;
        this.m_amongUsEmergencyMeetingSeq = 0;
        this.m_amongUsMeeting = null;
        this.m_amongUsMeetingSelectedId = -1;
        this.m_amongUsMeetingChatMessages = [];
        this.m_amongUsTask = null;
        this.m_amongUsCompletedTasks.clear();
        this.m_amongUsCamerasOpen = false;
        this.m_amongUsCameraLastRenderTime = 0;
        this.clearAmongUsCameraRenderCaches();
        window.clearTimeout(this.m_amongUsTaskCloseTimeout);
        this.m_amongUsTaskCloseTimeout = 0;
        document.body.classList.remove("among-us-meeting-active");
        document.body.classList.remove("among-us-task-active");
        document.body.classList.remove("among-us-cameras-active");
        document.getElementById("ui-among-us-meeting")!.style.display = "none";
        document.getElementById("ui-among-us-task")!.style.display = "none";
        document.getElementById("ui-among-us-cameras")!.style.display = "none";

        // Process config
        this.m_camera.m_setShakeEnabled(this.m_config.get("screenShake")!);
        this.m_camera.m_setInterpEnabled(this.m_config.get("interpolation")!);
        this.m_camera.m_setRotationEnabled(this.m_config.get("localRotation")!);
        this.m_playerBarn.anonPlayerNames = this.m_config.get("anonPlayerNames")!;
        this.m_playerBarn.showClanTags = this.m_config.get("showClanTags")!;
        this.m_playerBarn.localPlayerId = this.m_localId;
        this.initialized = true;
    }

    free() {
        if (this.m_ws) {
            this.m_ws.onmessage = function () {};
            this.m_ws.close();
            this.m_ws = null;
        }
        this.connecting = false;
        this.connected = false;
        if (this.initialized) {
            this.initialized = false;
            this.m_updatePass = false;
            this.m_updatePassDelay = 0;
            this.m_emoteBarn.m_free();
            this.m_ui2Manager.m_free();
            this.m_uiManager.m_free();
            this.m_gas.m_free();
            this.m_airdropBarn.m_free();
            this.m_planeBarn.m_free();
            this.m_map.m_free();
            this.m_particleBarn.m_free();
            this.m_renderer.m_free();
            this.m_input.m_free();
            if (this.m_amongUsCameraKeyHandler) {
                document.removeEventListener("keydown", this.m_amongUsCameraKeyHandler);
                this.m_amongUsCameraKeyHandler = null;
            }
            this.m_audioManager.stopAll();

            while (this.m_pixi.stage.children.length > 0) {
                const c = this.m_pixi.stage.children[0];
                this.m_pixi.stage.removeChild(c);
                c.destroy({
                    children: true,
                });
            }
        }
    }

    warnPageReload() {
        return (
            import.meta.env.PROD &&
            this.initialized &&
            this.m_playing &&
            !this.m_spectating &&
            !this.m_uiManager.displayingStats
        );
    }

    update(dt: number) {
        this.debugHUD.m_update(dt, this);

        if (!this.editor && this.canUseDeveloper()) {
            this.editor = new Editor(this.m_config);
        }

        if (IS_DEV || this.canUseDeveloper()) {
            if (this.editor && this.m_input.keyPressed(Key.Tilde)) {
                this.editor.setEnabled(!this.editor.enabled);
            }
            if (this.editor?.enabled) {
                this.editor.m_update(this.m_input, this.m_camera);
            }
        }

        let debug: DebugRenderOpts;
        if (IS_DEV) {
            debug = this.m_config.get("debugRenderer")!;
        } else {
            debug = {} as DebugRenderOpts;
        }

        const smokeParticles = this.m_smokeBarn.m_particles;

        if (this.m_playing) {
            this.m_playingTicker += dt;
        }
        this.m_playerBarn.m_update(
            dt,
            this.m_activeId,
            this.m_renderer,
            this.m_particleBarn,
            this.m_camera,
            this.m_map,
            this.m_lootBarn,
            this.m_arenaPrivate,
            this.m_inputBinds,
            this.m_touch.shotDetected,
            this.m_audioManager,
            this.m_ui2Manager,
            this.m_emoteBarn.wheelKeyTriggered,
            this.m_uiManager.displayingStats,
            this.m_spectating,
            Boolean(this.m_config.get("debugTools")?.invisible),
        );
        this.updateAmbience();

        this.m_camera.m_pos = v2.copy(this.m_activePlayer.m_visualPos);
        this.m_camera.m_applyShake();
        const zoom = this.m_activePlayer.m_getZoom();

        const minDim = math.min(
            this.m_camera.m_screenWidth,
            this.m_camera.m_screenHeight,
        );
        const maxDim = math.max(
            this.m_camera.m_screenWidth,
            this.m_camera.m_screenHeight,
        );
        const maxScreenDim = math.max(minDim * (16 / 9), maxDim);
        this.m_camera.m_targetZoom = (maxScreenDim * 0.5) / (zoom * this.m_camera.m_ppu);
        const zoomLerpIn = this.m_activePlayer.zoomFast ? 3 : 2;
        const zoomLerpOut = this.m_activePlayer.zoomFast ? 3 : 1.4;
        const zoomLerp =
            this.m_camera.m_targetZoom > this.m_camera.m_zoom ? zoomLerpIn : zoomLerpOut;
        this.m_camera.m_zoom = math.lerp(
            dt * zoomLerp,
            this.m_camera.m_zoom,
            this.m_camera.m_targetZoom,
        );
        this.m_audioManager.cameraPos = v2.copy(this.m_camera.m_pos);
        if (this.m_input.keyPressed(Key.Escape)) {
            this.m_uiManager.toggleEscMenu();
        }
        // Large Map
        if (
            this.m_inputBinds.isBindPressed(Input.ToggleMap) ||
            (this.m_input.keyPressed(Key.G) && !this.m_inputBinds.isKeyBound(Key.G))
        ) {
            this.m_uiManager.displayMapLarge(false);
        }
        // Minimap
        if (this.m_inputBinds.isBindPressed(Input.CycleUIMode)) {
            this.m_uiManager.cycleVisibilityMode();
        }
        // Hide UI
        if (
            this.m_inputBinds.isBindPressed(Input.HideUI) ||
            (this.m_input.keyPressed(Key.Escape) && !this.m_uiManager.hudVisible)
        ) {
            this.m_uiManager.cycleHud();
        }
        // Update facing direction
        const playerPos = this.m_activePlayer.m_pos;
        const mousePos = v2.create(
            this.m_activePlayer.m_pos.x +
                (this.m_input.mousePos.x - this.m_camera.m_screenWidth * 0.5) /
                    this.m_camera.m_z(),
            this.m_activePlayer.m_pos.y +
                (this.m_camera.m_screenHeight * 0.5 - this.m_input.mousePos.y) /
                    this.m_camera.m_z(),
        );
        // const mousePos = this.m_camera.m_screenToPoint(this.m_input.mousePos);
        const toMousePos = v2.sub(mousePos, playerPos);
        let toMouseLen = v2.length(toMousePos);
        let toMouseDir =
            toMouseLen > 0.00001 ? v2.div(toMousePos, toMouseLen) : v2.create(1, 0);

        if (this.m_emoteBarn.wheelDisplayed) {
            toMouseLen = this.m_prevInputMsg.toMouseLen;
            toMouseDir = this.m_prevInputMsg.toMouseDir;
        }

        // Input
        const inputMsg = new net.InputMsg();
        inputMsg.seq = this.seq;
        if (!this.m_spectating) {
            if (device.touch) {
                const touchPlayerMovement = this.m_touch.getTouchMovement(this.m_camera);
                const touchAimMovement = this.m_touch.getAimMovement(
                    this.m_activePlayer,
                    this.m_camera,
                );
                let aimDir = v2.copy(touchAimMovement.aimMovement.toAimDir);
                this.m_touch.turnDirTicker -= dt;
                if (this.m_touch.moveDetected && !touchAimMovement.touched) {
                    // Keep looking in the old aimDir while waiting for the ticker
                    const touchDir = v2.normalizeSafe(
                        touchPlayerMovement.toMoveDir,
                        v2.create(1, 0),
                    );
                    const modifiedAimDir =
                        this.m_touch.turnDirTicker < 0
                            ? touchDir
                            : touchAimMovement.aimMovement.toAimDir;
                    this.m_touch.setAimDir(modifiedAimDir);
                    aimDir = modifiedAimDir;
                }
                if (touchAimMovement.touched) {
                    this.m_touch.turnDirTicker = this.m_touch.turnDirCooldown;
                }
                if (this.m_touch.moveDetected) {
                    inputMsg.touchMoveDir = v2.normalizeSafe(
                        touchPlayerMovement.toMoveDir,
                        v2.create(1, 0),
                    );
                    inputMsg.touchMoveLen = Math.round(
                        math.clamp(touchPlayerMovement.toMoveLen, 0, 1) * 255,
                    );
                } else {
                    inputMsg.touchMoveLen = 0;
                }
                inputMsg.touchMoveActive = true;
                const aimLen = touchAimMovement.aimMovement.toAimLen;
                const toTouchLenAdjusted =
                    math.clamp(aimLen / this.m_touch.padPosRange, 0, 1) *
                    GameConfig.player.throwableMaxMouseDist;
                inputMsg.toMouseLen = toTouchLenAdjusted;
                inputMsg.toMouseDir = aimDir;
            } else {
                // Only use arrow keys if they are unbound
                inputMsg.moveLeft =
                    this.m_inputBinds.isBindDown(Input.MoveLeft) ||
                    (this.m_input.keyDown(Key.Left) &&
                        !this.m_inputBinds.isKeyBound(Key.Left));
                inputMsg.moveRight =
                    this.m_inputBinds.isBindDown(Input.MoveRight) ||
                    (this.m_input.keyDown(Key.Right) &&
                        !this.m_inputBinds.isKeyBound(Key.Right));
                inputMsg.moveUp =
                    this.m_inputBinds.isBindDown(Input.MoveUp) ||
                    (this.m_input.keyDown(Key.Up) &&
                        !this.m_inputBinds.isKeyBound(Key.Up));
                inputMsg.moveDown =
                    this.m_inputBinds.isBindDown(Input.MoveDown) ||
                    (this.m_input.keyDown(Key.Down) &&
                        !this.m_inputBinds.isKeyBound(Key.Down));
                inputMsg.toMouseDir = v2.copy(toMouseDir);
                inputMsg.toMouseLen = toMouseLen;
            }
            inputMsg.touchMoveDir = v2.normalizeSafe(
                inputMsg.touchMoveDir,
                v2.create(1, 0),
            );
            inputMsg.touchMoveLen = math.clamp(inputMsg.touchMoveLen, 0, 255);
            inputMsg.toMouseDir = v2.normalizeSafe(inputMsg.toMouseDir, v2.create(1, 0));
            inputMsg.toMouseLen = math.clamp(
                inputMsg.toMouseLen,
                0,
                net.Constants.MouseMaxDist,
            );
            inputMsg.shootStart =
                this.m_inputBinds.isBindPressed(Input.Fire) || this.m_touch.shotDetected;
            inputMsg.shootHold =
                this.m_inputBinds.isBindDown(Input.Fire) || this.m_touch.shotDetected;
            inputMsg.portrait =
                this.m_camera.m_screenWidth < this.m_camera.m_screenHeight;
            const checkInputs = [
                Input.Reload,
                Input.Revive,
                Input.Use,
                Input.Loot,
                Input.Cancel,
                Input.EquipPrimary,
                Input.EquipSecondary,
                Input.EquipThrowable,
                Input.EquipMelee,
                Input.EquipNextWeap,
                Input.EquipPrevWeap,
                Input.EquipLastWeap,
                Input.EquipOtherGun,
                Input.EquipPrevScope,
                Input.EquipNextScope,
                Input.StowWeapons,
            ];
            for (let i = 0; i < checkInputs.length; i++) {
                const input = checkInputs[i];
                if (this.m_inputBinds.isBindPressed(input)) {
                    inputMsg.addInput(input);
                }
            }

            // Handle Interact
            // Interact should not activate Revive, Use, or Loot if those inputs are bound separately.
            if (this.m_inputBinds.isBindPressed(Input.Interact)) {
                const inputs = [];
                const interactBinds = [Input.Revive, Input.Use, Input.Loot];
                for (let i = 0; i < interactBinds.length; i++) {
                    const b = interactBinds[i];
                    if (!this.m_inputBinds.getBind(b)) {
                        inputs.push(b);
                    }
                }
                if (inputs.length == interactBinds.length) {
                    inputMsg.addInput(Input.Interact);
                } else {
                    for (let i = 0; i < inputs.length; i++) {
                        inputMsg.addInput(inputs[i]);
                    }
                }
            }

            // Swap weapon slots
            if (
                this.m_inputBinds.isBindPressed(Input.SwapWeapSlots) ||
                this.m_uiManager.swapWeapSlots
            ) {
                inputMsg.addInput(Input.SwapWeapSlots);
                this.m_activePlayer.gunSwitchCooldown = 0;
            }

            if (
                this.m_inputBinds.isBindPressed(Input.ActivateStreak) ||
                this.m_ui2Manager.streakActivateRequested
            ) {
                inputMsg.addInput(Input.ActivateStreak);
                inputMsg.streakIdx = this.m_ui2Manager.streakClickedIdx;
                this.m_ui2Manager.streakActivateRequested = false;
                this.m_ui2Manager.streakClickedIdx = -1;
            }

            // Handle touch inputs
            if (this.m_uiManager.reloadTouched) {
                inputMsg.addInput(Input.Reload);
            }
            if (this.m_uiManager.interactionTouched) {
                inputMsg.addInput(Input.Interact);
                inputMsg.addInput(Input.Cancel);
            }
            if (
                inputMsg.inputs.includes(Input.Interact) ||
                inputMsg.inputs.includes(Input.Use)
            ) {
                this.openNearbyAmongUsTask();
                this.openNearbyAmongUsCameras();
            }

            // Process 'use' actions trigger from the ui
            for (let i = 0; i < this.m_ui2Manager.uiEvents.length; i++) {
                const e = this.m_ui2Manager.uiEvents[i];
                if (e.action == "use") {
                    if (e.type == "weapon") {
                        const weapIdxToInput = {
                            [WeaponSlot.Primary]: Input.EquipPrimary,
                            [WeaponSlot.Secondary]: Input.EquipSecondary,
                            [WeaponSlot.Melee]: Input.EquipMelee,
                            [WeaponSlot.Throwable]: Input.EquipThrowable,
                        };
                        const input =
                            weapIdxToInput[e.data as keyof typeof weapIdxToInput];
                        if (input) {
                            inputMsg.addInput(input);
                        }
                    } else {
                        inputMsg.useItem = e.data as string;
                    }
                }
            }
            if (this.m_inputBinds.isBindPressed(Input.UseBandage)) {
                inputMsg.useItem = "bandage";
            } else if (this.m_inputBinds.isBindPressed(Input.UseHealthKit)) {
                inputMsg.useItem = "healthkit";
            } else if (this.m_inputBinds.isBindPressed(Input.UseSoda)) {
                inputMsg.useItem = "soda";
            } else if (this.m_inputBinds.isBindPressed(Input.UsePainkiller)) {
                inputMsg.useItem = "painkiller";
            } else if (this.m_inputBinds.isBindPressed(Input.UseNitroLace)) {
                inputMsg.useItem = "nitroLace";
            }

            // Process 'drop' actions triggered from the ui
            let playDropSound = false;
            for (let X = 0; X < this.m_ui2Manager.uiEvents.length; X++) {
                const uiEvent = this.m_ui2Manager.uiEvents[X];
                if (uiEvent.action == "drop") {
                    const dropMsg = new net.DropItemMsg();
                    if (uiEvent.type == "weapon") {
                        const eventData = uiEvent.data as number;
                        const Y = this.m_activePlayer.m_localData.m_weapons;
                        dropMsg.item = Y[eventData].type;
                        dropMsg.weapIdx = eventData;
                    } else if (uiEvent.type == "perk") {
                        const eventData = uiEvent.data as number;
                        const J = this.m_activePlayer.m_netData.m_perks;
                        const Q = J.length > eventData ? J[eventData] : null;
                        if (Q && (Q.droppable || this.m_map.mapName.startsWith("br_"))) {
                            dropMsg.item = Q.type;
                        }
                    } else {
                        const item =
                            uiEvent.data == "helmet"
                                ? this.m_activePlayer.m_netData.m_helmet
                                : uiEvent.data == "chest"
                                  ? this.m_activePlayer.m_netData.m_chest
                                  : uiEvent.data;
                        dropMsg.item = item as string;
                    }
                    if (dropMsg.item != "") {
                        this.m_sendMessage(net.MsgType.DropItem, dropMsg, 128);
                        if (dropMsg.item != "fists") {
                            playDropSound = true;
                        }
                    }
                }
            }
            if (playDropSound) {
                this.m_audioManager.playSound("loot_drop_01", {
                    channel: "ui",
                });
            }
            if (this.m_uiManager.roleSelected) {
                const roleSelectMessage = new net.PerkModeRoleSelectMsg();
                roleSelectMessage.role = this.m_uiManager.roleSelected;
                this.m_sendMessage(
                    net.MsgType.PerkModeRoleSelect,
                    roleSelectMessage,
                    128,
                );
                this.m_config.set("perkModeRole", roleSelectMessage.role);
            }
        }

        this.m_spectateCooldown -= dt;
        const specBegin = this.m_uiManager.specBegin;
        const specNext = (this.m_uiManager.specNext ||=
            this.m_spectating && this.m_input.keyPressed(Key.Right));
        const specPrev = (this.m_uiManager.specPrev ||=
            this.m_spectating && this.m_input.keyPressed(Key.Left));
        const specForce =
            this.m_input.keyPressed(Key.Right) || this.m_input.keyPressed(Key.Left);

        if (
            specBegin ||
            (this.m_spectating && this.m_spectateCooldown < 0 && (specNext || specPrev))
        ) {
            this.m_spectateCooldown = 1;

            const specMsg = new net.SpectateMsg();
            specMsg.specBegin = specBegin;
            specMsg.specNext = specNext;
            specMsg.specPrev = specPrev;
            specMsg.specForce = specForce;
            this.m_sendMessage(net.MsgType.Spectate, specMsg, 128);

            this.m_uiManager.specBegin = false;
            this.m_uiManager.specNext = false;
            this.m_uiManager.specPrev = false;
        }

        this.m_uiManager.reloadTouched = false;
        this.m_uiManager.interactionTouched = false;
        this.m_uiManager.swapWeapSlots = false;
        this.m_uiManager.roleSelected = "";

        // Only send a InputMsg if the new data has changed from the previously sent data. For the look direction, we need to determine if the angle difference is large enough.
        let diff = false;
        for (const k in inputMsg) {
            if (inputMsg.hasOwnProperty(k)) {
                if (k == "inputs") {
                    diff = inputMsg[k].length > 0;
                } else if (k == "toMouseDir" || k == "touchMoveDir") {
                    const dot = math.clamp(
                        v2.dot(inputMsg[k], this.m_prevInputMsg[k]),
                        -1,
                        1,
                    );
                    const angle = math.rad2deg(Math.acos(dot));
                    diff = angle > 0.1;
                } else if (k == "toMouseLen") {
                    diff = Math.abs(this.m_prevInputMsg[k] - inputMsg[k]) > 0.5;
                } else if (k == "shootStart") {
                    diff = inputMsg[k] || inputMsg[k] != this.m_prevInputMsg[k];
                } else if (
                    this.m_prevInputMsg[k as keyof typeof this.m_prevInputMsg] !=
                    inputMsg[k as keyof typeof inputMsg]
                ) {
                    diff = true;
                }
                if (diff) {
                    break;
                }
            }
        }
        this.m_inputMsgTimeout -= dt;
        if (diff || this.m_inputMsgTimeout < 0) {
            if (!this.seqInFlight) {
                this.seq = (this.seq + 1) % 256;
                this.seqSendTime = Date.now();
                this.seqInFlight = true;
                inputMsg.seq = this.seq;
            }
            this.m_sendMessage(net.MsgType.Input, inputMsg, 128);
            this.m_inputMsgTimeout = 1;
            this.m_prevInputMsg = inputMsg;
        }

        // Clear cached data
        this.m_ui2Manager.flushInput();

        if (
            (IS_DEV || this.canUseDeveloper()) &&
            this.editor?.enabled &&
            this.editor.sendMsg
        ) {
            var msg = this.editor.getMsg();
            this.m_sendMessage(net.MsgType.Edit, msg);
            this.editor.postSerialization();
        }

        this.m_map.m_update(
            dt,
            this.m_activePlayer,
            this.m_playerBarn,
            this.m_particleBarn,
            this.m_audioManager,
            this.m_ambience,
            this.m_renderer,
            this.m_camera,
            smokeParticles,
            debug,
        );
        this.m_lootBarn.m_update(
            dt,
            this.m_activePlayer,
            this.m_map,
            this.m_audioManager,
            this.m_camera,
            debug,
        );
        this.m_bulletBarn.m_update(
            dt,
            this.m_playerBarn,
            this.m_map,
            this.m_camera,
            this.m_activePlayer,
            this.m_renderer,
            this.m_particleBarn,
            this.m_audioManager,
        );
        this.m_flareBarn.m_update(dt, this.m_map, this.m_activePlayer, this.m_renderer);
        this.m_projectileBarn.m_update(
            dt,
            this.m_particleBarn,
            this.m_audioManager,
            this.m_activePlayer,
            this.m_map,
            this.m_renderer,
            this.m_camera,
        );
        this.m_explosionBarn.m_update(
            dt,
            this.m_map,
            this.m_playerBarn,
            this.m_camera,
            this.m_particleBarn,
            this.m_audioManager,
            debug,
        );
        this.m_airdropBarn.m_update(
            dt,
            this.m_activePlayer,
            this.m_camera,
            this.m_map,
            this.m_particleBarn,
            this.m_renderer,
            this.m_audioManager,
        );
        this.m_planeBarn.m_update(
            dt,
            this.m_camera,
            this.m_activePlayer,
            this.m_map,
            this.m_renderer,
        );
        this.m_smokeBarn.m_update(
            dt,
            this.m_camera,
            this.m_activePlayer,
            this.m_map,
            this.m_renderer,
        );
        this.m_shotBarn.m_update(
            dt,
            this.m_activeId,
            this.m_playerBarn,
            this.m_particleBarn,
            this.m_audioManager,
        );
        this.m_particleBarn.m_update(dt, this.m_camera);
        this.m_deadBodyBarn.m_update(
            dt,
            this.m_playerBarn,
            this.m_activePlayer,
            this.m_map,
            this.m_camera,
            this.m_renderer,
        );
        this.m_decalBarn.m_update(dt, this.m_camera, this.m_renderer);
        this.m_uiManager.m_update(
            dt,
            this.m_activePlayer,
            this.m_map,
            this.m_gas,
            this.m_playerBarn,
            this.m_camera,
            this.teamMode,
            this.m_map.factionMode,
        );
        this.m_ui2Manager.m_update(
            dt,
            this.m_activePlayer,
            this.m_spectating,
            this.m_playerBarn,
            this.m_lootBarn,
            this.m_map,
            this.m_inputBinds,
            this.m_amongUsCompletedTasks,
        );
        if (this.editor?.enabled && this.editor.toolParams.explosionDecalBrush) {
            this.m_emoteBarn.inputReset();
        } else {
            this.m_emoteBarn.m_update(
                dt,
                this.m_localId,
                this.m_activePlayer,
                this.teamMode,
                this.m_deadBodyBarn,
                this.m_map,
                this.m_renderer,
                this.m_input,
                this.m_inputBinds,
                this.m_spectating,
            );
        }
        this.m_touch.m_update(
            dt,
            this.m_activePlayer,
            this.m_map,
            this.m_camera,
            this.m_renderer,
        );
        this.m_renderer.m_update(dt, this.m_camera, this.m_map);

        for (let i = 0; i < this.m_emoteBarn.newPings.length; i++) {
            const ping = this.m_emoteBarn.newPings[i];
            const msg = new net.EmoteMsg();
            msg.type = ping.type;
            msg.pos = ping.pos;
            msg.isPing = true;
            this.m_sendMessage(net.MsgType.Emote, msg, 128);
        }
        this.m_emoteBarn.newPings = [];
        for (let i = 0; i < this.m_emoteBarn.newEmotes.length; i++) {
            const emote = this.m_emoteBarn.newEmotes[i];
            const msg = new net.EmoteMsg();
            msg.type = emote.type;
            msg.pos = emote.pos;
            msg.isPing = false;
            this.m_sendMessage(net.MsgType.Emote, msg, 128);
        }
        this.m_emoteBarn.newEmotes = [];

        const now = Date.now();
        if (now > this.debugPingTime) {
            this.debugPingTime = now + 20000;
            function format(str: string, len: number) {
                return (" ".repeat(len) + str).slice(-len);
            }
            const pings = this.pings.sort((a, b) => {
                return a - b;
            });
            const pLen = pings.length;
            if (pLen > 0) {
                const med = pings[Math.floor(pLen * 0.5)];
                const p95 = pings[Math.floor(pLen * 0.95)];
                const max = pings[pLen - 1];
                console.log(
                    "Ping     min:",
                    format(pings[0].toFixed(2), 7),
                    "med:",
                    format(med.toFixed(2), 7),
                    "p95:",
                    format(p95.toFixed(2), 7),
                    "max:",
                    format(max.toFixed(2), 7),
                );
            }
            this.pings = [];

            const intervals = this.updateIntervals.sort((a, b) => {
                return a - b;
            });
            const inteLen = intervals.length;
            if (inteLen > 0) {
                const med = intervals[Math.floor(inteLen * 0.5)];
                const p95 = intervals[Math.floor(inteLen * 0.95)];
                const max = intervals[inteLen - 1];
                console.log(
                    "Interval min:",
                    format(intervals[0].toFixed(2), 7),
                    "med:",
                    format(med.toFixed(2), 7),
                    "p95:",
                    format(p95.toFixed(2), 7),
                    "max:",
                    format(max.toFixed(2), 7),
                );
            }
            this.updateIntervals = [];
        }

        this.m_render(dt, debug);
    }

    m_render(dt: number, debug: DebugRenderOpts) {
        const grassColor = this.m_map.mapLoaded
            ? this.m_map.getMapDef().biome.colors.grass
            : 0x80af49;
        this.m_pixi.renderer.background.color = grassColor;
        // Module rendering
        const amongUsVisionRadius = this.m_map.getMapDef().gameMode.amongUsVisionRadius;
        this.m_playerBarn.m_render(
            this.m_camera,
            debug,
            this.m_activePlayer,
            amongUsVisionRadius,
        );
        this.m_bulletBarn.m_render(this.m_camera);
        this.m_flareBarn.m_render(this.m_camera);
        this.m_decalBarn.m_render(this.m_camera, debug, this.m_activePlayer.layer);
        this.m_map.m_render(this.m_camera);
        this.m_gas.m_render(dt, this.m_camera);
        this.renderAmongUsVisionOverlay();
        this.renderAmongUsEmergencyMeetingAnnouncement();
        this.renderAmongUsMeetingUi();
        this.renderAmongUsCameraUi();
        this.renderHideAndSeekBlindOverlay(dt);
        this.renderHideAndSeekHunterReleaseAnnouncement();
        this.renderInfectedRespawnAnnouncement();
        this.renderMiniGameWinCountdownAnnouncement();
        this.m_uiManager.m_render(
            this.m_activePlayer.m_pos,
            this.m_gas,
            this.m_map,
            this.m_planeBarn,
        );
        this.m_emoteBarn.m_render(this.m_camera);
        if (IS_DEV) {
            this.m_debugDisplay.clear();
            if (debug.enabled) {
                debugLines.m_render(this.m_camera, this.m_debugDisplay);
            }
            debugLines.flush();
        }
    }

    renderAmongUsVisionOverlay() {
        const radius = this.m_map.getMapDef().gameMode.amongUsVisionRadius;
        this.m_amongUsVisionGradient.visible = false;
        if (!radius) return;

        const center = this.m_camera.m_pointToScreen(this.m_activePlayer.m_visualPos);
        const fadeEnd = this.m_camera.m_scaleToScreen(radius + amongUsVisionFadeDistance);
        const gradientSize = (fadeEnd * 2) / amongUsVisionTextureFadeRadiusScale;

        this.m_amongUsVisionGradient.position.set(center.x, center.y);
        this.m_amongUsVisionGradient.width = gradientSize;
        this.m_amongUsVisionGradient.height = gradientSize;
        this.m_amongUsVisionGradient.visible = true;
    }

    renderAmongUsEmergencyMeetingAnnouncement() {
        const sequence = this.m_activePlayer.m_localData.m_amongUsEmergencyMeetingSeq;
        if (sequence === this.m_amongUsEmergencyMeetingSeq) return;

        this.m_amongUsEmergencyMeetingSeq = sequence;
        if (sequence > 0) {
            this.m_uiManager.displayAnnouncement(
                this.m_localization.translate("game-among-us-emergency-meeting"),
            );
        }
    }

    initAmongUsTaskUi() {
        const bottleGrid = document.getElementById("among-us-task-bottles")!;
        const closeButton = document.getElementById("among-us-task-close")!;

        closeButton.onclick = () => this.closeAmongUsTask();
        bottleGrid.onclick = (event) => {
            if (!this.m_amongUsTask) return;
            const def = AmongUsTaskDefs[this.m_amongUsTask];
            if (def.type !== "shoot_targets") return;

            const bottle = (event.target as HTMLElement).closest<HTMLButtonElement>(
                ".among-us-task-bottle",
            );
            if (!bottle || bottle.disabled) return;

            const weapon = document.getElementById("among-us-task-weapon")!;
            bottle.disabled = true;
            bottle.classList.add("broken");
            weapon.classList.remove("firing");
            void weapon.offsetWidth;
            weapon.classList.add("firing");
            if (def.shootSound) {
                this.m_audioManager.playSound(def.shootSound, {
                    channel: "activePlayer",
                });
            }
            if (def.breakSound) {
                this.m_audioManager.playSound(def.breakSound, { channel: "sfx" });
            }

            const broken = bottleGrid.querySelectorAll(".broken").length;
            document.getElementById("among-us-task-progress")!.textContent =
                `${broken} / ${def.targetCount}`;
            if (broken !== def.targetCount) return;

            this.completeAmongUsTask();
        };
        document.addEventListener("pointerdown", (event) => {
            if (!this.m_amongUsTask) return;
            const def = AmongUsTaskDefs[this.m_amongUsTask];
            if (def.type !== "drag_to_station") return;

            const item = (event.target as HTMLElement).closest<HTMLButtonElement>(
                ".among-us-task-drag-item",
            );
            if (!item) return;

            event.preventDefault();
            item.setPointerCapture(event.pointerId);
            this.m_amongUsDraggedTaskItem = item;
            item.classList.remove("placed", "loose");
            item.classList.add("dragging");
            this.updateAmongUsDragTaskProgress();
            this.moveAmongUsDraggedTaskItem(event.clientX, event.clientY);
        });
        document.addEventListener("pointermove", (event) => {
            if (!this.m_amongUsDraggedTaskItem) return;
            this.moveAmongUsDraggedTaskItem(event.clientX, event.clientY);
        });
        document.addEventListener("pointerup", (event) => {
            if (!this.m_amongUsDraggedTaskItem || !this.m_amongUsTask) return;
            const item = this.m_amongUsDraggedTaskItem;
            this.m_amongUsDraggedTaskItem = null;
            item.classList.remove("dragging");

            const taskContent = document.querySelector<HTMLElement>(
                ".among-us-task-content",
            )!;
            const dropZone = document.getElementById("among-us-task-drop-zone")!;
            const rect = dropZone.getBoundingClientRect();
            const insideDropZone =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom;

            item.style.left = "";
            item.style.top = "";
            item.style.setProperty("--placed-rot", this.getAmongUsBarRotation(item));

            if (insideDropZone) {
                item.classList.add("placed");
                dropZone.append(item);
                item.style.left = `${event.clientX - rect.left}px`;
                item.style.top = `${event.clientY - rect.top}px`;
            } else {
                const contentRect = taskContent.getBoundingClientRect();
                const x = Math.max(
                    18,
                    Math.min(event.clientX - contentRect.left, contentRect.width - 18),
                );
                const y = Math.max(
                    18,
                    Math.min(event.clientY - contentRect.top, contentRect.height - 18),
                );
                item.classList.add("loose");
                taskContent.append(item);
                item.style.left = `${x}px`;
                item.style.top = `${y}px`;
            }

            this.updateAmongUsDragTaskProgress();
        });
    }

    moveAmongUsDraggedTaskItem(clientX: number, clientY: number) {
        const item = this.m_amongUsDraggedTaskItem;
        if (!item) return;
        item.style.left = `${clientX}px`;
        item.style.top = `${clientY}px`;
    }

    getAmongUsBarRotation(item: HTMLButtonElement) {
        const index = Number(item.dataset.index) || 0;
        return `${(index % 2 === 0 ? -1 : 1) * (3 + index)}deg`;
    }

    updateAmongUsDragTaskProgress() {
        if (!this.m_amongUsTask) return;
        const def = AmongUsTaskDefs[this.m_amongUsTask];
        if (def.type !== "drag_to_station") return;

        const dropZone = document.getElementById("among-us-task-drop-zone")!;
        const placed = dropZone.querySelectorAll(
            ".among-us-task-drag-item.placed",
        ).length;
        document.getElementById("among-us-task-progress")!.textContent =
            `${placed} / ${def.targetCount}`;
        if (placed === def.targetCount) this.completeAmongUsTask();
    }

    completeAmongUsTask() {
        if (!this.m_amongUsTask) return;

        this.m_amongUsCompletedTasks.add(this.m_amongUsTask);
        document.getElementById("among-us-task-panel")!.classList.add("completed");
        document.getElementById("among-us-task-status")!.textContent = "TASK COMPLETE";
        this.m_uiManager.displayAnnouncement("TASK COMPLETE", 2500);
        window.clearTimeout(this.m_amongUsTaskCloseTimeout);
        this.m_amongUsTaskCloseTimeout = window.setTimeout(
            () => this.closeAmongUsTask(true),
            350,
        );
    }

    openNearbyAmongUsTask() {
        if (!this.m_map.getMapDef().gameMode.amongUsMode) return;

        const obstacles = this.m_map.m_obstaclePool.m_getPool();
        for (const obstacle of obstacles) {
            if (
                !obstacle.active ||
                obstacle.dead ||
                obstacle.layer !== this.m_activePlayer.layer
            ) {
                continue;
            }
            const def = MapObjectDefs[obstacle.type] as ObstacleDef;
            if (
                !def.amongUsTask ||
                !def.button ||
                !collider.intersectCircle(
                    obstacle.collider,
                    this.m_activePlayer.m_pos,
                    def.button.interactionRad + this.m_activePlayer.m_rad,
                )
            ) {
                continue;
            }
            if (this.m_amongUsCompletedTasks.has(def.amongUsTask)) return;
            this.openAmongUsTask(def.amongUsTask);
            return;
        }
    }

    openAmongUsTask(taskId: AmongUsTaskId) {
        if (
            !this.m_map.getMapDef().gameMode.amongUsMode ||
            (this.m_amongUsMeeting &&
                this.m_amongUsMeeting.phase !== net.AmongUsMeetingPhase.None)
        ) {
            return;
        }
        if (this.m_amongUsCompletedTasks.has(taskId)) {
            this.m_uiManager.displayAnnouncement("TASK ALREADY COMPLETE", 1800);
            return;
        }

        this.closeAmongUsCameras();
        const def = AmongUsTaskDefs[taskId];
        const panel = document.getElementById("among-us-task-panel")!;
        const bottleGrid = document.getElementById("among-us-task-bottles")!;
        const weapon = document.getElementById("among-us-task-weapon")!;
        const dropZone = document.getElementById("among-us-task-drop-zone")!;
        panel
            .querySelectorAll(".among-us-task-drag-item")
            .forEach((item) => item.remove());
        window.clearTimeout(this.m_amongUsTaskCloseTimeout);
        this.m_amongUsTaskCloseTimeout = 0;
        this.m_amongUsTask = taskId;
        panel.classList.remove(
            "completed",
            "closing",
            "shoot-targets",
            "drag-to-station",
        );
        panel.classList.add(
            def.type === "drag_to_station" ? "drag-to-station" : "shoot-targets",
        );
        weapon.classList.remove("firing");
        document.getElementById("among-us-task-title")!.textContent = def.title;
        document.getElementById("among-us-task-instruction")!.textContent =
            def.instruction;
        document.getElementById("among-us-task-progress")!.textContent =
            `0 / ${def.targetCount}`;
        document.getElementById("among-us-task-status")!.textContent = "";
        (document.getElementById("among-us-task-weapon") as HTMLImageElement).src =
            def.type === "drag_to_station"
                ? (def.stationImage ?? "")
                : (def.weaponImage ?? "");
        dropZone.innerHTML = "";
        if (def.type === "drag_to_station") {
            bottleGrid.innerHTML = Array.from({ length: def.targetCount }, (_, index) => {
                return `<button class="among-us-task-drag-item" type="button" data-index="${index}" aria-label="Move gold bar ${index + 1}"><img src="${def.targetImage}" alt=""></button>`;
            }).join("");
        } else {
            bottleGrid.innerHTML = Array.from({ length: def.targetCount }, (_, index) => {
                return `<button class="among-us-task-bottle" type="button" data-index="${index}" aria-label="Break bottle ${index + 1}"><img src="${def.targetImage}" alt=""><span class="among-us-task-shard shard-a"></span><span class="among-us-task-shard shard-b"></span><span class="among-us-task-shard shard-c"></span></button>`;
            }).join("");
        }
        document.body.classList.add("among-us-task-active");
        document.getElementById("ui-among-us-task")!.style.display = "flex";
        this.m_input.onWindowFocus();
    }

    closeAmongUsTask(slideDown = false) {
        const panel = document.getElementById("among-us-task-panel")!;
        window.clearTimeout(this.m_amongUsTaskCloseTimeout);
        this.m_amongUsTaskCloseTimeout = 0;
        if (slideDown && this.m_amongUsTask) {
            panel.classList.add("closing");
            this.m_amongUsTaskCloseTimeout = window.setTimeout(
                () => this.closeAmongUsTask(),
                390,
            );
            return;
        }

        this.m_amongUsTask = null;
        this.m_amongUsDraggedTaskItem = null;
        panel.classList.remove(
            "closing",
            "completed",
            "shoot-targets",
            "drag-to-station",
        );
        document.getElementById("among-us-task-weapon")!.classList.remove("firing");
        document.getElementById("among-us-task-bottles")!.innerHTML = "";
        document.getElementById("among-us-task-drop-zone")!.innerHTML = "";
        panel
            .querySelectorAll(".among-us-task-drag-item")
            .forEach((item) => item.remove());
        document.getElementById("among-us-task-progress")!.textContent = "0 / 6";
        document.getElementById("among-us-task-status")!.textContent = "";
        document.body.classList.remove("among-us-task-active");
        document.getElementById("ui-among-us-task")!.style.display = "none";
        this.m_input.onWindowFocus();
    }

    initAmongUsCameraUi() {
        this.m_amongUsCameraCanvases = Array.from(
            document.querySelectorAll<HTMLCanvasElement>(".among-us-camera-canvas"),
        );

        const labels = Array.from(
            document.querySelectorAll<HTMLElement>(".among-us-camera-label"),
        );
        for (let i = 0; i < labels.length; i++) {
            labels[i].textContent = AmongUsSecurityCameraDefs[i]?.label ?? "";
        }

        const closeButton = document.getElementById("among-us-cameras-close")!;
        closeButton.onclick = () => this.closeAmongUsCameras();

        if (this.m_amongUsCameraKeyHandler) {
            document.removeEventListener("keydown", this.m_amongUsCameraKeyHandler);
        }
        this.m_amongUsCameraKeyHandler = (event) => {
            if (!this.m_amongUsCamerasOpen || event.key !== "Escape") return;
            event.preventDefault();
            this.closeAmongUsCameras();
        };
        document.addEventListener("keydown", this.m_amongUsCameraKeyHandler);

        this.m_amongUsCameraImageLoaded = false;
        this.m_amongUsCameraImage = new Image();
        this.m_amongUsCameraImage.onload = () => {
            this.m_amongUsCameraImageLoaded = true;
            this.clearAmongUsCameraBaseSceneCaches();
        };
        this.m_amongUsCameraImage.src = cafeteriaFloorSprite.img;
    }

    clearAmongUsCameraRenderCaches() {
        this.m_amongUsCameraStaticObjectCache = null;
        this.m_amongUsCameraPlayerTracks.clear();
        this.m_amongUsCameraSpriteCache.clear();
        this.m_amongUsCameraTintedSpriteCache.clear();
        this.clearAmongUsCameraBaseSceneCaches();
    }

    clearAmongUsCameraBaseSceneCaches() {
        this.m_amongUsCameraBaseSceneCache = [];
    }

    openNearbyAmongUsCameras() {
        if (!this.m_map.getMapDef().gameMode.amongUsMode) return;
        if (
            this.m_amongUsMeeting &&
            this.m_amongUsMeeting.phase !== net.AmongUsMeetingPhase.None
        ) {
            return;
        }

        const obstacles = this.m_map.m_obstaclePool.m_getPool();
        for (const obstacle of obstacles) {
            if (
                !obstacle.active ||
                obstacle.dead ||
                obstacle.layer !== this.m_activePlayer.layer ||
                obstacle.type !== "among_us_security_monitor"
            ) {
                continue;
            }
            const def = MapObjectDefs[obstacle.type] as ObstacleDef;
            if (
                !def.button ||
                !collider.intersectCircle(
                    obstacle.collider,
                    this.m_activePlayer.m_pos,
                    def.button.interactionRad + this.m_activePlayer.m_rad,
                )
            ) {
                continue;
            }
            this.openAmongUsCameras();
            return;
        }
    }

    openAmongUsCameras() {
        if (!this.m_map.getMapDef().gameMode.amongUsMode) return;
        if (this.m_amongUsCamerasOpen) return;

        this.closeAmongUsTask();
        this.m_amongUsCamerasOpen = true;
        this.m_amongUsCameraLastRenderTime = 0;
        document.body.classList.add("among-us-cameras-active");
        document.getElementById("ui-among-us-cameras")!.style.display = "flex";
        this.m_input.onWindowFocus();
    }

    closeAmongUsCameras() {
        if (!this.m_amongUsCamerasOpen) return;
        this.m_amongUsCamerasOpen = false;
        this.m_amongUsCameraLastRenderTime = 0;
        document.body.classList.remove("among-us-cameras-active");
        document.getElementById("ui-among-us-cameras")!.style.display = "none";
        this.m_input.onWindowFocus();
    }

    renderAmongUsCameraUi() {
        if (!this.m_amongUsCamerasOpen) return;
        if (!this.m_map.getMapDef().gameMode.amongUsMode) {
            this.closeAmongUsCameras();
            return;
        }

        const now = performance.now();
        if (
            this.m_amongUsCameraLastRenderTime &&
            now - this.m_amongUsCameraLastRenderTime < amongUsCameraRenderIntervalMs
        ) {
            return;
        }
        this.m_amongUsCameraLastRenderTime = now;

        for (let i = 0; i < this.m_amongUsCameraCanvases.length; i++) {
            const feed = AmongUsSecurityCameraDefs[i];
            if (!feed) continue;
            const feedPos = this.getAmongUsCameraFeedPos(i, feed.pos);
            this.renderAmongUsCameraFeed(
                this.m_amongUsCameraCanvases[i],
                i,
                feed,
                feedPos,
                now,
            );
        }
    }

    getAmongUsCameraFeedPos(index: number, fallback: Vec2) {
        const cafeteria = this.getAmongUsCafeteriaBuilding();
        if (cafeteria) {
            return this.getAmongUsCafeteriaWorldPos(fallback, cafeteria);
        }

        if (this.m_map.width && this.m_map.height) {
            return v2.add(
                v2.create(this.m_map.width * 0.5, this.m_map.height * 0.5),
                fallback,
            );
        }

        const cameras = this.m_map.m_obstaclePool
            .m_getPool()
            .filter(
                (obstacle) =>
                    obstacle.active &&
                    !obstacle.dead &&
                    obstacle.type === "among_us_security_camera",
            );
        if (!cameras.length) return fallback;

        let closest = cameras[0];
        let closestDist = Number.MAX_VALUE;
        for (const camera of cameras) {
            const dist = v2.lengthSqr(v2.sub(camera.pos, fallback));
            if (dist < closestDist) {
                closest = camera;
                closestDist = dist;
            }
        }

        const orderedCamera = cameras[index];
        return orderedCamera?.pos && closestDist > 16 ? orderedCamera.pos : closest.pos;
    }

    getAmongUsCafeteriaBuilding() {
        return this.m_map.m_buildingPool
            .m_getPool()
            .find((building) => building.active && building.type === "cafetria_01");
    }

    getAmongUsCafeteriaWorldPos(
        localPos: Vec2,
        cafeteria: Building | undefined = this.getAmongUsCafeteriaBuilding(),
    ) {
        if (cafeteria) {
            return v2.add(
                cafeteria.pos,
                v2.rotate(v2.mul(localPos, cafeteria.scale), cafeteria.rot),
            );
        }

        if (this.m_map.width && this.m_map.height) {
            return v2.add(
                v2.create(this.m_map.width * 0.5, this.m_map.height * 0.5),
                localPos,
            );
        }

        return localPos;
    }

    getAmongUsCafeteriaObjectRot(
        localOri: number,
        inheritOri: boolean | undefined,
        cafeteria: Building | undefined,
    ) {
        const localRot = math.oriToRad(localOri);
        if (!cafeteria || inheritOri === false) return localRot;
        return cafeteria.rot + localRot;
    }

    renderAmongUsCameraFeed(
        canvas: HTMLCanvasElement,
        feedIndex: number,
        feed: (typeof AmongUsSecurityCameraDefs)[number],
        feedPos: Vec2,
        now: number,
    ) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const ratio = math.clamp(
            window.devicePixelRatio || 1,
            1,
            amongUsCameraMaxPixelRatio,
        );
        const pixelWidth = Math.max(1, Math.floor(rect.width * ratio));
        const pixelHeight = Math.max(1, Math.floor(rect.height * ratio));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.drawAmongUsCameraBaseScene(
            ctx,
            rect.width,
            rect.height,
            feed.pos,
            feedIndex,
            feedPos,
        );
        this.drawAmongUsCameraObjects(ctx, rect.width, rect.height, feedIndex, feedPos);
        this.drawAmongUsCameraPlayers(ctx, rect.width, rect.height, feedPos, now);
        this.drawAmongUsCameraStatic(ctx, rect.width, rect.height, now);
    }

    drawAmongUsCameraBaseScene(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
        feedIndex: number,
        worldFeedPos: Vec2,
    ) {
        const cachedScene = this.getAmongUsCameraBaseScene(
            feedIndex,
            width,
            height,
            feedPos,
            worldFeedPos,
        );
        if (cachedScene) {
            ctx.drawImage(cachedScene, 0, 0, width, height);
            return;
        }

        this.drawAmongUsCameraBackgroundContent(ctx, width, height, feedPos);
        this.drawAmongUsCameraStaticObjects(ctx, width, height, feedIndex, worldFeedPos);
    }

    getAmongUsCameraBaseScene(
        feedIndex: number,
        width: number,
        height: number,
        feedPos: Vec2,
        worldFeedPos: Vec2,
    ) {
        const cache = this.m_amongUsCameraBaseSceneCache[feedIndex];
        const canvasWidth = Math.max(1, Math.ceil(width));
        const canvasHeight = Math.max(1, Math.ceil(height));
        const cafeteria = this.getAmongUsCafeteriaBuilding();
        const cafeteriaId = cafeteria?.__id ?? 0;
        const cafeteriaPos = cafeteria?.pos ?? v2.create(0, 0);
        const cafeteriaRot = cafeteria?.rot ?? 0;
        const cafeteriaScale = cafeteria?.scale ?? 1;
        if (
            cache &&
            cache.width === canvasWidth &&
            cache.height === canvasHeight &&
            cache.feedX === feedPos.x &&
            cache.feedY === feedPos.y &&
            cache.worldFeedX === worldFeedPos.x &&
            cache.worldFeedY === worldFeedPos.y &&
            cache.imageLoaded === this.m_amongUsCameraImageLoaded &&
            cache.cafeteriaId === cafeteriaId &&
            v2.eq(cache.cafeteriaPos, cafeteriaPos) &&
            cache.cafeteriaRot === cafeteriaRot &&
            cache.cafeteriaScale === cafeteriaScale
        ) {
            return cache.canvas;
        }

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        this.drawAmongUsCameraBackgroundContent(ctx, canvasWidth, canvasHeight, feedPos);
        this.drawAmongUsCameraStaticObjects(
            ctx,
            canvasWidth,
            canvasHeight,
            feedIndex,
            worldFeedPos,
        );
        this.m_amongUsCameraBaseSceneCache[feedIndex] = {
            width: canvasWidth,
            height: canvasHeight,
            feedX: feedPos.x,
            feedY: feedPos.y,
            worldFeedX: worldFeedPos.x,
            worldFeedY: worldFeedPos.y,
            imageLoaded: this.m_amongUsCameraImageLoaded,
            cafeteriaId,
            cafeteriaPos: v2.copy(cafeteriaPos),
            cafeteriaRot,
            cafeteriaScale,
            canvas,
        };

        return canvas;
    }

    drawAmongUsCameraBackgroundContent(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
    ) {
        ctx.fillStyle = "#050707";
        ctx.fillRect(0, 0, width, height);

        const image = this.m_amongUsCameraImage;
        if (image && this.m_amongUsCameraImageLoaded) {
            const sx0 = this.amongUsCameraWorldToImageX(
                feedPos.x - amongUsCameraFeedRadius,
            );
            const sx1 = this.amongUsCameraWorldToImageX(
                feedPos.x + amongUsCameraFeedRadius,
            );
            const sy0 = this.amongUsCameraWorldToImageY(
                feedPos.y + amongUsCameraFeedRadius,
            );
            const sy1 = this.amongUsCameraWorldToImageY(
                feedPos.y - amongUsCameraFeedRadius,
            );
            const sx = math.clamp(sx0, 0, image.naturalWidth);
            const sy = math.clamp(sy0, 0, image.naturalHeight);
            const sw = math.clamp(sx1, 0, image.naturalWidth) - sx;
            const sh = math.clamp(sy1, 0, image.naturalHeight) - sy;
            if (sw > 1 && sh > 1) {
                ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
            }
        }

        ctx.fillStyle = "rgba(3, 20, 17, 0.48)";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(122, 196, 150, 0.2)";
        ctx.lineWidth = 1;
        const grid = Math.max(18, width / 8);
        for (let x = 0; x <= width; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(240, 196, 92, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.5 - 10, height * 0.5);
        ctx.lineTo(width * 0.5 + 10, height * 0.5);
        ctx.moveTo(width * 0.5, height * 0.5 - 10);
        ctx.lineTo(width * 0.5, height * 0.5 + 10);
        ctx.stroke();
    }

    drawAmongUsCameraObjects(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedIndex: number,
        feedPos: Vec2,
    ) {
        const obstacles = this.m_map.m_obstaclePool.m_getPool();
        const staticObjectKeys = this.getAmongUsCameraStaticObjectKeys();
        for (const obstacle of obstacles) {
            if (
                !obstacle.active ||
                obstacle.dead ||
                obstacle.layer !== this.m_activePlayer.layer
            ) {
                continue;
            }
            const def = MapObjectDefs[obstacle.type];
            if (!def || def.type !== "obstacle") continue;
            if (this.shouldHideAmongUsCameraObject(obstacle, def)) continue;
            if (
                staticObjectKeys.has(
                    this.getAmongUsCameraObjectKey(obstacle.type, obstacle.pos),
                ) &&
                this.getAmongUsCameraObjectSprite(obstacle, def) === def.img.sprite &&
                obstacle.imgRot === 0
            ) {
                continue;
            }
            if (!this.isAmongUsCameraObstacleNearFeed(obstacle, feedPos)) continue;

            this.drawAmongUsCameraObjectImage(ctx, width, height, feedPos, obstacle, def);
        }
    }

    drawAmongUsCameraStaticObjects(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedIndex: number,
        feedPos: Vec2,
    ) {
        for (const object of this.getAmongUsCameraStaticObjects(feedIndex)) {
            this.drawAmongUsCameraObjectSprite(
                ctx,
                width,
                height,
                feedPos,
                object.pos,
                object.rot,
                object.scale,
                object.sprite,
                object.img,
            );
        }
    }

    getAmongUsCameraStaticObjects(feedIndex: number) {
        return this.getAmongUsCameraStaticObjectCache()?.entriesByFeed[feedIndex] ?? [];
    }

    getAmongUsCameraStaticObjectKeys() {
        return this.getAmongUsCameraStaticObjectCache()?.allKeys ?? new Set<string>();
    }

    getAmongUsCameraStaticObjectCache() {
        const cafeteria = this.getAmongUsCafeteriaBuilding();
        if (!cafeteria) return null;

        const cache = this.m_amongUsCameraStaticObjectCache;
        if (
            cache &&
            cache.cafeteriaId === cafeteria.__id &&
            v2.eq(cache.cafeteriaPos, cafeteria.pos) &&
            cache.cafeteriaRot === cafeteria.rot &&
            cache.cafeteriaScale === cafeteria.scale
        ) {
            return cache;
        }

        const rebuiltCache = this.buildAmongUsCameraStaticObjectCache(cafeteria);
        this.m_amongUsCameraStaticObjectCache = rebuiltCache;
        return rebuiltCache;
    }

    buildAmongUsCameraStaticObjectCache(cafeteria: Building) {
        const cafeteriaDef = MapObjectDefs.cafetria_01 as BuildingDef;
        const entriesByFeed = AmongUsSecurityCameraDefs.map(() => {
            return [] as AmongUsCameraStaticObjectRender[];
        });
        const keySetsByFeed = AmongUsSecurityCameraDefs.map(() => {
            return new Set<string>();
        });
        const allKeys = new Set<string>();
        const feedPositions = AmongUsSecurityCameraDefs.map((feed) =>
            this.getAmongUsCafeteriaWorldPos(feed.pos, cafeteria),
        );

        for (const mapObject of cafeteriaDef.mapObjects) {
            const type = mapObject.type;
            if (!type || typeof type !== "string") continue;

            const def = MapObjectDefs[type];
            if (!def || (def.type !== "obstacle" && def.type !== "decal")) continue;
            if (this.shouldHideAmongUsCameraObjectType(type, def)) continue;

            const pos = this.getAmongUsCafeteriaWorldPos(mapObject.pos, cafeteria);
            const rot = this.getAmongUsCafeteriaObjectRot(
                mapObject.ori,
                mapObject.inheritOri,
                cafeteria,
            );
            const entry = {
                type,
                key: this.getAmongUsCameraObjectKey(type, pos),
                pos,
                rot,
                scale: mapObject.scale * cafeteria.scale,
                sprite: def.img.sprite,
                img: def.img,
            };
            allKeys.add(entry.key);

            for (let i = 0; i < AmongUsSecurityCameraDefs.length; i++) {
                if (this.isAmongUsCameraPositionNearFeed(pos, feedPositions[i], 8)) {
                    entriesByFeed[i].push(entry);
                    keySetsByFeed[i].add(entry.key);
                }
            }
        }

        return {
            cafeteriaId: cafeteria.__id,
            cafeteriaPos: v2.copy(cafeteria.pos),
            cafeteriaRot: cafeteria.rot,
            cafeteriaScale: cafeteria.scale,
            entriesByFeed,
            keySetsByFeed,
            allKeys,
        };
    }

    isAmongUsCameraObstacleNearFeed(obstacle: Obstacle, feedPos: Vec2) {
        const aabb = collider.toAabb(obstacle.collider);
        const center = v2.mul(v2.add(aabb.min, aabb.max), 0.5);
        return this.isAmongUsCameraPositionNearFeed(center, feedPos, 4);
    }

    isAmongUsCameraPositionNearFeed(pos: Vec2, feedPos: Vec2, margin: number) {
        const dx = pos.x - feedPos.x;
        const dy = pos.y - feedPos.y;
        return (
            Math.abs(dx) <= amongUsCameraFeedRadius + margin &&
            Math.abs(dy) <= amongUsCameraFeedRadius + margin
        );
    }

    shouldHideAmongUsCameraObject(obstacle: Obstacle, def: ObstacleDef) {
        return this.shouldHideAmongUsCameraObjectType(obstacle.type, def);
    }

    shouldHideAmongUsCameraObjectType(type: string, def: ObstacleDef | DecalDef) {
        const normalizedType = type.toLowerCase();
        return (
            type === "among_us_security_camera" ||
            normalizedType.includes("wall") ||
            (def.type === "obstacle" && (!!def.isWall || def.obstacleType === "wall"))
        );
    }

    getAmongUsCameraObjectKey(type: string, pos: Vec2) {
        return `${type}:${pos.x.toFixed(2)}:${pos.y.toFixed(2)}`;
    }

    getAmongUsCameraObjectSprite(obstacle: Obstacle, def: ObstacleDef) {
        if (obstacle.img && obstacle.img !== "none") return obstacle.img;
        if (obstacle.isButton && obstacle.button.onOff && def.button?.useImg) {
            return def.button.useImg;
        }
        if (obstacle.isButton && !obstacle.button.canUse && def.button?.offImg) {
            return def.button.offImg;
        }
        return def.img.sprite;
    }

    drawAmongUsCameraObjectImage(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
        obstacle: Obstacle,
        def: ObstacleDef,
    ) {
        const sprite = this.getAmongUsCameraObjectSprite(obstacle, def);
        return this.drawAmongUsCameraObjectSprite(
            ctx,
            width,
            height,
            feedPos,
            obstacle.pos,
            obstacle.rot,
            obstacle.scale,
            sprite,
            def.img,
            obstacle.imgRot,
            obstacle.imgMirrorX,
            obstacle.imgMirrorY,
        );
    }

    getAmongUsCameraSpriteFrame(sprite: string) {
        const cached = this.m_amongUsCameraSpriteCache.get(sprite);
        if (cached) return cached;

        const texture = PIXI.Texture.from(sprite);
        if (!texture.valid) return null;

        const resource = texture.baseTexture.resource as
            | { source?: CanvasImageSource }
            | undefined;
        const source = resource?.source;
        if (!source) return null;

        const frame = {
            source,
            frame: texture.frame,
            width: texture.orig.width,
            height: texture.orig.height,
            trim: texture.trim,
        };
        this.m_amongUsCameraSpriteCache.set(sprite, frame);
        return frame;
    }

    getAmongUsCameraTintedSpriteFrame(sprite: string, tint: number) {
        const spriteFrame = this.getAmongUsCameraSpriteFrame(sprite);
        if (!spriteFrame) return null;
        if ((tint & 0xffffff) === 0xffffff) return spriteFrame;

        const cacheKey = `${sprite}:${tint & 0xffffff}`;
        const cached = this.m_amongUsCameraTintedSpriteCache.get(cacheKey);
        if (cached) return cached;

        const frame = spriteFrame.frame;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(frame.width));
        canvas.height = Math.max(1, Math.ceil(frame.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) return spriteFrame;

        ctx.drawImage(
            spriteFrame.source,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            0,
            0,
            canvas.width,
            canvas.height,
        );
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = colorToCss(tint);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(
            spriteFrame.source,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            0,
            0,
            canvas.width,
            canvas.height,
        );
        ctx.globalCompositeOperation = "source-over";

        const tintedFrame = {
            source: canvas,
            frame: new PIXI.Rectangle(0, 0, canvas.width, canvas.height),
            width: spriteFrame.width,
            height: spriteFrame.height,
            trim: spriteFrame.trim,
        };
        this.m_amongUsCameraTintedSpriteCache.set(cacheKey, tintedFrame);
        return tintedFrame;
    }

    drawAmongUsCameraSpriteFrameLocal(
        ctx: CanvasRenderingContext2D,
        spriteFrame: AmongUsCameraSpriteFrame,
        x: number,
        y: number,
        width: number,
        height: number,
        rot = 0,
        mirrorX = false,
        mirrorY = false,
    ) {
        const frame = spriteFrame.frame;
        const trim = spriteFrame.trim;
        const drawX = -width * 0.5 + ((trim?.x ?? 0) / spriteFrame.width) * width;
        const drawY = -height * 0.5 + ((trim?.y ?? 0) / spriteFrame.height) * height;
        const drawW = ((trim?.width ?? spriteFrame.width) / spriteFrame.width) * width;
        const drawH =
            ((trim?.height ?? spriteFrame.height) / spriteFrame.height) * height;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
        ctx.drawImage(
            spriteFrame.source,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            drawX,
            drawY,
            drawW,
            drawH,
        );
        ctx.restore();
    }

    drawAmongUsCameraSpriteLocal(
        ctx: CanvasRenderingContext2D,
        sprite: string | undefined,
        tint: number,
        x: number,
        y: number,
        width: number,
        height: number,
        rot = 0,
        mirrorX = false,
        mirrorY = false,
    ) {
        if (!sprite || sprite === "none") return false;

        const spriteFrame = this.getAmongUsCameraTintedSpriteFrame(sprite, tint);
        if (!spriteFrame) return false;

        this.drawAmongUsCameraSpriteFrameLocal(
            ctx,
            spriteFrame,
            x,
            y,
            width,
            height,
            rot,
            mirrorX,
            mirrorY,
        );
        return true;
    }

    drawAmongUsCameraObjectSprite(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
        pos: Vec2,
        rot: number,
        scale: number,
        sprite: string | undefined,
        img: { scale?: number; alpha?: number; mirrorX?: boolean; mirrorY?: boolean },
        imgRot = 0,
        mirrorX = !!img.mirrorX,
        mirrorY = !!img.mirrorY,
    ) {
        if (!sprite || sprite === "none") return;

        const spriteFrame = this.getAmongUsCameraSpriteFrame(sprite);
        if (!spriteFrame) return;

        const screen = this.amongUsCameraWorldToFeed(pos, feedPos, width, height);
        const frame = spriteFrame.frame;
        const spriteWidth = spriteFrame.width * scale * (img.scale ?? 1);
        const spriteHeight = spriteFrame.height * scale * (img.scale ?? 1);
        const screenW = (spriteWidth / 16 / amongUsCameraFeedWorldSize) * width;
        const screenH = (spriteHeight / 16 / amongUsCameraFeedWorldSize) * height;
        if (screenW <= 0 || screenH <= 0) return;
        const trim = spriteFrame.trim;
        const drawX = -screenW * 0.5 + ((trim?.x ?? 0) / spriteFrame.width) * screenW;
        const drawY = -screenH * 0.5 + ((trim?.y ?? 0) / spriteFrame.height) * screenH;
        const drawW = ((trim?.width ?? spriteFrame.width) / spriteFrame.width) * screenW;
        const drawH =
            ((trim?.height ?? spriteFrame.height) / spriteFrame.height) * screenH;

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(-rot + imgRot);
        ctx.globalAlpha = math.clamp(img.alpha ?? 1, 0, 1);
        ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
        ctx.drawImage(
            spriteFrame.source,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            drawX,
            drawY,
            drawW,
            drawH,
        );
        ctx.restore();
        return true;
    }

    drawAmongUsCameraPlayers(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
        now: number,
    ) {
        const drawnPlayerIds = new Set<number>();
        if (this.m_activePlayer?.active && !this.m_activePlayer.m_netData.m_dead) {
            drawnPlayerIds.add(this.m_activeId);
            this.drawAmongUsCameraPlayer(
                ctx,
                width,
                height,
                feedPos,
                this.m_activeId,
                this.m_activePlayer.m_visualPos,
                this.m_activePlayer.m_netData.m_downed,
                this.m_activePlayer.m_netData.m_dir,
                this.m_activePlayer.m_netData.m_outfit,
                this.m_activePlayer.m_netData.m_scale,
            );
        }

        const players = this.m_playerBarn.playerPool.m_getPool();
        for (const player of players) {
            if (
                !player.active ||
                player.m_netData.m_dead ||
                player.layer !== this.m_activePlayer.layer ||
                drawnPlayerIds.has(player.__id)
            ) {
                continue;
            }

            drawnPlayerIds.add(player.__id);
            this.drawAmongUsCameraPlayer(
                ctx,
                width,
                height,
                feedPos,
                player.__id,
                player.m_visualPos,
                player.m_netData.m_downed,
                player.m_netData.m_dir,
                player.m_netData.m_outfit,
                player.m_netData.m_scale,
            );
        }

        for (const status of Object.values(this.m_playerBarn.playerStatus)) {
            const playerId = status.playerId;
            if (
                !playerId ||
                drawnPlayerIds.has(playerId) ||
                status.dead ||
                status.disconnected
            ) {
                continue;
            }

            this.drawAmongUsCameraPlayer(
                ctx,
                width,
                height,
                feedPos,
                playerId,
                this.getAmongUsCameraPlayerTrackPos(status, now),
                status.downed,
                undefined,
                status.outfit || this.m_playerBarn.getPlayerInfo(playerId).loadout.outfit,
            );
        }
    }

    getAmongUsCameraPlayerTrackPos(
        status: {
            playerId?: number;
            pos: Vec2;
            posTarget?: Vec2;
        },
        now: number,
    ) {
        const playerId = status.playerId;
        const target = status.posTarget ?? status.pos;
        if (!playerId) return target;

        let track = this.m_amongUsCameraPlayerTracks.get(playerId);
        if (!track) {
            track = {
                pos: v2.copy(target),
                target: v2.copy(target),
                lastRenderTime: now,
            };
            this.m_amongUsCameraPlayerTracks.set(playerId, track);
            return track.pos;
        }

        const dt = math.clamp((now - track.lastRenderTime) / 1000, 0, 0.08);
        track.lastRenderTime = now;
        if (!v2.eq(track.target, target)) {
            track.target = v2.copy(target);
        }

        const diff = v2.sub(track.target, track.pos);
        if (v2.lengthSqr(diff) > 64) {
            track.pos = v2.copy(track.target);
            return track.pos;
        }

        track.pos = v2.add(track.pos, v2.mul(diff, 1 - Math.exp(-dt * 18)));
        return track.pos;
    }

    getAmongUsCameraPlayerOutfitDef(outfitType: string | undefined) {
        const type = outfitType || "outfitBase";
        const def = GameObjectDefs[type] as OutfitDef | undefined;
        if (def?.type === "outfit") return def;
        return GameObjectDefs.outfitBase as OutfitDef;
    }

    drawAmongUsCameraPlayer(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        feedPos: Vec2,
        playerId: number,
        pos: Vec2,
        downed: boolean,
        dir = v2.create(1, 0),
        outfitType = "outfitBase",
        playerScale = 1,
    ) {
        const dx = pos.x - feedPos.x;
        const dy = pos.y - feedPos.y;
        if (
            Math.abs(dx) > amongUsCameraFeedRadius ||
            Math.abs(dy) > amongUsCameraFeedRadius
        ) {
            return;
        }

        const screen = this.amongUsCameraWorldToFeed(pos, feedPos, width, height);
        const outfitDef = this.getAmongUsCameraPlayerOutfitDef(outfitType);
        const outfitImg = outfitDef.skinImg;
        const ghillieTint = this.m_map.getMapDef().biome.colors.playerGhillie;
        const bodyTint = outfitDef.ghillie ? ghillieTint : outfitImg.baseTint;
        const handTint = outfitDef.ghillie ? ghillieTint : outfitImg.handTint;
        const visualScale =
            Number.isFinite(playerScale) && playerScale > 0 ? playerScale : 1;
        const bodySize = math.clamp(
            Math.min(width, height) * 0.082 * visualScale,
            16,
            34,
        );
        const handSize = bodySize * 0.52;
        const handOffsetX = bodySize * 0.27;
        const handOffsetY = bodySize * 0.32;

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(-Math.atan2(dir.y, dir.x));
        ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
        ctx.beginPath();
        ctx.ellipse(2, 3, bodySize * 0.48, bodySize * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        this.drawAmongUsCameraSpriteLocal(
            ctx,
            outfitImg.handSprite,
            handTint,
            handOffsetX,
            -handOffsetY,
            handSize,
            handSize,
            0,
            false,
            true,
        );
        this.drawAmongUsCameraSpriteLocal(
            ctx,
            outfitImg.handSprite,
            handTint,
            handOffsetX,
            handOffsetY,
            handSize,
            handSize,
        );
        const drewBody = this.drawAmongUsCameraSpriteLocal(
            ctx,
            outfitImg.baseSprite,
            bodyTint,
            0,
            0,
            bodySize,
            bodySize,
        );
        if (!drewBody) {
            ctx.fillStyle = colorToCss(bodyTint);
            ctx.beginPath();
            ctx.arc(0, 0, bodySize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (outfitImg.frontSprite) {
            const frontPos = outfitImg.frontSpritePos ?? { x: 0, y: 0 };
            const frontOffsetScale = bodySize / 32;
            this.drawAmongUsCameraSpriteLocal(
                ctx,
                outfitImg.frontSprite,
                0xffffff,
                frontPos.x * frontOffsetScale,
                frontPos.y * frontOffsetScale,
                bodySize * 1.08,
                bodySize * 1.08,
            );
        }

        ctx.strokeStyle = playerId === this.m_activeId ? "#ffffff" : "#151515";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, bodySize * 0.5, bodySize * 0.43, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (downed) {
            ctx.strokeStyle = "#f4d35e";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-bodySize * 0.42, -bodySize * 0.42);
            ctx.lineTo(bodySize * 0.42, bodySize * 0.42);
            ctx.moveTo(bodySize * 0.42, -bodySize * 0.42);
            ctx.lineTo(-bodySize * 0.42, bodySize * 0.42);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawAmongUsCameraStatic(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        now: number,
    ) {
        const scanOffset = Math.floor(now / 42) % 6;
        ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
        for (let y = scanOffset; y < height; y += 6) {
            ctx.fillRect(0, y, width, 1);
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        const flicker = 0.08 + Math.sin(now / 160) * 0.035;
        ctx.fillStyle = `rgba(255, 255, 255, ${flicker})`;
        ctx.fillRect(0, 0, width, height);
    }

    amongUsCameraWorldToFeed(pos: Vec2, feedPos: Vec2, width: number, height: number) {
        return {
            x: width * 0.5 + ((pos.x - feedPos.x) / amongUsCameraFeedWorldSize) * width,
            y: height * 0.5 - ((pos.y - feedPos.y) / amongUsCameraFeedWorldSize) * height,
        };
    }

    amongUsCameraWorldToImageX(worldX: number) {
        return (
            ((worldX - cafeteriaFloorSprite.center.x) / cafeteriaFloorSprite.worldWidth +
                0.5) *
            4911
        );
    }

    amongUsCameraWorldToImageY(worldY: number) {
        return (
            (0.5 -
                (worldY - cafeteriaFloorSprite.center.y) /
                    cafeteriaFloorSprite.worldHeight) *
            2355
        );
    }

    initAmongUsMeetingUi() {
        const cards = document.getElementById("among-us-meeting-cards")!;
        const chatInput = document.getElementById(
            "among-us-chat-input",
        ) as HTMLInputElement;
        const chatSend = document.getElementById("among-us-chat-send")!;

        cards.onclick = (event) => {
            const target = event.target as HTMLElement;
            if (target.closest(".among-us-vote-cancel")) {
                this.m_amongUsMeetingSelectedId = -1;
                this.renderAmongUsMeetingUi(true);
                return;
            }
            if (target.closest(".among-us-vote-confirm")) {
                if (
                    this.m_amongUsMeeting?.phase === net.AmongUsMeetingPhase.Voting &&
                    this.m_amongUsMeetingSelectedId >= 0 &&
                    !this.m_amongUsMeeting.submittedVoterIds.includes(this.m_localId)
                ) {
                    const voteMsg = new net.AmongUsMeetingVoteMsg();
                    voteMsg.targetId = this.m_amongUsMeetingSelectedId;
                    this.m_sendMessage(net.MsgType.AmongUsMeetingVote, voteMsg, 16);
                }
                return;
            }
            const card = target.closest<HTMLElement>(".among-us-player-card");
            if (
                !card ||
                this.m_amongUsMeeting?.phase !== net.AmongUsMeetingPhase.Voting ||
                this.m_amongUsMeeting.submittedVoterIds.includes(this.m_localId)
            ) {
                return;
            }
            this.m_amongUsMeetingSelectedId = Number(card.dataset.playerId);
            this.renderAmongUsMeetingUi(true);
        };
        const sendChat = () => {
            if (
                !this.m_amongUsMeeting ||
                (this.m_amongUsMeeting.phase !== net.AmongUsMeetingPhase.Discussion &&
                    this.m_amongUsMeeting.phase !== net.AmongUsMeetingPhase.Voting)
            ) {
                return;
            }
            const message = chatInput.value.trim();
            if (!message) return;
            const chatMsg = new net.AmongUsMeetingChatSendMsg();
            chatMsg.message = message;
            this.m_sendMessage(net.MsgType.AmongUsMeetingChatSend, chatMsg, 256);
            chatInput.value = "";
        };
        chatSend.onclick = sendChat;
        chatInput.onkeydown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendChat();
            }
        };
    }

    applyAmongUsMeetingState(msg: net.AmongUsMeetingStateMsg) {
        const newMeeting =
            !this.m_amongUsMeeting || this.m_amongUsMeeting.sequence !== msg.sequence;
        if (newMeeting) {
            this.m_amongUsMeetingChatMessages = [];
            this.m_amongUsMeetingSelectedId = -1;
            this.m_input.onWindowFocus();
        }

        this.m_amongUsMeeting = msg;
        this.m_amongUsMeetingDeadline = performance.now() + msg.seconds * 1000;
        if (msg.phase !== net.AmongUsMeetingPhase.None) {
            this.closeAmongUsTask();
            this.closeAmongUsCameras();
        }

        if (msg.phase === net.AmongUsMeetingPhase.Ejection && msg.ejectedId) {
            const ejectedName = this.m_playerBarn.getPlayerName(
                msg.ejectedId,
                this.m_activeId,
                false,
            );
            this.m_uiManager.displayAnnouncement(
                `${ejectedName.toUpperCase()} WAS VOTED OUT`,
                2500,
            );
        }

        if (msg.phase === net.AmongUsMeetingPhase.None) {
            const ejectedName = msg.ejectedId
                ? this.m_playerBarn.getPlayerName(msg.ejectedId, this.m_activeId, false)
                : "";
            if (msg.ejectedWasImpostor) {
                this.m_uiManager.displayAnnouncement(
                    `${ejectedName.toUpperCase()} WAS THE IMPOSTOR - CREWMATES WIN`,
                    5000,
                );
            } else if (!ejectedName) {
                this.m_uiManager.displayAnnouncement("NO ONE WAS VOTED OUT", 3000);
            }
        }

        this.renderAmongUsMeetingUi(true);
    }

    addAmongUsMeetingChatMessage(msg: net.AmongUsMeetingChatMsg) {
        if (
            !this.m_amongUsMeeting ||
            this.m_amongUsMeeting.phase === net.AmongUsMeetingPhase.None
        ) {
            return;
        }
        this.m_amongUsMeetingChatMessages.push({
            playerId: msg.playerId,
            message: msg.message,
        });
        const messages = document.getElementById("among-us-chat-messages")!;
        messages.innerHTML = this.m_amongUsMeetingChatMessages
            .map(({ playerId, message }) => {
                const name = this.m_playerBarn.getPlayerName(
                    playerId,
                    this.m_activeId,
                    false,
                );
                const ownClass = playerId === this.m_localId ? " own" : "";
                return `<div class="among-us-chat-message${ownClass}"><strong>${helpers.htmlEscape(name)}:</strong><span>${helpers.htmlEscape(message)}</span></div>`;
            })
            .join("");
        messages.scrollTop = messages.scrollHeight;
    }

    renderAmongUsMeetingUi(rebuildCards = false) {
        const overlay = document.getElementById("ui-among-us-meeting")!;
        const meeting = this.m_amongUsMeeting;
        const visible =
            meeting &&
            meeting.phase !== net.AmongUsMeetingPhase.None &&
            meeting.phase !== net.AmongUsMeetingPhase.Ejection;
        document.body.classList.toggle(
            "among-us-meeting-active",
            !!meeting && meeting.phase !== net.AmongUsMeetingPhase.None,
        );
        overlay.style.display = visible ? "flex" : "none";
        if (!visible || !meeting) return;

        const remainingSeconds = Math.max(
            0,
            Math.floor((this.m_amongUsMeetingDeadline - performance.now()) / 1000),
        );
        const title = document.getElementById("among-us-meeting-title")!;
        const timer = document.getElementById("among-us-meeting-timer")!;
        if (meeting.phase === net.AmongUsMeetingPhase.Discussion) {
            title.textContent = "DISCUSSION";
            timer.textContent = `Voting starts in ${remainingSeconds}`;
        } else if (meeting.phase === net.AmongUsMeetingPhase.Voting) {
            title.textContent = "VOTE";
            timer.textContent = `Voting closes in ${remainingSeconds}`;
        } else {
            title.textContent = "VOTE RESULTS";
            timer.textContent = `Results closing in ${remainingSeconds}`;
        }
        if (!rebuildCards) return;

        const canVote =
            meeting.phase === net.AmongUsMeetingPhase.Voting &&
            !meeting.submittedVoterIds.includes(this.m_localId);
        const votesByTarget = new globalThis.Map<number, number[]>();
        for (const vote of meeting.votes) {
            const voters = votesByTarget.get(vote.targetId) ?? [];
            voters.push(vote.voterId);
            votesByTarget.set(vote.targetId, voters);
        }
        const renderVotes = (targetId: number) =>
            (votesByTarget.get(targetId) ?? [])
                .map((voterId) => {
                    const voterInfo = this.m_playerBarn.getPlayerInfo(voterId);
                    const voterOutfit = helpers.getSvgFromGameType(
                        voterInfo.loadout.outfit || "outfitBase",
                    );
                    return `<span class="among-us-vote-outfit" style="background-image:url('${voterOutfit}')"></span>`;
                })
                .join("");
        const renderActions = (targetId: number) =>
            canVote && this.m_amongUsMeetingSelectedId === targetId
                ? `<span class="among-us-card-actions"><button class="among-us-vote-cancel btn-darken" type="button" aria-label="Cancel vote"></button><button class="among-us-vote-confirm btn-darken" type="button" aria-label="Confirm vote"></button></span>`
                : "";
        const cards = meeting.participantIds.map((playerId) => {
            const info = this.m_playerBarn.getPlayerInfo(playerId);
            const outfit = helpers.getSvgFromGameType(
                info.loadout.outfit || "outfitBase",
            );
            const selected =
                canVote && this.m_amongUsMeetingSelectedId === playerId
                    ? " selected"
                    : "";
            const selectable = canVote ? " selectable" : "";
            const ejected =
                meeting.ejectedId === playerId &&
                meeting.phase === net.AmongUsMeetingPhase.Reveal
                    ? " ejected"
                    : "";
            const name = this.m_playerBarn.getPlayerName(
                playerId,
                this.m_activeId,
                false,
            );
            return `<div class="among-us-player-card${selected}${selectable}${ejected}" data-player-id="${playerId}"><span class="among-us-outfit" style="background-image:url('${outfit}')"></span><span class="among-us-player-name">${helpers.htmlEscape(name)}</span><span class="among-us-card-votes">${renderVotes(playerId)}</span>${renderActions(playerId)}</div>`;
        });
        const skipSelected =
            canVote && this.m_amongUsMeetingSelectedId === 0 ? " selected" : "";
        const skipSelectable = canVote ? " selectable" : "";
        cards.push(
            `<div class="among-us-player-card among-us-skip-card${skipSelected}${skipSelectable}" data-player-id="0"><span class="among-us-skip-icon"></span><span class="among-us-player-name">Skip Vote</span><span class="among-us-card-votes">${renderVotes(0)}</span>${renderActions(0)}</div>`,
        );
        document.getElementById("among-us-meeting-cards")!.innerHTML = cards.join("");
    }

    renderHideAndSeekBlindOverlay(dt: number) {
        const fadeTime = 1;
        const localData = this.m_activePlayer.m_localData;
        localData.m_hideAndSeekBlindTime = math.max(
            0,
            localData.m_hideAndSeekBlindTime - dt,
        );

        this.m_hideAndSeekBlindOverlay.clear();
        if (localData.m_hideAndSeekBlindTime <= 0) return;

        const alpha =
            localData.m_hideAndSeekBlindTime > fadeTime
                ? 1
                : localData.m_hideAndSeekBlindTime / fadeTime;
        this.m_hideAndSeekBlindOverlay.beginFill(0xffffff, alpha);
        this.m_hideAndSeekBlindOverlay.drawRect(
            0,
            0,
            this.m_camera.m_screenWidth,
            this.m_camera.m_screenHeight,
        );
        this.m_hideAndSeekBlindOverlay.endFill();
    }

    renderHideAndSeekHunterReleaseAnnouncement() {
        const localData = this.m_activePlayer.m_localData;
        const timeLeft = localData.m_hideAndSeekHunterReleaseTime;
        if (timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            if (seconds !== this.m_hideAndSeekHunterReleaseLastSecond) {
                const messageKey = localData.m_hideAndSeekHunterReleaseSeeker
                    ? "game-hide-seek-hunter-wait"
                    : "game-hide-seek-hunter-release-in";
                this.m_uiManager.displayAnnouncement(
                    `${this.m_localization.translate(messageKey)} ${seconds} ${this.m_localization.translate("game-seconds")}`,
                    1500,
                );
                this.m_hideAndSeekHunterReleaseLastSecond = seconds;
            }
            this.m_hideAndSeekHunterReleaseWasActive = true;
            return;
        }

        if (this.m_hideAndSeekHunterReleaseWasActive) {
            this.m_uiManager.displayAnnouncement(
                this.m_localization.translate("game-hide-seek-hunters-released"),
            );
        }
        this.m_hideAndSeekHunterReleaseLastSecond = -1;
        this.m_hideAndSeekHunterReleaseWasActive = false;
    }

    renderInfectedRespawnAnnouncement() {
        const timeLeft = this.m_activePlayer.m_localData.m_infectedRespawnTime;
        if (timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            if (seconds !== this.m_infectedRespawnLastSecond) {
                this.m_uiManager.displayAnnouncement(
                    `${this.m_localization.translate("game-infected-respawn-in")} ${seconds} ${this.m_localization.translate("game-seconds")}`,
                    1500,
                );
                this.m_infectedRespawnLastSecond = seconds;
            }
            this.m_infectedRespawnWasActive = true;
            return;
        }

        if (this.m_infectedRespawnWasActive) {
            this.m_uiManager.displayAnnouncement(
                this.m_localization.translate("game-infected-respawned"),
            );
        }
        this.m_infectedRespawnLastSecond = -1;
        this.m_infectedRespawnWasActive = false;
    }

    renderMiniGameWinCountdownAnnouncement() {
        const localData = this.m_activePlayer.m_localData;
        const timeLeft = localData.m_miniGameWinCountdownTime;
        if (timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            if (seconds !== this.m_miniGameWinCountdownLastSecond) {
                const messageKey = localData.m_miniGameWinCountdownProps
                    ? "game-hide-seek-props-win-in"
                    : "game-infected-humans-win-in";
                this.m_uiManager.displayAnnouncement(
                    `${this.m_localization.translate(messageKey)} ${seconds} ${this.m_localization.translate("game-seconds")}`,
                    1500,
                );
                this.m_miniGameWinCountdownLastSecond = seconds;
            }
            return;
        }

        this.m_miniGameWinCountdownLastSecond = -1;
    }

    updateAmbience() {
        const playerPos = this.m_activePlayer.m_pos;
        let wavesWeight = 0;
        let riverWeight = 0;
        let windWeight = 1;
        if (this.m_map.isInOcean(playerPos)) {
            wavesWeight = 1;
            riverWeight = 0;
            windWeight = 0;
        } else {
            const dist = this.m_map.distanceToShore(playerPos);
            wavesWeight = math.delerp(dist, 50, 0);
            riverWeight = 0;
            for (let i = 0; i < this.m_map.terrain!.rivers.length; i++) {
                const river = this.m_map.terrain?.rivers[i]!;
                const closestPointT = river.spline.getClosestTtoPoint(playerPos);
                const closestPoint = river.spline.getPos(closestPointT);
                const distanceToRiver = v2.length(v2.sub(closestPoint, playerPos));
                const riverWidth = river.waterWidth + 2;
                const normalizedDistance = math.delerp(
                    distanceToRiver,
                    30 + riverWidth,
                    riverWidth,
                );
                const riverStrength = math.clamp(river.waterWidth / 8, 0.25, 1);
                riverWeight = math.max(normalizedDistance * riverStrength, riverWeight);
            }
            if (this.m_activePlayer.layer == 1) {
                riverWeight = 0;
            }
            windWeight = 1;
        }
        this.m_ambience.getTrack("wind").weight = windWeight;
        this.m_ambience.getTrack("river").weight = riverWeight;
        this.m_ambience.getTrack("waves").weight = wavesWeight;
    }

    resize() {
        this.m_camera.m_screenWidth = device.screenWidth;
        this.m_camera.m_screenHeight = device.screenHeight;
        this.m_map.resize(this.m_pixi.renderer, this.m_canvasMode);
        this.m_gas.resize();
        this.m_uiManager.resize(this.m_map, this.m_camera);
        this.m_touch.resize();
        this.m_renderer.resize(this.m_map, this.m_camera);
    }

    m_processGameUpdate(msg: net.UpdateMsg) {
        const ctx: Ctx = {
            audioManager: this.m_audioManager,
            renderer: this.m_renderer,
            particleBarn: this.m_particleBarn,
            map: this.m_map,
            smokeBarn: this.m_smokeBarn,
            decalBarn: this.m_decalBarn,
        };
        // Update active playerId
        if (msg.activePlayerIdDirty) {
            this.m_activeId = msg.activePlayerId;
        }
        // Update player infos
        for (let i = 0; i < msg.playerInfos.length; i++) {
            this.m_playerBarn.setPlayerInfo(msg.playerInfos[i]);
        }
        // Delete player infos
        for (let i = 0; i < msg.deletedPlayerIds.length; i++) {
            const playerId = msg.deletedPlayerIds[i];
            this.m_playerBarn.deletePlayerInfo(playerId);
        }
        if (msg.playerInfos.length > 0 || msg.deletedPlayerIds.length > 0) {
            this.m_playerBarn.recomputeTeamData();
        }
        // Update player status
        if (msg.playerStatusDirty) {
            const teamId = this.m_playerBarn.getPlayerInfo(this.m_activeId).teamId;
            const fullStatusMode =
                this.m_map.factionMode ||
                this.m_arenaPrivate ||
                !!this.m_map.getMapDef().gameMode.amongUsMode;
            this.m_playerBarn.updatePlayerStatus(
                teamId,
                msg.playerStatus,
                fullStatusMode,
            );
        }

        // Update group status
        if (msg.groupStatusDirty) {
            const groupId = this.m_playerBarn.getPlayerInfo(this.m_activeId).groupId;
            this.m_playerBarn.updateGroupStatus(groupId, msg.groupStatus);
        }

        // Delete objects
        for (let i = 0; i < msg.delObjIds.length; i++) {
            this.m_objectCreator.m_deleteObj(msg.delObjIds[i]);
        }

        // Update full objects
        for (let i = 0; i < msg.fullObjects.length; i++) {
            const obj = msg.fullObjects[i];
            this.m_objectCreator.m_updateObjFull(obj.__type, obj.__id, obj, ctx);
        }

        // Update partial objects
        for (let i = 0; i < msg.partObjects.length; i++) {
            const obj = msg.partObjects[i];
            this.m_objectCreator.m_updateObjPart(obj.__id, obj, ctx);
        }
        this.m_spectating = this.m_activeId != this.m_localId;
        this.m_playerBarn.localPlayerId = this.m_localId;
        this.m_activePlayer = this.m_playerBarn.getPlayerById(this.m_activeId)!;
        this.m_activePlayer.m_setLocalData(msg.activePlayerData);
        if (msg.activePlayerData.weapsDirty) {
            this.m_uiManager.weapsDirty = true;
        }
        if (this.m_spectating) {
            this.m_uiManager.setSpectateTarget(
                this.m_activeId,
                this.m_localId,
                this.teamMode,
                this.m_playerBarn,
            );
            this.m_touch.hideAll();
        }
        this.m_activePlayer.layer = this.m_activePlayer.m_netData.m_layer;
        this.m_renderer.setActiveLayer(this.m_activePlayer.layer);
        this.m_audioManager.activeLayer = this.m_activePlayer.layer;
        const underground = this.m_activePlayer.isUnderground(this.m_map);
        this.m_renderer.setUnderground(underground);
        this.m_audioManager.underground = underground;

        // Gas data
        if (msg.gasDirty) {
            this.m_gas.setFullState(msg.gasT, msg.gasData, this.m_uiManager);
        }
        if (msg.gasTDirty) {
            this.m_gas.setProgress(msg.gasT);
        }

        // Create bullets
        for (let i = 0; i < msg.bullets.length; i++) {
            const b = msg.bullets[i];
            createBullet(
                b,
                this.m_bulletBarn,
                this.m_flareBarn,
                this.m_playerBarn,
                this.m_renderer,
            );
            if (b.shotFx) {
                this.m_shotBarn.addShot(b);
            }
        }
        // Create explosions
        for (let i = 0; i < msg.explosions.length; i++) {
            const e = msg.explosions[i];
            this.m_explosionBarn.addExplosion(e.type, e.pos, e.layer);
        }

        // Create emotes and pings
        for (let i = 0; i < msg.emotes.length; i++) {
            const e = msg.emotes[i];
            if (e.isPing) {
                this.m_emoteBarn.addPing(e, this.m_map.factionMode);
            } else {
                this.m_emoteBarn.addEmote(e);
            }
        }

        // Update planes
        this.m_planeBarn.updatePlanes(msg.planes, this.m_map);

        // Create airstrike zones
        for (let x = 0; x < msg.airstrikeZones.length; x++) {
            this.m_planeBarn.createAirstrikeZone(msg.airstrikeZones[x]);
        }

        // Update map indicators
        this.m_uiManager.updateMapIndicators(msg.mapIndicators);

        // Update kill leader
        if (msg.killLeaderDirty) {
            const leaderNameText =
                this.m_playerBarn.getPlayerNameHtml(
                    msg.killLeaderId,
                    this.m_activeId,
                    true,
                ) ||
                helpers.htmlEscape(
                    this.m_playerBarn.getPlayerName(
                        msg.killLeaderId,
                        this.m_activeId,
                        true,
                    ),
                );
            this.m_uiManager.updateKillLeader(
                msg.killLeaderId,
                leaderNameText,
                msg.killLeaderKills,
                this.m_map.getMapDef().gameMode,
            );
        }

        // Latency determination
        const now = Date.now();
        this.m_updateRecvCount++;
        if (msg.ack == this.seq && this.seqInFlight) {
            this.seqInFlight = false;
            const ping = now - this.seqSendTime;
            this.debugHUD.pingGraph.addEntry(ping);
            this.pings.push(ping);
        }
        if (this.lastUpdateTime > 0) {
            const interval = now - this.lastUpdateTime;
            this.m_camera.m_interpInterval = interval / 1000;
            this.updateIntervals.push(interval);
        }
        this.lastUpdateTime = now;
    }

    // Socket functions
    m_onMsg(type: net.MsgType, stream: net.BitStream) {
        switch (type) {
            case net.MsgType.Joined: {
                const msg = new net.JoinedMsg();
                msg.deserialize(stream);
                this.onJoin();
                this.teamMode = msg.teamMode;
                this.m_arenaPrivate = !!msg.arenaPrivate;
                this.m_localId = msg.playerId;
                this.m_playerBarn.localPlayerId = this.m_localId;
                this.m_validateAlpha = true;
                this.m_emoteBarn.updateEmoteWheel(msg.emotes);
                if (this.m_arenaPrivate && msg.arenaCountdown > 0) {
                    this.m_ui2Manager.addKillFeedMessage(
                        `${msg.arenaCountdown}`,
                        "#ffd166",
                    );
                }
                if (!msg.started) {
                    this.m_uiManager.setWaitingForPlayers(true);
                }
                this.m_uiManager.removeAds();
                if (this.victoryMusic) {
                    this.victoryMusic.stop();
                    this.victoryMusic = null;
                }
                // Play a sound if the user in another windows or tab
                if (!document.hasFocus()) {
                    this.m_audioManager.playSound("notification_start_01", {
                        channel: "ui",
                    });
                }
                if (IS_DEV || this.canUseDeveloper()) {
                    if (this.editor?.enabled) {
                        this.editor.sendMsg = true;
                    }
                }

                SDK.gamePlayStart();
                discordPresence.matchStart({
                    region: this.m_config.get("region") ?? "unknown",
                    gameMode:
                        this.teamMode === TeamMode.Solo
                            ? "Solo"
                            : this.teamMode === TeamMode.Duo
                              ? "Duo"
                              : "Squad",
                    kills: 0,
                });
                break;
            }
            case net.MsgType.ArenaCountdown: {
                const msg = new net.ArenaCountdownMsg();
                msg.deserialize(stream);
                this.m_ui2Manager.addKillFeedMessage(
                    msg.go ? "GO!" : `${msg.seconds}`,
                    msg.go ? "#58d06f" : "#ffd166",
                );
                break;
            }
            case net.MsgType.AmongUsMeetingState: {
                const msg = new net.AmongUsMeetingStateMsg();
                msg.deserialize(stream);
                this.applyAmongUsMeetingState(msg);
                break;
            }
            case net.MsgType.AmongUsMeetingChat: {
                const msg = new net.AmongUsMeetingChatMsg();
                msg.deserialize(stream);
                this.addAmongUsMeetingChatMessage(msg);
                break;
            }
            case net.MsgType.Map: {
                const msg = new net.MapMsg();
                msg.deserialize(stream);
                this.m_map.loadMap(
                    msg,
                    this.m_camera,
                    this.m_canvasMode,
                    this.m_particleBarn,
                );
                this.m_config.set("serverPerkMode", !!this.m_map.perkMode);
                const isBattleRoyaleMap = this.m_map.mapName.startsWith("br_");
                this.m_ui2Manager.setStreakEnabled(!isBattleRoyaleMap);
                this.m_ui2Manager.setAmmoInventoryEnabled(isBattleRoyaleMap);
                this.m_ui2Manager.setPerkDropEnabled(isBattleRoyaleMap);
                this.m_resourceManager.loadMapAssets(this.m_map.mapName);
                this.m_map.renderMap(this.m_pixi.renderer, this.m_canvasMode);
                this.m_bulletBarn.onMapLoad(this.m_map);
                this.m_particleBarn.onMapLoad(this.m_map);
                this.m_uiManager.onMapLoad(this.m_map, this.m_camera);
                if (this.m_map.getMapDef().gameMode.amongUsMode) {
                    this.m_uiManager.setWaitingForPlayers(false);
                }
                if (this.m_map.perkMode) {
                    const role = this.m_config.get("perkModeRole")!;
                    this.m_uiManager.setRoleMenuOptions(
                        role,
                        this.m_map.getMapDef().gameMode.perkModeRoles!,
                    );
                    this.m_uiManager.setRoleMenuActive(true);
                } else {
                    this.m_uiManager.setRoleMenuActive(false);
                }

                if ((IS_DEV || this.canUseDeveloper()) && this.editor) {
                    this.editor.toolParams.mapSeed = msg.seed;
                    this.editor.pane.refresh();
                }
                break;
            }
            case net.MsgType.Leaderboard: {
                const msg = new net.LeaderboardMsg();
                msg.deserialize(stream);
                if (this.m_map.mapName.startsWith("br_")) {
                    this.m_uiManager.clearLeaderboard();
                    break;
                }
                this.m_uiManager.updateLeaderboard(msg.players);
                break;
            }
            case net.MsgType.Update: {
                const msg = new net.UpdateMsg();
                msg.deserialize(stream, this.m_objectCreator);
                this.m_playing = true;
                this.m_processGameUpdate(msg);
                break;
            }
            case net.MsgType.Kill: {
                const msg = new net.KillMsg();
                msg.deserialize(stream);
                const sourceType = msg.itemSourceType || msg.mapSourceType;
                const activeTeamId = this.m_playerBarn.getPlayerInfo(
                    this.m_activeId,
                ).teamId;
                const useKillerInfoInFeed =
                    (msg.downed && !msg.killed) ||
                    msg.damageType == GameConfig.DamageType.Gas ||
                    msg.damageType == GameConfig.DamageType.Bleeding ||
                    msg.damageType == GameConfig.DamageType.Airdrop ||
                    msg.damageType == GameConfig.DamageType.Burning;
                const targetInfo = this.m_playerBarn.getPlayerInfo(msg.targetId);
                const killerInfo = this.m_playerBarn.getPlayerInfo(msg.killCreditId);
                const killfeedKillerInfo = useKillerInfoInFeed
                    ? killerInfo
                    : this.m_playerBarn.getPlayerInfo(msg.killerId);
                let targetName = this.m_playerBarn.getPlayerName(
                    targetInfo.playerId,
                    this.m_activeId,
                    true,
                );
                let killerName = this.m_playerBarn.getPlayerName(
                    killerInfo.playerId,
                    this.m_activeId,
                    true,
                );
                let killfeedKillerName = this.m_playerBarn.getPlayerName(
                    killfeedKillerInfo.playerId,
                    this.m_activeId,
                    true,
                );
                targetName =
                    this.m_playerBarn.getPlayerNameHtml(
                        targetInfo.playerId,
                        this.m_activeId,
                        true,
                    ) || helpers.htmlEscape(targetName);
                killerName =
                    this.m_playerBarn.getPlayerNameHtml(
                        killerInfo.playerId,
                        this.m_activeId,
                        true,
                    ) || helpers.htmlEscape(killerName);
                killfeedKillerName =
                    this.m_playerBarn.getPlayerNameHtml(
                        killfeedKillerInfo.playerId,
                        this.m_activeId,
                        true,
                    ) || helpers.htmlEscape(killfeedKillerName);
                // Display the kill / downed notification for the active player
                if (msg.killCreditId == this.m_activeId) {
                    const completeKill = msg.killerId == this.m_activeId;
                    const suicide =
                        msg.killerId == msg.targetId || msg.killCreditId == msg.targetId;
                    const killText = this.m_ui2Manager.getKillText(
                        killerName,
                        targetName,
                        completeKill,
                        msg.downed,
                        msg.killed,
                        suicide,
                        sourceType,
                        msg.damageType,
                        this.m_spectating,
                    );
                    const killCountText =
                        msg.killed && !suicide
                            ? this.m_ui2Manager.getKillCountText(msg.killerKills)
                            : "";
                    this.m_ui2Manager.displayKillMessage(killText, killCountText);
                } else if (msg.targetId == this.m_activeId && msg.downed && !msg.killed) {
                    const downedText = this.m_ui2Manager.getDownedText(
                        killerName,
                        targetName,
                        sourceType,
                        msg.damageType,
                        this.m_spectating,
                    );
                    this.m_ui2Manager.displayKillMessage(downedText, "");
                }

                // Update local kill counter
                if (msg.killCreditId == this.m_localId && msg.killed) {
                    this.m_uiManager.setLocalKills(msg.killerKills);
                    discordPresence.updateKills(msg.killerKills);
                }

                if (!this.m_map.getMapDef().gameMode.amongUsMode) {
                    const killText = this.m_ui2Manager.getKillFeedText(
                        targetName,
                        killfeedKillerInfo.teamId ? killfeedKillerName : "",
                        sourceType,
                        msg.damageType,
                        msg.downed && !msg.killed,
                    );
                    const killColor = this.m_ui2Manager.getKillFeedColor(
                        activeTeamId,
                        targetInfo.teamId,
                        killerInfo.teamId,
                        this.m_map.factionMode,
                    );
                    this.m_ui2Manager.addKillFeedMessage(killText, killColor);
                }
                if (msg.killed) {
                    this.m_playerBarn.addDeathEffect(
                        msg.targetId,
                        msg.killerId,
                        this.m_audioManager,
                        this.m_particleBarn,
                        this.m_renderer,
                    );
                }

                // Bullets often don't play hit sounds on the frame that a player dies
                if (msg.damageType == GameConfig.DamageType.Player) {
                    this.m_bulletBarn.createBulletHit(
                        this.m_playerBarn,
                        msg.targetId,
                        this.m_audioManager,
                    );
                }

                break;
            }
            case net.MsgType.RoleAnnouncement: {
                const msg = new net.RoleAnnouncementMsg();
                msg.deserialize(stream);
                const roleDef = RoleDefs[msg.role];
                if (!roleDef) {
                    break;
                }
                const playerInfo = this.m_playerBarn.getPlayerInfo(msg.playerId);
                const nameText =
                    this.m_playerBarn.getPlayerNameHtml(
                        msg.playerId,
                        this.m_activeId,
                        true,
                    ) ||
                    helpers.htmlEscape(
                        this.m_playerBarn.getPlayerName(
                            msg.playerId,
                            this.m_activeId,
                            true,
                        ),
                    );
                if (msg.assigned) {
                    if (roleDef.sound?.assign) {
                        if (
                            msg.role == "kill_leader" &&
                            this.m_map.getMapDef().gameMode.spookyKillSounds
                        ) {
                            // Halloween map has special logic for the kill leader sounds
                            this.m_audioManager.playGroup("kill_leader_assigned", {
                                channel: "ui",
                            });
                        } else if (
                            // The intent here is to not play the role-specific assignment sounds in perkMode unless you're the player selecting a role.
                            msg.role == "kill_leader" ||
                            !this.m_map.perkMode ||
                            this.m_localId == msg.playerId
                        ) {
                            this.m_audioManager.playSound(roleDef.sound.assign, {
                                channel: "ui",
                            });
                        }
                    }
                    if (this.m_map.perkMode && this.m_localId == msg.playerId) {
                        this.m_uiManager.setRoleMenuActive(false);
                    }
                    if (roleDef.killFeed?.assign) {
                        // In addition to playing a sound, display a notification on the killfeed
                        const killText = this.m_ui2Manager.getRoleAssignedKillFeedText(
                            msg.role,
                            playerInfo.teamId,
                            nameText,
                        );
                        const killColor = this.m_ui2Manager.getRoleKillFeedColor(
                            msg.role,
                            playerInfo.teamId,
                            this.m_playerBarn,
                        );
                        this.m_ui2Manager.addKillFeedMessage(killText, killColor);
                    }
                    // Show an announcement if you've been assigned a role
                    if (roleDef.announce && this.m_localId == msg.playerId) {
                        const assignText = this.m_ui2Manager.getRoleAnnouncementText(
                            msg.role,
                            playerInfo.teamId,
                        );
                        this.m_uiManager.displayAnnouncement(assignText.toUpperCase());
                    }
                } else if (msg.killed) {
                    if (roleDef.killFeed?.dead) {
                        let killerName =
                            this.m_playerBarn.getPlayerNameHtml(
                                msg.killerId,
                                this.m_activeId,
                                true,
                            ) ||
                            helpers.htmlEscape(
                                this.m_playerBarn.getPlayerName(
                                    msg.killerId,
                                    this.m_activeId,
                                    true,
                                ),
                            );

                        if (msg.playerId == msg.killerId) {
                            killerName = "";
                        }
                        const killText = this.m_ui2Manager.getRoleKilledKillFeedText(
                            msg.role,
                            playerInfo.teamId,
                            killerName,
                        );
                        const killColor = this.m_ui2Manager.getRoleKillFeedColor(
                            msg.role,
                            playerInfo.teamId,
                            this.m_playerBarn,
                        );
                        this.m_ui2Manager.addKillFeedMessage(killText, killColor);
                    }
                    if (roleDef.sound?.dead) {
                        if (this.m_map.getMapDef().gameMode.spookyKillSounds) {
                            this.m_audioManager.playGroup("kill_leader_dead", {
                                channel: "ui",
                            });
                        } else {
                            this.m_audioManager.playSound(roleDef.sound.dead, {
                                channel: "ui",
                            });
                        }
                    }
                }
                break;
            }
            case net.MsgType.PlayerStats: {
                const msg = new net.PlayerStatsMsg();
                msg.deserialize(stream);
                this.m_uiManager.setLocalStats(msg.playerStats);
                this.m_uiManager.showTeamAd(msg.playerStats, this.m_ui2Manager);
                break;
            }
            case net.MsgType.Stats: {
                stream.readString();
                break;
            }
            case net.MsgType.GameOver: {
                const msg = new net.GameOverMsg();
                msg.deserialize(stream);
                this.m_gameOver = msg.gameOver;

                discordPresence.matchEnd();

                const localTeamId = this.m_playerBarn.getPlayerInfo(
                    this.m_localId,
                ).teamId;

                // Set local stats based on final results.
                // This is necessary because the last person on a team to die
                // will not receive a PlayerStats message, they will only receive
                // the GameOver message.
                for (let j = 0; j < msg.playerStats.length; j++) {
                    const stats = msg.playerStats[j];
                    if (stats.playerId == this.m_localId) {
                        this.m_uiManager.setLocalStats(stats);
                        break;
                    }
                }
                this.m_uiManager.showStats(
                    msg.playerStats,
                    msg.teamId,
                    msg.teamRank,
                    msg.winningTeamId,
                    msg.gameOver,
                    localTeamId,
                    this.teamMode,
                    this.m_spectating,
                    this.m_playerBarn,
                    this.m_audioManager,
                    this.m_map,
                    this.m_ui2Manager,
                );
                if (localTeamId == msg.winningTeamId) {
                    this.victoryMusic = this.m_audioManager.playSound("menu_music", {
                        channel: "music",
                        delay: 1300,
                        forceStart: true,
                    });
                }
                this.m_touch.hideAll();
                break;
            }
            case net.MsgType.Pickup: {
                const msg = new net.PickupMsg();
                msg.deserialize(stream);
                if (msg.type == net.PickupMsgType.Success && msg.item) {
                    this.m_activePlayer.playItemPickupSound(
                        msg.item,
                        this.m_audioManager,
                    );
                    const itemDef = GameObjectDefs[msg.item];
                    if (itemDef && itemDef.type == "xp") {
                        this.m_ui2Manager.addRareLootMessage(msg.item, true);
                    }
                } else {
                    this.m_ui2Manager.displayPickupMessage(msg.type);
                }
                break;
            }
            case net.MsgType.UpdatePass: {
                new net.UpdatePassMsg().deserialize(stream);
                this.m_updatePass = true;
                this.m_updatePassDelay = 0;
                break;
            }
            case net.MsgType.AliveCounts: {
                const msg = new net.AliveCountsMsg();
                msg.deserialize(stream);
                if (msg.teamAliveCounts.length == 1) {
                    this.m_uiManager.updatePlayersAlive(msg.teamAliveCounts[0]);
                } else if (msg.teamAliveCounts.length >= 2) {
                    this.m_uiManager.updatePlayersAliveRed(msg.teamAliveCounts[0]);
                    this.m_uiManager.updatePlayersAliveBlue(msg.teamAliveCounts[1]);
                }
                break;
            }
            case net.MsgType.Disconnect: {
                const msg = new net.DisconnectMsg();
                msg.deserialize(stream);
                this.m_disconnectMsg = msg.reason;
            }
        }
    }

    m_sendMessage(type: net.MsgType, data: net.Msg, maxLen?: number) {
        const bufSz = maxLen || 128;
        const msgStream = new net.MsgStream(new ArrayBuffer(bufSz));
        msgStream.serializeMsg(type, data);
        this.m_sendMessageImpl(msgStream);
    }

    m_sendMessageImpl(msgStream: net.MsgStream) {
        // Separate function call so sendMessage can be optimized;
        // v8 won't optimize functions containing a try/catch
        if (this.m_ws && this.m_ws.readyState == this.m_ws.OPEN) {
            try {
                this.m_ws.send(msgStream.getBuffer());
            } catch (e) {
                console.error("sendMessageException", e);
                this.m_ws.close();
            }
        }
    }
}
