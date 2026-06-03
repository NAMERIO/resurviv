import { GameConfig, GasMode } from "../../../../shared/gameConfig";
import { math } from "../../../../shared/utils/math";
import { util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import { BattleRoyaleGasStages, isBattleRoyaleMapName } from "../../battleroyale/helpers";
import type { Game } from "../game";
import {
    getHideAndSeekSettings,
    getInfectedSettings,
    isInfectedZombie,
} from "../privateLobbyMiniGames";

interface StageData {
    mode: GasMode;
    duration: number;
    rad: number;
    damage: number;
}

const GAME_TIME_IN_MINUTES = 6;

const GasStages: StageData[] = [
    {
        mode: GasMode.Inactive,
        duration: 0,
        rad: 0.7425,
        damage: 0,
    },
    {
        mode: GasMode.Waiting,
        duration: GAME_TIME_IN_MINUTES * 60,
        rad: 0.7425,
        damage: 20,
    },
    {
        mode: GasMode.Moving,
        duration: 53,
        rad: 0.086625,
        damage: 55,
    },
    {
        mode: GasMode.Waiting,
        duration: 20,
        rad: 0.086625,
        damage: 55,
    },
    {
        mode: GasMode.Moving,
        duration: 7,
        rad: 0,
        damage: 55,
    },
];

export class Gas {
    private battleRoyaleJoinClosed = false;
    /**
     * Current gas mode
     * Inactive: The gas is not active, used when only a single player is on the lobby
     * Waiting: The Gas has started and is waiting to advance to the next stage
     * Moving: The gas is moving between one stage and another
     */
    mode = GasMode.Inactive;

    /**
     * Current gas stage used to track the gas damage from `GameConfig.gas.damage`
     * Is incremented when gas mode changes
     */
    stage = 0;

    /**
     * Like stage but is incremented after gas goes through Waiting and Moving mode's
     */
    circleIdx = -1;

    /**
     * Current gas stage damage
     */
    damage: number;

    /**
     * Current gas duration
     * returns 0 if gas if inactive
     */
    duration: number;

    /**
     * Old gas radius
     * When gas mode is waiting this will be the same as `currentRad`
     * When gas mode is moving this will be the radius from the previous state
     * And will be used for lerping `currentRad`
     */
    radOld: number;
    /**
     * New gas radius
     * When gas mode is waiting this will be the radius for the new stage
     * When gas mode is moving this will be the radius at the end of the stage
     */
    radNew: number;
    /**
     * Current gas radius
     * When gas mode is waiting this and `radOld` will be the same
     * When gas mode is moving this will be a lerp between `radOld` and `radNew` using `gasT` as the interpolation factor
     */
    currentRad: number;

    /**
     * Old gas position
     * When gas mode is waiting this will be the same as `currentPos`
     * When gas mode is moving this will be the position from the previous state
     * And will be used for lerping `currentPos`
     */
    posOld: Vec2;
    /**
     * New gas position
     * When gas mode is waiting this will be the position for the new stage
     * When gas mode is moving this will be the position at the end of the stage
     */
    posNew: Vec2;
    /**
     * Current gas position
     * When gas mode is waiting this and `posOld` will be the same
     * When gas mode is moving this will be a lerp between `posOld` and `posNew` using `gasT` as the interpolation factor
     */
    currentPos: Vec2;

    /**
     * Gas Timer
     * in a range between 0 and 1
     */
    gasT = 0;

    /**
     * Current duration ticker
     */
    private _gasTicker = 0;

    /**
     * If the gas full state needs to be sent to clients
     */
    dirty = true;
    /**
     * If the gas time needs to be sent to clients
     */
    timeDirty = true;

    private _damageTicker = 0;
    private _running = false;

    doDamage = false;
    disabled = false;

    mapSize: number;

    constructor(readonly game: Game) {
        const map = game.map;
        this.disabled = !!map.mapDef.gameMode.disableGas;
        this.mapSize = (map.width + map.height) / 2;
        this.posOld = v2.create(map.width / 2, map.height / 2);
        this.posNew = v2.copy(this.posOld);
        this.currentPos = v2.copy(this.posOld);

        const stage = this._getStageData();
        this.radOld = 0.85 * this.mapSize;
        this.radNew = this.currentRad = stage.rad * this.mapSize;
        this.duration = stage.duration;
        this.damage = stage.damage;

        if (this.disabled) {
            this.mode = GasMode.Inactive;
            this.stage = 0;
            this.circleIdx = -1;
            this.radOld = this.radNew = this.currentRad = this.mapSize * 2;
            this.duration = 0;
            this.damage = 0;
            this.gasT = 0;
        }
    }

    update(dt: number) {
        if (this.disabled) {
            this.doDamage = false;
            this.dirty = false;
            this.timeDirty = false;
            return;
        }

        this._gasTicker += dt;

        if (this._running) {
            this.gasT = math.clamp(this._gasTicker / this.duration, 0, 1);
            this.timeDirty = true;

            if (this.mode === GasMode.Moving) {
                this.currentPos = v2.lerp(this.gasT, this.posOld, this.posNew);
                this.currentRad = math.lerp(this.gasT, this.radOld, this.radNew);
            }

            if (this.gasT >= 1) {
                this.advanceGasStage();
            }
        }

        this.doDamage = false;
        this._damageTicker += dt;

        if (this._damageTicker >= GameConfig.gas.damageTickRate) {
            this._damageTicker = 0;
            this.doDamage = true;
        }
    }

    advanceGasStage() {
        if (this.disabled) {
            this.mode = GasMode.Inactive;
            this._running = false;
            this.doDamage = false;
            this.dirty = true;
            this.timeDirty = true;
            return;
        }

        this.stage++;
        this._running = true;

        const stage = this._getStageData();

        if (!stage) {
            this._running = false;
            return;
        }

        this.mode = stage.mode;
        if (
            isBattleRoyaleMapName(this.game.mapName) &&
            this.mode === GasMode.Moving &&
            !this.battleRoyaleJoinClosed
        ) {
            this.battleRoyaleJoinClosed = true;
            this.game.battleRoyaleJoinClosed = true;
        }
        this.radOld = this.currentRad;
        this.radNew = stage.rad * this.mapSize;
        this.duration = stage.duration;
        this.damage = stage.damage;

        const circleIdxOld = this.circleIdx;

        if (this.mode === GasMode.Waiting) {
            this.posOld = v2.copy(this.posNew);

            this.posNew = v2.add(
                this.posNew,
                util.randomPointInCircle(this.radOld - this.radNew),
            );

            const rad = this.radNew * 0.75; // ensure at least 75% of the safe zone will be inside map bounds
            this.posNew = math.v2Clamp(
                this.posNew,
                v2.create(rad, rad),
                v2.create(this.game.map.width - rad, this.game.map.height - rad),
            );

            this.currentPos = this.posOld;
            this.currentRad = this.radOld;
            this.circleIdx++;
        }

        if (this.circleIdx !== circleIdxOld) {
            if (this.game.map.mapDef.gameConfig.roles) {
                this.game.playerBarn.scheduleRoleAssignments();
            }

            if (this.game.map.mapDef.gameConfig.unlocks) {
                this.game.map.scheduleUnlocks();
            }

            for (const plane of this.game.map.mapDef.gameConfig.planes.timings) {
                if (plane.circleIdx === this.circleIdx) {
                    this.game.planeBarn.schedulePlane(plane.wait, plane.options);
                }
            }
        }

        const infectedSettings = getInfectedSettings(this.game.miniGame);
        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        if (
            infectedSettings &&
            this.mode === GasMode.Moving &&
            stage.rad <= 0 &&
            !this.game.infectedHumansWon
        ) {
            this.game.infectedHumansWon = true;
            for (const player of [...this.game.playerBarn.players]) {
                if (
                    !player.dead &&
                    isInfectedZombie(this.game.miniGame, player.arenaTeam)
                ) {
                    player.kill({
                        amount: player.health,
                        damageType: GameConfig.DamageType.Gas,
                        dir: player.dir,
                    });
                }
            }
            this.game.checkGameOver();
        }
        if (
            hideAndSeekSettings &&
            this.mode === GasMode.Moving &&
            stage.rad <= 0 &&
            !this.game.hideAndSeekHidersWon
        ) {
            this.game.hideAndSeekHidersWon = true;
            this.game.checkGameOver();
        }

        this._gasTicker = 0;
        this.gasT = 0;
        this.dirty = true;
        this.timeDirty = true;

        this.game.updateData();
    }

    private _getStageData() {
        return this._getStages()[this.stage];
    }

    private _getStages() {
        return isBattleRoyaleMapName(this.game.mapName)
            ? BattleRoyaleGasStages
            : GasStages;
    }

    get finalCloseStarted() {
        const stages = this._getStages();
        return (
            !isBattleRoyaleMapName(this.game.mapName) &&
            this.stage >= stages.length - 1 &&
            this.mode === GasMode.Moving
        );
    }

    getTimeUntilNextStage() {
        return Math.max(0, this.duration - this._gasTicker);
    }

    isInGas(pos: Vec2) {
        if (this.disabled) return false;
        return v2.distance(pos, this.currentPos) >= this.currentRad;
    }

    isOutSideSafeZone(pos: Vec2) {
        if (this.disabled) return false;
        return v2.distance(pos, this.posNew) >= this.radNew;
    }

    flush() {
        this.dirty = false;
        this.timeDirty = false;
    }
}
