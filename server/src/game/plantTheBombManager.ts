import type { ArenaTeam } from "../../../shared/defs/miniGame";
import { GameConfig } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { ObjectType } from "../../../shared/net/objectSerializeFns";
import { collider } from "../../../shared/utils/collider";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Game } from "./game";
import type { Obstacle } from "./objects/obstacle";
import type { Player } from "./objects/player";
import { getPlantTheBombSettings, isPlantTheBombMiniGame } from "./privateLobbyMiniGames";

type ObjectiveTeamId = 0 | 1 | 2;

export class PlantTheBombManager {
    readonly enabled: boolean;
    readonly settings;
    readonly score: Record<1 | 2, number> = { 1: 0, 2: 0 };

    phase = net.PlantTheBombPhase.Round;
    roundNumber = 1;
    attackerTeamId: 1 | 2 = 1;
    activeSite: 0 | 1 | 2 = 0;
    winningTeamId: ObjectiveTeamId = 0;
    bombState = net.PlantTheBombState.AtSpawn;

    private roundTimeLeft: number;
    private bombTimeLeft: number;
    private roundEndTimeLeft = 0;
    private broadcastTicker = 0;
    private readonly sites: [Vec2, Vec2];
    private readonly siteObjects: Obstacle[] = [];
    private bombObject?: Obstacle;
    private bombCarrier?: Player;
    private bombPos = v2.create(0, 0);

    constructor(readonly game: Game) {
        const def = game.map.mapDef.gameMode.plantTheBomb;
        this.settings = getPlantTheBombSettings(game.miniGame);
        this.enabled = isPlantTheBombMiniGame(game.miniGame) && !!def && !!this.settings;
        this.sites = def
            ? (def.sites.map(v2.copy) as [Vec2, Vec2])
            : [v2.create(0, 0), v2.create(0, 0)];
        this.roundTimeLeft = this.settings?.roundDuration ?? 120;
        this.bombTimeLeft = this.settings?.bombDuration ?? 45;
    }

    init(): void {
        if (!this.enabled) return;
        this.siteObjects.push(
            this.game.map.genObstacle(
                "plant_bomb_site_a",
                this.sites[0],
                0,
                0,
                1,
                undefined,
                "plant_bomb_site_a",
                true,
            ),
            this.game.map.genObstacle(
                "plant_bomb_site_b",
                this.sites[1],
                0,
                0,
                1,
                undefined,
                "plant_bomb_site_b",
                true,
            ),
        );
        this.configureRoundObjectives();
        this.broadcast();
    }

    update(dt: number): void {
        if (!this.enabled || !this.settings || this.game.over || !this.game.started) {
            return;
        }

        if (this.bombCarrier) {
            if (this.bombCarrier.dead || this.bombCarrier.disconnected) {
                this.dropBomb(this.bombCarrier.pos);
            } else {
                v2.set(this.bombPos, this.bombCarrier.pos);
            }
        }

        if (this.phase === net.PlantTheBombPhase.RoundEnd) {
            if (this.isMatchOver()) return;
            this.roundEndTimeLeft = Math.max(0, this.roundEndTimeLeft - dt);
            if (this.roundEndTimeLeft <= 0) this.beginNextRound();
        } else if (this.phase === net.PlantTheBombPhase.Planted) {
            if (!this.hasLivingPlayers(this.getDefenderTeamId())) {
                this.detonateBomb();
            } else {
                this.bombTimeLeft = Math.max(0, this.bombTimeLeft - dt);
                if (this.bombTimeLeft <= 0) this.detonateBomb();
            }
        } else {
            this.roundTimeLeft = Math.max(0, this.roundTimeLeft - dt);
            const attackersAlive = this.hasLivingPlayers(this.attackerTeamId);
            const defendersAlive = this.hasLivingPlayers(this.getDefenderTeamId());
            if (!attackersAlive && !defendersAlive) {
                this.completeRound(0, net.PlantTheBombEvent.RoundDraw);
            } else if (this.roundTimeLeft <= 0) {
                this.completeRound(
                    this.getDefenderTeamId(),
                    net.PlantTheBombEvent.RoundWon,
                );
            } else if (!attackersAlive) {
                this.completeRound(
                    this.getDefenderTeamId(),
                    net.PlantTheBombEvent.RoundWon,
                );
            }
        }

        this.broadcastTicker -= dt;
        if (this.broadcastTicker <= 0) {
            this.broadcast();
            this.broadcastTicker = 0.1;
        }
    }

    handleInteract(obstacle: Obstacle, player: Player): boolean {
        if (!this.enabled) return false;
        const siteIndex = this.siteObjects.indexOf(obstacle);
        const isBomb = obstacle === this.bombObject;
        if (siteIndex < 0 && !isBomb) return false;
        if (
            !this.settings ||
            !this.game.started ||
            this.game.over ||
            player.dead ||
            player.downed ||
            player.disconnected ||
            this.phase === net.PlantTheBombPhase.RoundEnd
        ) {
            return true;
        }

        const teamId = this.getPlayerTeamId(player);
        if (
            isBomb &&
            this.phase === net.PlantTheBombPhase.Round &&
            teamId === this.attackerTeamId &&
            !this.bombCarrier
        ) {
            this.pickUpBomb(player);
        } else if (
            siteIndex >= 0 &&
            this.phase === net.PlantTheBombPhase.Round &&
            teamId === this.attackerTeamId &&
            this.bombCarrier === player
        ) {
            player.doAction(
                "",
                GameConfig.Action.PlantBomb,
                this.settings.plantDuration,
                obstacle.__id,
            );
        } else if (
            isBomb &&
            this.phase === net.PlantTheBombPhase.Planted &&
            teamId === this.getDefenderTeamId()
        ) {
            player.doAction(
                "",
                GameConfig.Action.DefuseBomb,
                this.settings.defuseDuration,
                obstacle.__id,
            );
        }
        return true;
    }

    completeAction(player: Player, actionType: number, targetId: number): void {
        if (!this.enabled || !this.settings || player.dead || player.downed) return;
        const target = this.game.objectRegister.getById(targetId);
        if (!target || target.__type !== ObjectType.Obstacle) return;
        const obstacle = target as Obstacle;
        if (
            !collider.intersectCircle(
                obstacle.collider,
                player.pos,
                obstacle.interactionRad + player.rad,
            )
        ) {
            return;
        }

        const teamId = this.getPlayerTeamId(player);
        const siteIndex = this.siteObjects.indexOf(obstacle);
        if (
            actionType === GameConfig.Action.PlantBomb &&
            this.phase === net.PlantTheBombPhase.Round &&
            teamId === this.attackerTeamId &&
            this.bombCarrier === player &&
            siteIndex >= 0
        ) {
            this.plantBomb(player, (siteIndex + 1) as 1 | 2);
        } else if (
            actionType === GameConfig.Action.DefuseBomb &&
            this.phase === net.PlantTheBombPhase.Planted &&
            teamId === this.getDefenderTeamId() &&
            obstacle === this.bombObject
        ) {
            this.completeRound(
                this.getDefenderTeamId(),
                net.PlantTheBombEvent.Defused,
                player.__id,
            );
        }
    }

    onPlayerDeath(player: Player): void {
        if (player === this.bombCarrier) this.dropBomb(player.pos);
    }

    getSpawnPos(arenaTeam: ArenaTeam | undefined, teamId?: number): Vec2 | undefined {
        if (!this.enabled) return undefined;
        const def = this.game.map.mapDef.gameMode.plantTheBomb;
        const team = arenaTeam ?? (teamId === 1 ? "A" : teamId === 2 ? "B" : undefined);
        const center =
            team === "A" ? def?.redSpawn : team === "B" ? def?.blueSpawn : undefined;
        if (!center) return undefined;
        const radius = def?.spawnRadius ?? 6;
        return v2.add(center, v2.mul(v2.randomUnit(), Math.random() * radius));
    }

    isMatchOver(): boolean {
        return (
            !!this.settings &&
            this.phase === net.PlantTheBombPhase.RoundEnd &&
            this.roundNumber >= this.settings.totalRounds
        );
    }

    getWinningTeamId(): ObjectiveTeamId {
        if (!this.isMatchOver() || this.score[1] === this.score[2]) return 0;
        return this.score[1] > this.score[2] ? 1 : 2;
    }

    getAttackerForRound(round: number): 1 | 2 {
        return round <= (this.settings?.attackRoundsPerTeam ?? 5) ? 1 : 2;
    }

    endWithWinner(winningTeamId: number): true {
        for (const player of this.game.playerBarn.players) {
            player.addGameOverMsg(winningTeamId, { gameOver: true });
        }
        return true;
    }

    private pickUpBomb(player: Player): void {
        this.bombCarrier = player;
        this.bombState = net.PlantTheBombState.Carried;
        v2.set(this.bombPos, player.pos);
        this.removeBombObject();
        player.promoteToRole("plant_bomb_carrier");
        this.broadcast(net.PlantTheBombEvent.PickedUp, player.__id);
    }

    private dropBomb(pos: Vec2): void {
        const carrier = this.bombCarrier;
        const carrierId = carrier?.__id ?? 0;
        if (carrier?.role === "plant_bomb_carrier") carrier.removeRole();
        this.bombCarrier = undefined;
        this.bombState = net.PlantTheBombState.Dropped;
        v2.set(this.bombPos, pos);
        this.spawnBombObject("plant_bomb_pickup", this.bombPos);
        this.broadcast(net.PlantTheBombEvent.Dropped, carrierId);
    }

    private plantBomb(player: Player, site: 1 | 2): void {
        if (player.role === "plant_bomb_carrier") player.removeRole();
        this.bombCarrier = undefined;
        this.phase = net.PlantTheBombPhase.Planted;
        this.bombState = net.PlantTheBombState.Planted;
        this.activeSite = site;
        this.bombTimeLeft = this.settings?.bombDuration ?? 45;
        v2.set(this.bombPos, this.sites[this.activeSite - 1]);
        this.spawnBombObject("plant_bomb_device", this.bombPos);
        for (const site of this.siteObjects) {
            site.button.canUse = false;
            site.button.seq++;
            site.setDirty();
        }
        this.broadcast(net.PlantTheBombEvent.Planted, player.__id);
    }

    private detonateBomb(): void {
        if (this.phase !== net.PlantTheBombPhase.Planted) return;
        this.bombTimeLeft = 0;
        this.game.explosionBarn.addVisualExplosion("explosion_barrel", this.bombPos, 0);
        this.completeRound(this.attackerTeamId, net.PlantTheBombEvent.Detonated);
    }

    private completeRound(
        teamId: ObjectiveTeamId,
        event: net.PlantTheBombEvent,
        actorPlayerId = 0,
    ): void {
        if (this.phase === net.PlantTheBombPhase.RoundEnd) return;
        if (teamId !== 0) this.score[teamId]++;
        this.winningTeamId = teamId;
        this.phase = net.PlantTheBombPhase.RoundEnd;
        this.roundEndTimeLeft = this.settings?.roundEndDelay ?? 5;
        if (this.bombCarrier?.role === "plant_bomb_carrier") {
            this.bombCarrier.removeRole();
        }
        this.bombCarrier = undefined;
        this.removeBombObject();
        for (const player of this.game.playerBarn.players) {
            if (
                player.actionType === GameConfig.Action.PlantBomb ||
                player.actionType === GameConfig.Action.DefuseBomb
            ) {
                player.cancelAction();
            }
        }
        this.broadcast(event, actorPlayerId);
        this.game.playerBarn.aliveCountDirty = true;
        this.game.checkGameOver();
    }

    private beginNextRound(): void {
        this.roundNumber++;
        this.attackerTeamId = this.getAttackerForRound(this.roundNumber);
        this.activeSite = 0;
        this.phase = net.PlantTheBombPhase.Round;
        this.winningTeamId = 0;
        this.roundTimeLeft = this.settings?.roundDuration ?? 120;
        this.bombTimeLeft = this.settings?.bombDuration ?? 45;
        for (const player of this.game.playerBarn.players) {
            if (player.disconnected || player.spectatorOnly) continue;
            player.resetPlantTheBombRound();
        }
        this.configureRoundObjectives();
        this.broadcast();
    }

    private configureRoundObjectives(): void {
        if (this.bombCarrier?.role === "plant_bomb_carrier") {
            this.bombCarrier.removeRole();
        }
        for (let i = 0; i < this.siteObjects.length; i++) {
            const site = this.siteObjects[i];
            site.button.canUse = true;
            site.button.onOff = false;
            site.button.seq++;
            site.setDirty();
        }
        this.bombCarrier = undefined;
        this.bombState = net.PlantTheBombState.AtSpawn;
        v2.set(this.bombPos, this.getBombSpawnPos());
        this.spawnBombObject("plant_bomb_pickup", this.bombPos);
    }

    private spawnBombObject(type: "plant_bomb_pickup" | "plant_bomb_device", pos: Vec2) {
        this.removeBombObject();
        this.bombObject = this.game.map.genObstacle(
            type,
            pos,
            0,
            0,
            1,
            undefined,
            type,
            false,
        );
    }

    private removeBombObject(): void {
        if (!this.bombObject || this.bombObject.destroyed) return;
        this.bombObject.destroy();
        this.bombObject = undefined;
    }

    private getBombSpawnPos(): Vec2 {
        const def = this.game.map.mapDef.gameMode.plantTheBomb;
        const spawn = this.attackerTeamId === 1 ? def?.redSpawn : def?.blueSpawn;
        if (!spawn) return v2.copy(this.game.map.center);
        const offset = this.attackerTeamId === 1 ? v2.create(-7, 0) : v2.create(7, 0);
        return v2.add(spawn, offset);
    }

    private getDefenderTeamId(): 1 | 2 {
        return this.attackerTeamId === 1 ? 2 : 1;
    }

    private getPlayerTeamId(player: Player): ObjectiveTeamId {
        if (player.arenaTeam === "A" || (!player.arenaTeam && player.teamId === 1)) {
            return 1;
        }
        if (player.arenaTeam === "B" || (!player.arenaTeam && player.teamId === 2)) {
            return 2;
        }
        return 0;
    }

    private hasLivingPlayers(teamId: 1 | 2): boolean {
        return this.game.playerBarn.livingPlayers.some(
            (player) =>
                !player.dead &&
                !player.disconnected &&
                !player.spectatorOnly &&
                this.getPlayerTeamId(player) === teamId,
        );
    }

    private broadcast(event = net.PlantTheBombEvent.None, actorPlayerId = 0): void {
        const msg = new net.PlantTheBombMsg();
        msg.redScore = this.score[1];
        msg.blueScore = this.score[2];
        msg.totalRounds = this.settings?.totalRounds ?? 10;
        msg.roundNumber = this.roundNumber;
        msg.attackerTeamId = this.attackerTeamId;
        msg.phase = this.phase;
        msg.roundTimeLeft =
            this.phase === net.PlantTheBombPhase.RoundEnd
                ? this.roundEndTimeLeft
                : this.roundTimeLeft;
        msg.bombTimeLeft = this.bombTimeLeft;
        msg.activeSite = this.activeSite;
        msg.bombState = this.bombState;
        msg.bombPos = v2.copy(this.bombPos);
        msg.bombCarrierId = this.bombCarrier?.__id ?? 0;
        msg.winningTeamId = this.winningTeamId;
        msg.event = event;
        msg.actorPlayerId = actorPlayerId;
        msg.sites = this.sites.map(v2.copy) as [Vec2, Vec2];
        this.game.broadcastMsg(net.MsgType.PlantTheBomb, msg);
    }
}
