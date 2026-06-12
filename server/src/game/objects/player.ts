import { randomUUID } from "node:crypto";
import { generateUsername } from "unique-username-generator";
import type { AmongUsRole } from "../../../../shared/defs/amongUsRoleDefs";
import {
    GameObjectDefs,
    type LootDef,
    WeaponTypeToDefs,
} from "../../../../shared/defs/gameObjectDefs";
import {
    DamageStreakDefs,
    DamageStreakProperties,
    DefaultStreakType,
    StreakThresholds,
} from "../../../../shared/defs/gameObjects/damageStreakDefs";
import { type EmoteDef, EmotesDefs } from "../../../../shared/defs/gameObjects/emoteDefs";
import {
    type BackpackDef,
    type BoostDef,
    type ChestDef,
    GEAR_TYPES,
    type HealDef,
    type HelmetDef,
    SCOPE_LEVELS,
} from "../../../../shared/defs/gameObjects/gearDefs";
import type { GunDef } from "../../../../shared/defs/gameObjects/gunDefs";
import type { MeleeDef } from "../../../../shared/defs/gameObjects/meleeDefs";
import type { OutfitDef } from "../../../../shared/defs/gameObjects/outfitDefs";
import { PerkProperties } from "../../../../shared/defs/gameObjects/perkDefs";
import type { RoleDef } from "../../../../shared/defs/gameObjects/roleDefs";
import {
    type ThrowableDef,
    ThrowableDefs,
} from "../../../../shared/defs/gameObjects/throwableDefs";
import { UnlockDefs } from "../../../../shared/defs/gameObjects/unlockDefs";
import { MapObjectDefs } from "../../../../shared/defs/mapObjectDefs";
import type { ObstacleDef, StructureDef } from "../../../../shared/defs/mapObjectsTyping";
import { MapId } from "../../../../shared/defs/types/misc";
import {
    type Action,
    type Anim,
    EmoteSlot,
    GameConfig,
    GasMode,
    type HasteType,
    type Input,
    type InventoryItem,
} from "../../../../shared/gameConfig";
import * as net from "../../../../shared/net/net";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import type { GroupStatus, PlayerInfo } from "../../../../shared/net/updateMsg";
import { type Circle, coldet } from "../../../../shared/utils/coldet";
import { collider } from "../../../../shared/utils/collider";
import type { Loadout } from "../../../../shared/utils/loadout";
import { math } from "../../../../shared/utils/math";
import { assert, util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import type { IpLogsTableInsert } from "../../api/db/schema";
import { hashIp } from "../../api/routes/private/ModerationRouter";
import {
    BattleRoyaleDefaultItems,
    isBattleRoyaleMapName,
} from "../../battleroyale/helpers";
import { Config } from "../../config";
import { isItemInLoadout, onPlayerJoin, onPlayerKill } from "../../plugins/deathmatch";
import { IDAllocator } from "../../utils/IDAllocator";
import { logIpToDiscord } from "../../utils/ipLogging";
import { validateUserName } from "../../utils/serverHelpers";
import type { Game, JoinTokenData } from "../game";
import { Group, Team } from "../group";
import { InventoryManager } from "../inventoryManager";
import {
    getHideAndSeekSettings,
    getInfectedSettings,
    getPrivateLobbyMiniGameWeaponOverride,
    isAmongUsMiniGame,
    isHideAndSeekHider,
    isHideAndSeekSeeker,
    isInfectedHuman,
    isInfectedZombie,
} from "../privateLobbyMiniGames";
import { QuestManager } from "../questManager";
import { WeaponManager } from "../weaponManager";
import type { Building } from "./building";
import type { DeadBody } from "./deadBody";
import type { Decal } from "./decal";
import { BaseGameObject, type DamageParams, type GameObject } from "./gameObject";
import type { Loot } from "./loot";
import type { MapIndicator } from "./mapIndicator";
import type { Obstacle } from "./obstacle";
import type { Smoke } from "./smoke";

function generateTempUsername() {
    return generateUsername("-", 0, net.Constants.PlayerNameMaxLen, "random");
}

type MoveObjsMode = {
    enabled: boolean;
    selectedObj?: Loot | Obstacle | Building;
    originalPos?: Vec2;
    selectPos?: Vec2;
};

interface Emote {
    playerId: number;
    pos: Vec2;
    type: string;
    isPing: boolean;
    targetArenaTeam?: "A" | "B";
    targetArenaTeams?: Array<"A" | "B">;
    /**
     * if type is "emote_loot", typestring of item goes here
     * "m870", "mosin", "1xscope", "762mm", etc
     */
    itemType: string;
}

const boostHeals: Array<{ maxBoost: number; heal: number }> = [];
const amongUsInitialKillCooldown = 20;
const amongUsEmergencyCallCooldown = 15;
{
    const boostBreakPoints = GameConfig.player.boostBreakpoints;
    const max = GameConfig.player.boostBreakpoints.reduce((a, b) => a + b, 0);

    for (let i = 0, boost = 0; i < boostBreakPoints.length; i++) {
        boost += (boostBreakPoints[i] / max) * 100;
        boostHeals.push({
            maxBoost: boost,
            heal: GameConfig.player.boostHealAmounts[i],
        });
    }
}

export class PlayerBarn {
    players: Player[] = [];
    matchPlayers: Player[] = [];
    livingPlayers: Player[] = [];
    newPlayers: Player[] = [];
    dirtyPlayerInfos: Player[] = [];
    deletedPlayers: number[] = [];
    killedPlayers: Player[] = [];
    groupIdAllocator = new IDAllocator(8);
    aliveCountDirty = false;

    socketIdToPlayer = new Map<string, Player>();

    emotes: Emote[] = [];

    killLeaderDirty = false;
    killLeader?: Player;

    aoeHealPlayers: Player[] = [];

    scheduledRoles: Array<{
        role: string;
        time: number;
    }> = [];

    amongUsRolesAssigned = false;
    amongUsEmergencyMeetingSeq = 0;
    amongUsMeeting?: {
        sequence: number;
        phase: net.AmongUsMeetingPhase;
        timeLeft: number;
        reason: net.AmongUsMeetingReason;
        callerId: number;
        participantIds: number[];
        votes: Map<number, number>;
        ejectedId: number;
        ejectedWasImpostor: boolean;
        ejectionExploded: boolean;
        emergencyButton?: Obstacle;
    };

    sendWinEmoteTicker = 0;
    sentWinEmotes = false;

    teams: Team[] = [];
    groups: Group[] = [];
    groupsByHash = new Map<string, Group>();

    playerStatusTicker = 0;
    playerStatusRate = 0;

    defaultItems = util.mergeDeep(
        {},
        GameConfig.player.defaultItems,
        Config.defaultItems,
    );

    bagSizes: (typeof GameConfig)["bagSizes"];

    nextMatchDataId = 1;

    nextKilledNumber = 0;

    constructor(readonly game: Game) {
        this.bagSizes = util.mergeDeep(
            {},
            GameConfig.bagSizes,
            this.game.map.mapDef.gameConfig.bagSizes,
        );

        this.playerStatusRate = net.getPlayerStatusUpdateRate(
            this.game.map.factionMode,
            this.game.map.amongUsMode,
        );
    }

    randomPlayer(player?: Player) {
        const livingPlayers = player
            ? this.livingPlayers.filter((p) => p != player)
            : this.livingPlayers;
        return livingPlayers[util.randomInt(0, livingPlayers.length - 1)];
    }

    addPlayer(socketId: string, joinMsg: net.JoinMsg, ip: string) {
        const joinData = this.game.joinTokens.get(joinMsg.matchPriv);

        if (!joinData) {
            this.game.logger.info(`No join data.`);
            return;
        }

        // if (!joinData || joinData.expiresAt < Date.now()) {
        //     this.game.closeSocket(socketId);
        //     if (joinData) {
        //         this.game.joinTokens.delete(joinMsg.matchPriv);
        //     }
        //     return;
        // }
        // this.game.joinTokens.delete(joinMsg.matchPriv);

        if (Config.rateLimitsEnabled) {
            const count = this.livingPlayers.filter(
                (p) =>
                    p.ip === ip ||
                    p.findGameIp == joinData.findGameIp ||
                    (joinData.userId !== null && p.userId === joinData.userId),
            );
            if (count.length >= 3) {
                if (this.game.joinSpamRateLimit.isRateLimited(ip)) {
                    void this.game.autoBanIpForJoinSpam(ip);
                }
                this.game.closeSocket(socketId, "rate_limited");
                return;
            }
        }

        const result = this.getGroupAndTeam(joinData);
        const group = result?.group;
        // solo 50v50 just chooses the smallest team everytime no matter what
        const team =
            this.game.map.factionMode && !this.game.isTeamMode
                ? this.getSmallestTeam()
                : result?.team;

        let pos: Vec2;
        let layer: number;
        if (this.game.map.perkMode && this.game.map.perkModeTwinsBunker) {
            // intermediate spawn point while the player chooses a role before theyre moved to their real spawn point
            const spawnBuilding = this.game.map.perkModeTwinsBunker;
            pos = spawnBuilding.pos;
            layer = spawnBuilding.layer;
        } else {
            pos = this.game.map.getSpawnPos(group, team);
            if (group && !group.spawnPosition) {
                group.spawnPosition = v2.copy(pos);
            }
            layer = 0;
        }

        const originalName = validateUserName(joinMsg.name).validName;
        let finalName = originalName;

        if (Config.uniqueInGameNames) {
            const loggedOutPlayers = this.game.playerBarn.players;
            while (loggedOutPlayers.find((p) => p.name === finalName)) {
                finalName = generateTempUsername();
            }
        }

        const player = new Player(
            this.game,
            pos,
            layer,
            finalName,
            socketId,
            joinMsg,
            ip,
            joinData.findGameIp,
            joinData.userId,
            joinData.clanName,
            joinData.clanTagColor,
            joinData.canUseDeveloper,
            joinData.loadout,
            joinData.arenaTeam,
            joinData.quests,
        );

        this.socketIdToPlayer.set(socketId, player);

        this.activatePlayer(player, group, team);
        if (joinData.spectator) {
            // Arena lobby spectators should join the match as viewers only.
            player.spectatorOnly = true;
            player.dead = true;
            player.health = 0;
            util.removeFrom(this.livingPlayers, player);
            if (player.group) {
                player.group.checkPlayers();
            }
            if (player.team) {
                player.team.checkPlayers();
            }
            this.aliveCountDirty = true;
            if (this.livingPlayers.length > 0) {
                player.spectating = this.randomPlayer(player);
            }
        }

        return player;
    }

    activatePlayer(player: Player, group?: Group, team?: Team) {
        if (team && group) {
            team.addPlayer(player);
            group.addPlayer(player);
            player.setGroupStatuses();
        } else if (!team && group) {
            group.addPlayer(player);
            player.teamId = player.groupId;
            player.setGroupStatuses();
        } else if (team && !group) {
            team.addPlayer(player);
            player.groupId = this.groupIdAllocator.getNextId();
        } else {
            player.groupId = player.teamId = this.groupIdAllocator.getNextId();
        }

        if (player.game.map.perkMode) {
            /*
             * +5 because the client has its own timer
             * this timer is only a safety net in case a player modifies the client code
             * if this timer reaches 0, we know for a fact the client timer didn't end when it should've
             */
            player.roleMenuTicker = GameConfig.player.perkModeRoleSelectDuration + 5;
        }

        this.game.logger.info(`Player ${player.name} joined`);

        this.newPlayers.push(player);
        this.game.objectRegister.register(player);
        this.players.push(player);
        this.matchPlayers.push(player);
        this.livingPlayers.push(player);
        if (this.game.arenaPrivate && this.players.length === 1) {
            this.game.arenaStartLockTimer = 0;
            this.game.arenaLastCountdownSecond = -1;
            this.game.arenaGoBroadcasted = false;
        }
        if (!this.game.modeManager.isSolo) {
            this.livingPlayers.sort((a, b) => a.teamId - b.teamId);
        }
        if (this.game.map.amongUsMode && this.amongUsRolesAssigned) {
            player.amongUsRole = "crewmate";
            player.markPlayerInfoDirty();
        }
        this.aliveCountDirty = true;
        // this.game.pluginManager.emit("playerJoin", player);
        onPlayerJoin(player);

        // update leaderboard entry
        const leaderboardKey = player.getLeaderboardKey();
        const data = this.game.leaderboard.get(leaderboardKey) ?? {
            name: player.name,
            kills: 0,
        };
        if (!isBattleRoyaleMapName(this.game.mapName)) {
            player.kills = data.kills;
        }
        this.game.leaderboard.set(leaderboardKey, { ...data, name: player.name });

        this.game.updateData();
    }

    testPlayerCount = 0;
    addTestPlayer(params: {
        group?: Group;
        team?: Team;
        pos?: Vec2;
        name?: string;
    }): Player {
        let group = params.group;
        let team = params.team;

        if (!group && this.game.isTeamMode) {
            group = this.addGroup(false);
        }

        if (!team && this.game.map.factionMode) {
            team = this.getSmallestTeam();
        }

        const socketId = randomUUID();

        const player = new Player(
            this.game,
            params.pos ?? v2.create(this.game.map.width / 2, this.game.map.height / 2),
            0,
            params.name ?? `TEST-${this.testPlayerCount++}`,
            socketId,
            new net.JoinMsg(),
            "",
            "",
            null,
            null,
            null,
        );

        this.activatePlayer(player, group, team);

        return player;
    }

    update(dt: number) {
        this.assignAmongUsRoles();
        this.updateAmongUsMeeting(dt);

        let sendWinEmotes = false;
        if (this.game.over && !this.sentWinEmotes) {
            this.sendWinEmoteTicker -= dt;
            if (this.sendWinEmoteTicker <= 0) {
                sendWinEmotes = true;
                this.sentWinEmotes = true;
            }
        }

        if (this.game.isTeamMode || this.game.map.factionMode) {
            this.playerStatusTicker += dt;
        }

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            player.update(dt);

            if (!player.dead && sendWinEmotes) {
                player.emoteFromSlot(EmoteSlot.Win);
            }
        }
        this.updateAmongUsSecurityCameraState();

        // doing this after updates ensures that gameover msgs sent are always accurate
        // if this was done in netsync, players could die while waiting for the next netsync call
        // then the gameover msgs would be inaccurate since theyre based on the current alive count
        if (!this.game.over) {
            for (let i = 0; i < this.killedPlayers.length; i++) {
                this.killedPlayers[i].addGameOverMsg();
            }
        }
        this.killedPlayers.length = 0;

        // update scheduled roles
        for (let i = this.scheduledRoles.length - 1; i >= 0; i--) {
            const scheduledRole = this.scheduledRoles[i];
            scheduledRole.time -= dt;
            if (scheduledRole.time <= 0) {
                this.scheduledRoles.splice(i, 1);

                const fullAliveContext = this.game.modeManager.getAlivePlayersContext();
                for (let i = 0; i < fullAliveContext.length; i++) {
                    const promotablePlayers = fullAliveContext[i].filter(
                        (p) => !p.disconnected && !p.downed && !p.role,
                    );
                    if (promotablePlayers.length == 0) continue;

                    const randomPlayer =
                        promotablePlayers[
                            util.randomInt(0, promotablePlayers.length - 1)
                        ];
                    randomPlayer.promoteToRole(scheduledRole.role);
                }
            }
        }
    }

    updateAmongUsSecurityCameraState() {
        if (!this.game.map.amongUsMode) return;

        const active = this.players.some(
            (player) => player.amongUsCamerasOpen && !player.dead && !player.disconnected,
        );

        for (const building of this.game.map.buildings) {
            if (building.type !== "cafetria_01") continue;

            for (const obj of building.childObjects) {
                if (
                    obj.__type !== ObjectType.Obstacle ||
                    obj.type !== "among_us_security_camera" ||
                    !obj.isButton ||
                    obj.button.onOff === active
                ) {
                    continue;
                }

                obj.button.onOff = active;
                obj.button.seq++;
                obj.setDirty();
            }
        }
    }

    assignAmongUsRoles() {
        if (this.amongUsRolesAssigned) return;
        if (!this.game.map.amongUsMode) return;

        const players = this.livingPlayers.filter(
            (p) => !p.disconnected && !p.dead && !p.spectatorOnly,
        );
        if (players.length < 3) return;
        const impostorCount = math.min(
            this.game.amongUsImpostorCount,
            players.length - 1,
        );
        if (players.length < impostorCount * 2 + 1) return;

        util.shuffleArray(players);
        const impostors = new Set(players.slice(0, impostorCount));
        for (const player of players) {
            player.amongUsRole = impostors.has(player) ? "impostor" : "crewmate";
            if (player.amongUsRole === "impostor") {
                player.resetAmongUsKillCooldown();
            }
            player.markPlayerInfoDirty();
        }
        this.amongUsRolesAssigned = true;
    }

    callAmongUsEmergencyMeeting(caller: Player, emergencyButton?: Obstacle): boolean {
        if (
            caller.amongUsEmergencyCallCooldownTime > 0 ||
            caller.amongUsEmergencyCallsRemaining <= 0
        ) {
            return false;
        }

        return this.startAmongUsMeeting(caller, {
            emergencyButton,
            consumeEmergencyCall: true,
        });
    }

    reportAmongUsDeadBody(caller: Player, deadBody: DeadBody): boolean {
        if (!deadBody || deadBody.destroyed) return false;
        return this.startAmongUsMeeting(caller);
    }

    private startAmongUsMeeting(
        caller: Player,
        opts: {
            emergencyButton?: Obstacle;
            consumeEmergencyCall?: boolean;
        } = {},
    ): boolean {
        if (
            !this.game.map.amongUsMode ||
            caller.dead ||
            caller.downed ||
            caller.disconnected ||
            caller.spectatorOnly ||
            this.game.over ||
            this.amongUsMeeting
        ) {
            return false;
        }

        const spawnOffsets = this.game.map.mapDef.gameMode.amongUsSpawnOffsets;
        if (!spawnOffsets?.length) return false;

        const attendees = this.livingPlayers.filter(
            (player) => !player.dead && !player.disconnected && !player.spectatorOnly,
        );
        if (attendees.length === 0) return false;
        for (let i = 0; i < attendees.length; i++) {
            attendees[i].moveToAmongUsMeeting(
                v2.add(this.game.map.center, spawnOffsets[i % spawnOffsets.length]),
            );
        }

        if (opts.consumeEmergencyCall) {
            caller.amongUsEmergencyCallsUsed++;
        }
        this.amongUsEmergencyMeetingSeq++;
        const reason =
            opts.emergencyButton || opts.consumeEmergencyCall
                ? net.AmongUsMeetingReason.Emergency
                : net.AmongUsMeetingReason.Report;
        this.amongUsMeeting = {
            sequence: this.amongUsEmergencyMeetingSeq,
            phase: net.AmongUsMeetingPhase.Discussion,
            timeLeft: 20,
            reason,
            callerId: caller.playerId,
            participantIds: this.getAmongUsMeetingParticipantIds(),
            votes: new Map<number, number>(),
            ejectedId: 0,
            ejectedWasImpostor: false,
            ejectionExploded: false,
            emergencyButton: opts.emergencyButton,
        };
        this.broadcastAmongUsMeetingState();
        this.game.updateData();
        return true;
    }

    get isAmongUsMeetingLocked(): boolean {
        return this.amongUsMeeting !== undefined;
    }

    private getAmongUsMeetingParticipantIds(): number[] {
        return this.players
            .filter((player) => !player.spectatorOnly)
            .map((player) => player.playerId);
    }

    private getAmongUsDeadParticipantIds(): number[] {
        const meeting = this.amongUsMeeting;
        if (!meeting) return [];

        return meeting.participantIds.filter((id) => {
            const player = this.players.find((candidate) => candidate.playerId === id);
            return !player || player.dead || player.disconnected;
        });
    }

    private getAmongUsEligibleVoterIds(): number[] {
        const meeting = this.amongUsMeeting;
        if (!meeting) return [];

        return meeting.participantIds.filter((id) => {
            const player = this.players.find((candidate) => candidate.playerId === id);
            return (
                player && !player.dead && !player.disconnected && !player.spectatorOnly
            );
        });
    }

    refreshAmongUsMeetingAfterParticipantChange(): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;

        if (
            meeting.phase === net.AmongUsMeetingPhase.Voting &&
            meeting.votes.size >= this.getAmongUsEligibleVoterIds().length
        ) {
            this.finishAmongUsVoting();
            return;
        }

        this.broadcastAmongUsMeetingState(
            meeting.phase !== net.AmongUsMeetingPhase.Voting,
        );
    }

    voteInAmongUsMeeting(voter: Player, targetId: number): void {
        const meeting = this.amongUsMeeting;
        if (
            !meeting ||
            meeting.phase !== net.AmongUsMeetingPhase.Voting ||
            voter.dead ||
            voter.disconnected ||
            !meeting.participantIds.includes(voter.playerId) ||
            meeting.votes.has(voter.playerId)
        ) {
            return;
        }

        if (targetId !== 0) {
            const target = this.players.find((player) => player.playerId === targetId);
            if (
                !target ||
                target.dead ||
                target.disconnected ||
                !meeting.participantIds.includes(targetId)
            ) {
                return;
            }
        }

        meeting.votes.set(voter.playerId, targetId);
        this.broadcastAmongUsMeetingState();

        const eligibleVoters = this.getAmongUsEligibleVoterIds();
        if (meeting.votes.size >= eligibleVoters.length) {
            this.finishAmongUsVoting();
        }
    }

    chatInAmongUsMeeting(player: Player, text: string): void {
        const meeting = this.amongUsMeeting;
        if (
            !meeting ||
            (meeting.phase !== net.AmongUsMeetingPhase.Discussion &&
                meeting.phase !== net.AmongUsMeetingPhase.Voting) ||
            player.dead ||
            player.disconnected ||
            !meeting.participantIds.includes(player.playerId)
        ) {
            return;
        }

        const message = text.trim().slice(0, 120);
        if (!message) return;

        const chatMsg = new net.AmongUsMeetingChatMsg();
        chatMsg.playerId = player.playerId;
        chatMsg.message = message;
        this.game.broadcastMsg(net.MsgType.AmongUsMeetingChat, chatMsg);
    }

    private updateAmongUsMeeting(dt: number): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;
        if (this.game.over) {
            this.closeAmongUsMeeting();
            return;
        }

        meeting.timeLeft -= dt;
        if (meeting.timeLeft > 0) return;

        switch (meeting.phase) {
            case net.AmongUsMeetingPhase.Discussion:
                meeting.phase = net.AmongUsMeetingPhase.Voting;
                meeting.timeLeft = 60;
                this.broadcastAmongUsMeetingState();
                break;
            case net.AmongUsMeetingPhase.Voting:
                this.finishAmongUsVoting();
                break;
            case net.AmongUsMeetingPhase.Reveal:
                if (meeting.ejectedId !== 0) {
                    this.startAmongUsEjection();
                } else {
                    this.closeAmongUsMeeting();
                }
                break;
            case net.AmongUsMeetingPhase.Ejection:
                if (meeting.ejectionExploded) {
                    this.closeAmongUsMeeting();
                } else {
                    this.explodeAmongUsEjectedPlayer();
                    meeting.ejectionExploded = true;
                    meeting.timeLeft = 1;
                }
                break;
        }
    }

    private startAmongUsEjection(): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;

        const ejected = this.players.find(
            (player) => player.playerId === meeting.ejectedId,
        );
        if (!ejected || ejected.dead) {
            this.closeAmongUsMeeting();
            return;
        }

        meeting.phase = net.AmongUsMeetingPhase.Ejection;
        meeting.timeLeft = 2;
        this.broadcastAmongUsMeetingState(true);
    }

    private explodeAmongUsEjectedPlayer(): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;

        const ejected = this.players.find(
            (player) => player.playerId === meeting.ejectedId,
        );
        if (!ejected || ejected.dead) return;

        this.game.explosionBarn.addVisualExplosion(
            "explosion_among_us_eject",
            ejected.pos,
            ejected.layer,
        );
        ejected.kill({
            damageType: GameConfig.DamageType.Player,
            gameSourceType: "explosion_among_us_eject",
            dir: v2.create(0, 0),
        });
    }

    private finishAmongUsVoting(): void {
        const meeting = this.amongUsMeeting;
        if (!meeting || meeting.phase !== net.AmongUsMeetingPhase.Voting) return;

        const totals = new Map<number, number>();
        for (const targetId of meeting.votes.values()) {
            if (targetId !== 0) {
                const target = this.players.find(
                    (player) => player.playerId === targetId,
                );
                if (!target || target.dead || target.disconnected) continue;
            }
            totals.set(targetId, (totals.get(targetId) ?? 0) + 1);
        }

        let maxVotes = 0;
        let ejectedId = 0;
        let tied = false;
        for (const [targetId, votes] of totals) {
            if (votes > maxVotes) {
                maxVotes = votes;
                ejectedId = targetId;
                tied = false;
            } else if (votes === maxVotes) {
                tied = true;
            }
        }

        meeting.ejectedId = tied || ejectedId === 0 ? 0 : ejectedId;
        meeting.ejectedWasImpostor =
            this.players.find((player) => player.playerId === meeting.ejectedId)
                ?.amongUsRole === "impostor";
        meeting.ejectionExploded = false;
        meeting.phase = net.AmongUsMeetingPhase.Reveal;
        meeting.timeLeft = meeting.ejectedId !== 0 ? 3 : 4;
        this.broadcastAmongUsMeetingState(true);
    }

    private closeAmongUsMeeting(): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;
        this.resetAmongUsEmergencyButton(meeting.emergencyButton);
        meeting.phase = net.AmongUsMeetingPhase.None;
        meeting.timeLeft = 0;
        this.broadcastAmongUsMeetingState(true);
        this.amongUsMeeting = undefined;
        this.game.deadBodyBarn.clear();
        for (const player of this.livingPlayers) {
            if (
                player.amongUsRole === "impostor" &&
                !player.dead &&
                !player.disconnected
            ) {
                player.resetAmongUsKillCooldown();
            }
        }
    }

    private resetAmongUsEmergencyButton(button?: Obstacle): void {
        if (!button?.isButton) return;
        if (!button.button.onOff && button.button.canUse) return;
        button.button.onOff = false;
        button.button.canUse = true;
        button.button.seq++;
        button.setDirty();
    }

    private broadcastAmongUsMeetingState(showVotes = false): void {
        const meeting = this.amongUsMeeting;
        if (!meeting) return;

        const msg = new net.AmongUsMeetingStateMsg();
        msg.sequence = meeting.sequence;
        msg.phase = meeting.phase;
        msg.seconds = Math.max(0, Math.ceil(meeting.timeLeft));
        msg.reason = meeting.reason;
        msg.callerId = meeting.callerId;
        msg.ejectedId = meeting.ejectedId;
        msg.ejectedWasImpostor = meeting.ejectedWasImpostor;
        msg.participantIds = meeting.participantIds;
        msg.deadParticipantIds = this.getAmongUsDeadParticipantIds();
        msg.submittedVoterIds = [...meeting.votes.keys()];
        msg.votes = showVotes
            ? [...meeting.votes].map(([voterId, targetId]) => ({ voterId, targetId }))
            : [];
        this.game.broadcastMsg(net.MsgType.AmongUsMeetingState, msg);
    }

    removePlayer(player: Player) {
        util.removeFrom(this.players, player);

        if (util.removeFrom(this.livingPlayers, player)) {
            this.aliveCountDirty = true;
        }

        this.deletedPlayers.push(player.__id);
        player.destroy();
        if (player.team) {
            player.team.removePlayer(player);
        }
        if (player.group) {
            player.group.removePlayer(player);

            if (player.group.players.length <= 0) {
                util.removeFrom(this.groups, player.group);
                this.groupsByHash.delete(player.group.hash);
            }
        }
        if (this.game.isTeamMode) {
            this.livingPlayers.sort((a, b) => a.teamId - b.teamId);
        }

        player.obstacleOutfit?.destroy();
        player.propDisguise?.destroy();

        this.game.checkGameOver();
        this.game.updateData();
    }

    sendMsgs() {
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (player.disconnected) continue;
            player.sendMsgs();
        }
    }

    flush() {
        this.newPlayers.length = 0;
        this.dirtyPlayerInfos.length = 0;
        this.deletedPlayers.length = 0;
        this.emotes.length = 0;
        this.aliveCountDirty = false;
        this.killLeaderDirty = false;

        const flushPlayerStatus = this.playerStatusTicker > this.playerStatusRate;
        if (flushPlayerStatus) {
            this.playerStatusTicker = 0;
        }

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            player.healthDirty = false;
            player.boostDirty = false;
            player.zoomDirty = false;
            player.actionDirty = false;
            player.inventoryDirty = false;
            player.weapsDirty = false;
            player.spectatorCountDirty = false;
            player.streakDirty = false;
            player.nitroLaceDirty = false;
            player.hideAndSeekBlindDirty = false;
            player.activeIdDirty = false;
            player.groupStatusDirty = false;
            if (flushPlayerStatus) {
                player.playerStatusDirty = false;
            }
        }
    }

    /**
     * called everytime gas.circleIdx is incremented for efficiency purposes
     * schedules all roles that need to be assigned for the respective circleIdx
     */
    scheduleRoleAssignments(): void {
        const roles = this.game.map.mapDef.gameConfig.roles;
        assert(
            roles,
            '"roles" property is undefined in chosen map definition, cannot call this function',
        );

        const rolesToSchedule = roles.timings.filter(
            (timing) => this.game.gas.circleIdx == timing.circleIdx,
        );

        for (let i = 0; i < rolesToSchedule.length; i++) {
            const roleObj = rolesToSchedule[i];
            const roleStr =
                roleObj.role instanceof Function ? roleObj.role() : roleObj.role;
            this.scheduledRoles.push({
                role: roleStr,
                time: roleObj.wait,
            });
        }
    }

    isTeamGameOver(): boolean {
        const groupAlives = [...this.groups.values()].filter(
            (group) => !group.allDeadOrDisconnected,
        );

        if (groupAlives.length <= 1) {
            return true;
        }

        return false;
    }

    getAliveGroups(): Group[] {
        return [...this.groups.values()].filter(
            (group) => group.livingPlayers.length > 0,
        );
    }

    getAliveTeams(): Team[] {
        return this.teams.filter((team) => team.livingPlayers.length > 0);
    }

    getSmallestTeam() {
        return this.teams.reduce((smallest, current) => {
            if (current.livingPlayers.length < smallest.livingPlayers.length) {
                return current;
            }
            return smallest;
        }, this.teams[0]);
    }

    addTeam(teamId: number) {
        const team = new Team(this.game, teamId);
        this.teams.push(team);
        return team;
    }

    getGroupAndTeam({ groupData }: JoinTokenData):
        | {
              group?: Group;
              team?: Team;
          }
        | undefined {
        if (!this.game.isTeamMode) return undefined;

        let group = this.groupsByHash.get(groupData.groupHashToJoin);

        let team = this.game.map.factionMode ? this.getSmallestTeam() : undefined;

        if (!group && groupData.autoFill) {
            const groups = team ? team.getGroups() : this.groups;
            const validGroups = groups.filter((group) => {
                return group.autoFill && group.canJoin(groupData.playerCount);
            });
            group = validGroups[Math.floor(Math.random() * validGroups.length)];
        }

        // second condition should never happen
        // but keeping it just in case
        // since more than 4 players in a group crashes the client
        if (!group || group.locked || group.players.length >= this.game.teamMode) {
            group = this.addGroup(groupData.autoFill, groupData.groupHashToJoin);
        }

        // only reserve slots on the first time this join token is used
        // since the playerCount counts for other people from the team menu
        // using the same token
        // if (group.hash !== groupData.groupHashToJoin) {
        //     group.reservedSlots += groupData.playerCount;
        // }

        // groupData.groupHashToJoin = group.hash;

        // pre-existing group not created during this function call
        // players who join from the same group need the same team
        if (this.game.map.factionMode && group.players.length > 0) {
            team = group.players[0].team;
        }

        return { group, team };
    }

    addGroup(autoFill: boolean, hash = Math.random().toString(16).slice(2)) {
        // not using nodejs crypto because i want it to run in the browser too
        // and doesn't need to be cryptographically secure lol
        const groupId = this.groupIdAllocator.getNextId();
        const group = new Group(hash, groupId, autoFill, this.game.teamMode);
        this.groups.push(group);
        this.groupsByHash.set(hash, group);
        return group;
    }

    nextTeam(currentTeam: Group) {
        const aliveTeams = Array.from(this.groups.values()).filter(
            (t) => !t.allDeadOrDisconnected,
        );
        const currentTeamIndex = aliveTeams.indexOf(currentTeam);
        const newIndex = (currentTeamIndex + 1) % aliveTeams.length;
        return aliveTeams[newIndex];
    }

    prevTeam(currentTeam: Group) {
        const aliveTeams = Array.from(this.groups.values()).filter(
            (t) => !t.allDeadOrDisconnected,
        );
        const currentTeamIndex = aliveTeams.indexOf(currentTeam);
        return aliveTeams.at(currentTeamIndex - 1) ?? currentTeam;
    }

    getPlayerWithHighestKills(): Player | undefined {
        return this.game.playerBarn.livingPlayers
            .filter(
                (p) => this.getTrackedKills(p) >= GameConfig.player.killLeaderMinKills,
            )
            .sort((a, b) => this.getTrackedKills(b) - this.getTrackedKills(a))[0];
    }

    getTrackedKills(
        player: Pick<Player, "kills"> & { getLeaderboardKey(): string },
    ): number {
        if (isBattleRoyaleMapName(this.game.mapName)) {
            return player.kills;
        }
        return (
            this.game.leaderboard.get(player.getLeaderboardKey())?.kills ?? player.kills
        );
    }

    addEmote(type: string, playerId: number, itemType = "") {
        this.emotes.push({
            isPing: false,
            playerId,
            pos: v2.create(0, 0),
            type,
            itemType,
        });
    }

    addMapPing(
        type: string,
        pos: Vec2,
        playerId = 0,
        targetArenaTeam?: "A" | "B" | Array<"A" | "B">,
    ) {
        const targetArenaTeams = Array.isArray(targetArenaTeam)
            ? targetArenaTeam
            : undefined;
        const targetArenaTeamSingle = Array.isArray(targetArenaTeam)
            ? undefined
            : targetArenaTeam;
        this.emotes.push({
            isPing: true,
            type,
            pos,
            playerId,
            itemType: "",
            targetArenaTeam: targetArenaTeamSingle,
            targetArenaTeams,
        });
    }
}

export class Player extends BaseGameObject {
    override readonly __type = ObjectType.Player;

    bounds = collider.createAabbExtents(
        v2.create(0, 0),
        v2.create(GameConfig.player.maxVisualRadius, GameConfig.player.maxVisualRadius),
    );

    scale = 1;

    get rad(): number {
        return GameConfig.player.radius * this.scale;
    }

    set rad(rad: number) {
        this.collider.rad = rad;
        this.rad = rad;
    }

    get playerId() {
        return this.__id;
    }

    dir = v2.create(1, 0);
    dirOld = v2.create(1, 0);
    // direction received from the last inputMsg
    dirNew = v2.create(1, 0);

    pushBack: Vec2 = v2.create(0, 0);
    pushBackTime: number = 0;
    private _firstShieldBrokenUntil: number = 0;

    posOld = v2.create(0, 0);

    collider: Circle;

    healthDirty = true;
    boostDirty = true;
    zoomDirty = true;
    actionDirty = false;
    inventoryDirty = true;
    weapsDirty = true;
    spectatorCountDirty = false;
    activeIdDirty = true;
    hasFiredFlare = false;
    flareTimer = 0;

    sendDeathEmoteTicker = 0;
    sentDeathEmote = false;

    team: Team | undefined = undefined;
    group: Group | undefined = undefined;
    spectatorOnly = false;

    /**
     * set true if any member on the team changes health or disconnects
     */
    groupStatusDirty = false;

    setGroupStatuses() {
        if (!this.game.isTeamMode) return;

        const teammates = this.group!.players;
        for (const t of teammates) {
            t.groupStatusDirty = true;
        }
    }

    /**
     * for updating player and teammate locations in the minimap client UI
     */
    playerStatusDirty = false;

    private _health: number = GameConfig.player.health;

    get health(): number {
        return this._health;
    }

    set health(health: number) {
        health = math.clamp(health, 0, GameConfig.player.health);
        if (this._health === health) return;
        this._health = health;
        this.healthDirty = true;
        this.setGroupStatuses();

        if (this.obstacleOutfit) {
            const healthT = math.clamp(this._health / 100, 0, 1);

            if (!math.eqAbs(this.obstacleOutfit.healthT, healthT, 0.01)) {
                this.obstacleOutfit.healthT = healthT;
                this.obstacleOutfit.setDirty();
            }
        }
        if (this.propDisguise) {
            const healthT = math.clamp(this._health / 100, 0, 1);

            if (!math.eqAbs(this.propDisguise.healthT, healthT, 0.01)) {
                this.propDisguise.healthT = healthT;
                this.propDisguise.setDirty();
            }
        }
    }

    minBoost = 0;
    lastBoost = 0;

    private _boost = 0;
    get boost() {
        return this._boost;
    }
    set boost(boost: number) {
        this._boost = math.clamp(boost, 0, 100);
    }

    speed: number = 0;
    moveVel = v2.create(0, 0);

    shotSlowdownTimer: number = 0;
    lowHpSurgeTicker: number = 0;

    freeSwitchTimer: number = 0;

    indoors = false;
    insideZoomRegion = false;

    private _zoom: number = 0;
    // zoom used for the area in which the server will send objects to the client
    private _cullingZoom: number = 0;
    private _cullingZoomTicker = 0;

    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        if (zoom === this._zoom) return;
        assert(zoom !== 0);
        // when changing to a lower zoom level
        // we want to delay changing the culling zoom
        // so objects only disappear from the client after the scope animation
        // has finished, instead of flashing out of existence
        if (zoom < this._cullingZoom) {
            this._cullingZoomTicker = 0.5;
        } else {
            this._cullingZoom = zoom;
        }
        this._zoom = zoom;
        this.zoomDirty = true;
    }

    scopeZoomRadius: Record<string, number>;

    scope = "1xscope";
    amongUsCamerasOpen = false;

    get inventory() {
        return this.invManager.items;
    }
    invManager = new InventoryManager(this);

    get curWeapIdx() {
        return this.weaponManager.curWeapIdx;
    }

    weapons: WeaponManager["weapons"];
    private aprilFoolsDisplayWeapons = Array.from(
        { length: GameConfig.WeaponSlot.Count },
        () => "",
    );

    get activeWeapon() {
        return this.weaponManager.activeWeapon;
    }

    get loadingBlaster() {
        const itemDef = GameObjectDefs[this.activeWeapon] as GunDef | undefined;
        if (itemDef?.type !== "gun" || itemDef.fireMode !== "blaster") return 0;
        return this.weaponManager.loadingBlasterCharge;
    }

    get gunLoaded() {
        const itemDef = GameObjectDefs[this.activeWeapon] as GunDef | undefined;
        return (
            itemDef?.type === "gun" &&
            itemDef.fireMode === "blaster" &&
            this.loadingBlaster >= (itemDef.loadTime ?? 1.5)
        );
    }

    private getDisplayWeaponType(slot: number): string {
        const realType = this.weapons[slot]?.type ?? "";
        if (!this.game.map.aprilFoolsMode) return realType;
        if (!realType) return "";

        const displayType = this.aprilFoolsDisplayWeapons[slot];
        if (displayType && GameObjectDefs[displayType]?.type === "gun") {
            return displayType;
        }
        return realType;
    }

    private setDisplayWeaponType(slot: number, type: string) {
        this.aprilFoolsDisplayWeapons[slot] = type;
    }

    getNetActiveWeapon(): string {
        return this.getDisplayWeaponType(this.curWeapIdx) || this.activeWeapon;
    }

    getNetWeapons(): WeaponManager["weapons"] {
        return this.weapons.map((weapon, slot) => ({
            ...weapon,
            type: this.getDisplayWeaponType(slot),
        }));
    }

    private _disconnected = false;

    get disconnected(): boolean {
        return this._disconnected;
    }

    set disconnected(disconnected: boolean) {
        if (this.disconnected === disconnected) return;

        this._disconnected = disconnected;
        this.setGroupStatuses();
    }

    disconnect(reason?: string) {
        this.disconnected = true;
        this.game.closeSocket(this.socketId, reason);
    }

    private _spectatorCount = 0;
    set spectatorCount(spectatorCount: number) {
        if (this._spectatorCount === spectatorCount) return;
        this._spectatorCount = spectatorCount;
        this._spectatorCount = math.clamp(this._spectatorCount, 0, 255); // byte size limit
        this.spectatorCountDirty = true;
    }

    get spectatorCount(): number {
        return this._spectatorCount;
    }

    /** true when player starts spectating new player, only stays true for that given tick */
    startedSpectating: boolean = false;

    private _spectating?: Player;

    get spectating(): Player | undefined {
        return this._spectating;
    }

    set spectating(player: Player | undefined) {
        if (player === this) {
            throw new Error(
                `Player ${player.name} tried spectate themselves (how tf did this happen?)`,
            );
        }
        if (this._spectating === player) return;

        if (this._spectating) {
            this._spectating.spectatorCount--;
            this._spectating.spectators.delete(this);
        }
        if (player) {
            player.spectatorCount++;
            player.spectators.add(this);
        }

        this._spectating = player;
        this.startedSpectating = true;
    }

    spectateCooldown = 0;
    spectateCooldownCount = 0;
    spectateMsgCount = 0;
    spectateMsgTicker = 0;

    spectators = new Set<Player>();

    outfit = "outfitBase";
    meleeSkin = "fists";

    setOutfit(outfit: string) {
        if (this.outfit === outfit) return;
        this.outfit = outfit;
        this.obstacleOutfit?.destroy();
        this.obstacleOutfit = undefined;

        if (!this.propDisguise) {
            this.createObstacleOutfit();
        }
        this.setDirty();
    }

    private createObstacleOutfit() {
        const def = GameObjectDefs[this.outfit] as OutfitDef;
        if (def.obstacleType) {
            this.obstacleOutfit = this.game.map.genOutfitObstacle(def.obstacleType, this);
        }
    }

    private canUseLootAsProp(type: string): boolean {
        const def = GameObjectDefs[type];
        return (
            !!def &&
            "lootImg" in def &&
            !!def.lootImg.sprite &&
            def.lootImg.sprite !== "none"
        );
    }

    setPropDisguise(type?: string, ori = 0, scale?: number) {
        this.propDisguise?.destroy();
        this.propDisguise = undefined;

        if (!type) {
            if (!this.obstacleOutfit) {
                this.createObstacleOutfit();
            }
            return;
        }

        const def = MapObjectDefs[type];
        if (
            (def?.type === "obstacle" &&
                (!(def as ObstacleDef).img.sprite ||
                    (def as ObstacleDef).img.sprite === "none")) ||
            (def?.type !== "obstacle" &&
                def?.type !== "decal" &&
                !this.canUseLootAsProp(type))
        ) {
            if (!this.obstacleOutfit) {
                this.createObstacleOutfit();
            }
            return;
        }

        this.obstacleOutfit?.destroy();
        this.obstacleOutfit = undefined;
        this.propDisguise =
            def?.type === "obstacle"
                ? this.game.map.genOutfitObstacle(type, this, ori, scale, true)
                : def?.type === "decal"
                  ? this.game.map.genOutfitDecal(type, this, ori, scale)
                  : this.game.map.genOutfitLoot(type, this);
    }

    getBodyCollider() {
        return this.propDisguise?.collider ?? this.collider;
    }

    getMovementBlockCircle() {
        if (!this.propDisguise) {
            return { pos: this.pos, rad: this.rad };
        }

        const aabb = collider.toAabb(this.propDisguise.collider);
        const center = v2.add(aabb.min, v2.mul(v2.sub(aabb.max, aabb.min), 0.5));
        const halfSize = v2.sub(aabb.max, center);
        const radius =
            this.propDisguise.collider.type === collider.Type.Circle
                ? this.propDisguise.collider.rad
                : Math.sqrt(halfSize.x * halfSize.y);
        return { pos: center, rad: radius };
    }

    /** "backpack00" is no backpack, "backpack03" is the max level backpack */
    backpack: string;
    /** "" is no helmet, "helmet03" is the max level helmet */
    helmet: string;
    /** "" is no chest, "chest03" is the max level chest */
    chest: string;

    getGearLevel(type: string): number {
        if (!type) {
            // not wearing any armor, level 0
            return 0;
        }
        return (GameObjectDefs[type] as BackpackDef | HelmetDef | ChestDef).level;
    }

    layer: number;
    aimLayer = 0;
    dead = false;
    infectedRespawnTicker = 0;
    downed = false;

    downedCount = 0;
    /**
     * players have a buffer where they can't take damage immediately after being downed
     * this is mostly so players dont get knocked AND killed by the same airstrike
     */
    downedDamageTicker = 0;
    bleedTicker = 0;
    playerBeingRevived: Player | undefined;
    revivedBy: Player | undefined;

    animType: Anim = GameConfig.Anim.None;
    animSeq = 0;
    private _animTicker = 0;

    distSinceLastCrawl = 0;

    actionType: Action = GameConfig.Action.None;
    actionSeq = 0;
    action = { time: 0, duration: 0, targetId: 0 };

    timeUntilHidden = -1; // for showing on enemy minimap in 50v50

    /**
     * specifically for reloading single shot guns to keep reloading until maxClip is reached
     */
    reloadAgain = false;

    wearingPan = false;
    healEffect = false;
    burnEffect = false;
    burnTicker = 0;
    burnDuration = 0;
    poisonEffect = false;
    poisonTicker = 0;
    poisonDuration = 0;
    poisonSource?: GameObject;
    poisonSourceTeamId?: number;
    nitroLaceEffect = false;
    nitroLaceDuration = 0;
    nitroLaceMaxDuration = 10;
    nitroLaceDirty = false;

    // Phoenix perk state
    phoenixPassiveTicker = 0;
    phoenixHealTicker = 0;
    get nitroLacePercentage(): number {
        if (this.nitroLaceMaxDuration <= 0) return 0;
        return (this.nitroLaceDuration / this.nitroLaceMaxDuration) * 100;
    }
    // if hit by snowball or potato, slowed down for "x" seconds
    healEffectTicker = 0;
    // if hit by snowball, potato, or coconut: slowed down for "x" seconds
    frozenTicker = 0;
    frozen = false;
    frozenOri = 0;

    private _hasteTicker = 0;
    hasteType: HasteType = GameConfig.HasteType.None;
    hasteSeq = 0;

    actionItem = "";

    hasRoleHelmet = false;
    role = "";
    isKillLeader = false;

    /** for cobalt mode role menu, will spawn the player by force if timer runs out */
    roleMenuTicker = 0;

    /** for the perk fabricate, fills inventory with frags every 12 seconds */
    fabricateRefillTicker = 0;
    fabricateGiveTicker = 0;
    fabricateThrowablesLeft = 0;

    // "Gabby Ghost" perk random emojis
    chattyTicker = 0;

    mapIndicator?: MapIndicator;

    // spud gun variables

    fatModifier = 0;
    fatTicker = 0;

    // heart cannon pull effect
    pullToSourcePos: Vec2 | null = null;
    pullToSourceTicker = 0;
    pullToSourceSpeed = 18;
    shootDisabledTimer = 0;

    promoteToRole(role: string) {
        const roleDef = GameObjectDefs[role] as RoleDef;
        if (!roleDef || roleDef.type !== "role") {
            this.game.logger.warn(`Invalid role type: ${role}`);
            return;
        }

        if (role === "leader") {
            this.hasFiredFlare = false;
            this.flareTimer = 15;
        }

        if (this.role === role) return;

        // switching from one role to another
        // need to delete any non-droppables so they can be overwritten
        if (this.role) {
            if (this.helmet && (GameObjectDefs[this.helmet] as HelmetDef).noDrop)
                this.helmet = "";
            if (this.chest && (GameObjectDefs[this.chest] as ChestDef).noDrop)
                this.chest = "";
        }

        this.role = role;
        this.inventoryDirty = true;
        this.setDirty();

        // for savannah the hunted indicator
        if (roleDef.mapIndicator) {
            this.mapIndicator?.kill();
            this.mapIndicator = this.game.mapIndicatorBarn.allocIndicator(role, true);
        }

        const msg = new net.RoleAnnouncementMsg();
        msg.role = role;
        msg.assigned = true;
        msg.playerId = this.__id;
        this.game.broadcastMsg(net.MsgType.RoleAnnouncement, msg);

        switch (role) {
            case "leader":
                if (this.game.map.factionMode && !this.team!.leader) {
                    this.team!.leader = this;
                }
                break;
            case "last_man":
                this.health = 100;
                this.boost = 100;
                this.giveHaste(GameConfig.HasteType.Windwalk, 5);
                break;
        }

        if (roleDef.defaultItems) {
            // for non faction modes where teamId > 2, just cycles between blue and red teamId
            const clampedTeamId = ((this.teamId - 1) % 2) + 1;

            // give backpack before heals/ammos
            if (roleDef.defaultItems.backpack) {
                if (this.backpack) {
                    this.dropBackPackCopy(this.backpack);
                }
                this.backpack = roleDef.defaultItems.backpack;
            }

            // inventory and scope
            for (const [key, value] of Object.entries(roleDef.defaultItems.inventory)) {
                this.invManager.giveAndDrop(key as InventoryItem, value);
            }

            // outfit
            const oldOutfit = GameObjectDefs[this.outfit] as OutfitDef;
            let newOutfit = roleDef.defaultItems.outfit;

            if (newOutfit instanceof Function) {
                newOutfit = newOutfit(clampedTeamId);
            }
            if (newOutfit) {
                if (!oldOutfit.noDropOnDeath) {
                    this.dropLoot(this.outfit);
                }
                this.setOutfit(newOutfit);
            }

            const roleHelmet =
                roleDef.defaultItems.helmet instanceof Function
                    ? roleDef.defaultItems.helmet(clampedTeamId)
                    : roleDef.defaultItems.helmet;

            if (roleHelmet) {
                // armor
                if (this.helmet && !this.hasRoleHelmet) {
                    this.dropArmor(this.helmet);
                }

                this.helmet = roleHelmet;
                this.hasRoleHelmet = true;
            }

            if (roleDef.defaultItems.chest) {
                if (this.chest) {
                    this.dropArmor(this.chest);
                }
                this.chest = roleDef.defaultItems.chest;
            }

            // weapons
            for (let i = 0; i < roleDef.defaultItems.weapons.length; i++) {
                const weaponOrWeaponFunc = roleDef.defaultItems.weapons[i];
                const trueWeapon =
                    weaponOrWeaponFunc instanceof Function
                        ? weaponOrWeaponFunc(clampedTeamId)
                        : weaponOrWeaponFunc;

                if (!trueWeapon.type) {
                    // prevents overwriting existing weapons
                    if (!this.weapons[i].type) {
                        continue;
                    }

                    const curWeapDef = GameObjectDefs[this.weapons[i].type];
                    if (curWeapDef.type == "gun") {
                        // refills the ammo of the existing weapon
                        this.weaponManager.reload(i, true);
                    }
                    continue;
                }

                const trueWeapDef = GameObjectDefs[trueWeapon.type] as LootDef;
                if (trueWeapDef && trueWeapDef.type == "gun") {
                    if (this.weapons[i].type) this.weaponManager.dropGun(i);

                    if (trueWeapon.fillInv) {
                        const ammoType = trueWeapDef.ammo as InventoryItem;
                        const maxSize = this.invManager.getMaxCapacity(ammoType);
                        this.invManager.set(ammoType, maxSize);
                    }
                } else if (trueWeapDef && trueWeapDef.type == "melee") {
                    if (this.weapons[i].type) {
                        const curMelee = GameObjectDefs[this.weapons[i].type] as MeleeDef;
                        if (!curMelee.noDropOnDeath) {
                            this.weaponManager.dropMelee();
                        }
                    }
                }
                this.weaponManager.setWeapon(i, trueWeapon.type, trueWeapon.ammo);
            }
        }

        // we first need to build a list of the new perks to add
        const newPerks = new Set<string>();
        if (roleDef.perks) {
            for (let i = 0; i < roleDef.perks.length; i++) {
                const perkOrPerkFunc = roleDef.perks[i];
                const perkType =
                    typeof perkOrPerkFunc === "string"
                        ? perkOrPerkFunc
                        : perkOrPerkFunc();

                newPerks.add(perkType);
            }
        }
        // then remove perks from the old role
        // but skip perks we are about to add again and remove them from the list
        // so they both aren't removed to just be added again
        // and aren't added twice
        for (let i = 0; i < this.perks.length; i++) {
            const perkType = this.perks[i].type;
            if (this.perks[i].isFromRole) {
                if (!newPerks.has(perkType)) {
                    this.removePerk(perkType);
                    i--;
                } else {
                    newPerks.delete(perkType);
                }
            } else if (this.perks[i].droppable && newPerks.has(perkType)) {
                this.dropLoot(perkType);
                this.removePerk(perkType);
                i--;
            }
        }

        for (const perk of newPerks) {
            this.addPerk(perk, false, undefined, true);
        }
    }

    roleSelect(role: string): void {
        if (!this.game.map.perkModeTwinsBunker || this.role) return;

        // so the client can't be manipulated to send lone survivr or something
        if (!this.game.map.mapDef.gameMode.perkModeRoles!.includes(role)) return;

        this.roleMenuTicker = 0;
        this.promoteToRole(role);
        // v2.set() necessary since this.collider.pos is linked to this.pos by reference
        v2.set(this.pos, this.game.map.getSpawnPos(this.group, this.team));
        if (this.group && !this.group.spawnPosition) {
            this.group.spawnPosition = v2.copy(this.pos);
        }
        this.layer = 0; // player was underground before this

        this.game.grid.updateObject(this);
        this.setDirty();
    }

    removeRole(): void {
        const def = GameObjectDefs[this.role] as RoleDef;
        if (!def) return;
        this.role = "";

        this.mapIndicator?.kill();
        for (let i = 0; i < this.perks.length; i++) {
            const perk = this.perks[i];
            if (perk.isFromRole) {
                this.removePerk(perk.type);
                i--;
            }
        }
        this.setDirty();
    }

    promoteToKillLeader() {
        if (this.isKillLeader) return;

        this.isKillLeader = true;
        if (this.game.playerBarn.killLeader) {
            this.game.playerBarn.killLeader.isKillLeader = false;
        }

        this.game.playerBarn.killLeader = this;
        this.game.playerBarn.killLeaderDirty = true;

        if (this.game.map.sniperMode) {
            // promote to the role on savannah
            this.promoteToRole("the_hunted");
        } else {
            // else just send a RoleAnnouncementMsg
            const msg = new net.RoleAnnouncementMsg();
            msg.role = "kill_leader";
            msg.assigned = true;
            msg.playerId = this.__id;
            this.game.broadcastMsg(net.MsgType.RoleAnnouncement, msg);
        }
    }

    lastBreathActive = false;
    private _lastBreathTicker = 0;

    bugleTickerActive = false;
    private _bugleTicker = 0;

    private _perks: Array<{
        type: string;
        droppable: boolean;
        replaceOnDeath?: string;
        isFromRole?: boolean;
    }> = [];

    get perks(): ReadonlyArray<Player["_perks"][0]> {
        return this._perks;
    }

    private _perkTypes: string[] = [];

    addPerk(
        type: string,
        droppable = false,
        replaceOnDeath?: string,
        isFromRole?: boolean,
    ) {
        if (this.game.disablePerks && type !== "endless_ammo") return;

        this._perks.push({
            type,
            droppable,
            replaceOnDeath,
            isFromRole,
        });
        this._perkTypes.push(type);

        switch (type) {
            case "trick_m9": {
                const ammo = this.weaponManager.getAmmoStats(
                    GameObjectDefs["m9_cursed"] as GunDef,
                );
                this.weaponManager.setWeapon(
                    GameConfig.WeaponSlot.Secondary,
                    "m9_cursed",
                    ammo.maxClip,
                );
                break;
            }
            case "fabricate":
                this.fabricateRefillTicker = PerkProperties.fabricate.refillInterval;
                break;
            case "aoe_heal":
                this.game.playerBarn.aoeHealPlayers.push(this);
                break;
        }

        this.recalculateScale();
        this.recalculateMinBoost();
    }

    removePerk(type: string): void {
        const idx = this._perks.findIndex((perk) => perk.type === type);
        if (idx === -1) return;
        this._perks.splice(idx, 1);
        this._perkTypes.splice(this._perkTypes.indexOf(type), 1);

        switch (type) {
            case "trick_m9": {
                const slot = this.weapons.findIndex((weap) => {
                    return weap.type === "m9_cursed";
                });
                if (slot !== -1) {
                    this.weaponManager.setWeapon(slot, "", 0);
                }
                break;
            }
            case "inspiration": {
                const slot = this.weapons.findIndex((weap) => {
                    return weap.type === "bugle";
                });
                if (slot !== -1) {
                    this.weaponManager.setWeapon(slot, "", 0);
                }
                break;
            }
            case "fabricate":
                this.fabricateRefillTicker = 0;
                break;
            case "firepower":
                this.weaponManager.clampGunsAmmo();
                break;
            case "aoe_heal": {
                util.removeFrom(this.game.playerBarn.aoeHealPlayers, this);
                break;
            }
        }

        this.recalculateScale();
        this.recalculateMinBoost();
    }

    hasPerk(type: string) {
        return this._perkTypes.includes(type);
    }

    checkDamageStreaks(): void {
        if (isBattleRoyaleMapName(this.game.mapName)) return;
        if (isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;
        // If already ready or active, nothing to check
        if (this.streakReady || this.streakActive) return;
        const threshold = this.streakNextThreshold;
        if (this.damageDealt >= threshold) {
            this.streakReady = true;
            this.streakDirty = true;
        }
    }

    activateStreak(requestedIdx: number = -1): void {
        if (isBattleRoyaleMapName(this.game.mapName)) return;
        if (!this.streakReady) return;
        if (this.streakActive) return;

        const streakDef = DamageStreakDefs[this.chosenStreakType];
        if (!streakDef) return;

        this.streakReady = false;
        this.streakActive = true;
        this.streakActiveTimer = streakDef.duration;
        this.streakActivationCount++;
        this.streakDirty = true;
        this.questManager.trackEvent("streak_activated", {});

        if (streakDef.rewardType === "perk") {
            this.addPerk(streakDef.rewardItem, false);
        } else if (streakDef.rewardType === "gun") {
            const slot = this.curWeapIdx <= 1 ? this.curWeapIdx : 0;
            this.streakGunSlot = slot;
            this.streakSavedWeapon = {
                slot,
                type: this.weapons[slot].type,
                ammo: this.weapons[slot].ammo,
            };
            const gunDef = GameObjectDefs[streakDef.rewardItem] as GunDef;
            const ammo = gunDef ? gunDef.maxClip : 30;
            this.weaponManager.setWeapon(slot, streakDef.rewardItem, ammo);
            this.weaponManager.setCurWeapIndex(slot, true, true, true);
        }
    }

    deactivateStreak(): void {
        if (!this.streakActive) return;

        const streakDef = DamageStreakDefs[this.chosenStreakType];
        if (streakDef) {
            if (streakDef.rewardType === "perk") {
                if (this.hasPerk(streakDef.rewardItem)) {
                    this.removePerk(streakDef.rewardItem);
                }
            } else if (streakDef.rewardType === "gun") {
                if (this.streakGunSlot >= 0) {
                    this.weaponManager.setWeapon(this.streakGunSlot, "", 0);
                }
                if (this.streakSavedWeapon) {
                    this.weaponManager.setWeapon(
                        this.streakSavedWeapon.slot,
                        this.streakSavedWeapon.type,
                        this.streakSavedWeapon.ammo,
                    );
                    this.streakSavedWeapon = null;
                }
                this.streakGunSlot = -1;
            }
        }

        this.streakActive = false;
        this.streakActiveTimer = 0;
        this.streakDirty = true;
    }

    updateStreaks(dt: number): void {
        if (this.streakActive) {
            this.streakActiveTimer -= dt;
            this.streakDirty = true;

            const streakDef = DamageStreakDefs[this.chosenStreakType];
            if (streakDef && streakDef.rewardItem === "streak_juggernaut_effect") {
                this.health +=
                    DamageStreakProperties.streak_juggernaut_effect.healthRegen * dt;
            }

            if (this.streakActiveTimer <= 0) {
                this.deactivateStreak();
                // Check if next charge is already earned
                this.checkDamageStreaks();
            }
        }
    }

    updateHideAndSeek(dt: number): void {
        if (this.hideAndSeekBlindTicker > 0) {
            this.hideAndSeekBlindTicker = Math.max(0, this.hideAndSeekBlindTicker - dt);
        }
        if (this.hideAndSeekWrongPropDamageCooldown > 0) {
            this.hideAndSeekWrongPropDamageCooldown = Math.max(
                0,
                this.hideAndSeekWrongPropDamageCooldown - dt,
            );
        }

        const settings = getHideAndSeekSettings(this.game.miniGame);
        if (!settings || this.arenaTeam !== settings.hiderTeam) return;

        if (this.hideAndSeekNoiseTicker <= 0) {
            this.hideAndSeekNoiseTicker = settings.hiderNoiseInterval;
        }

        this.hideAndSeekNoiseTicker -= dt;
        if (this.hideAndSeekNoiseTicker <= 0) {
            this.emitHideAndSeekNoise(settings);
            this.hideAndSeekNoiseTicker = settings.hiderNoiseInterval;
        }
    }

    updateInfected(dt: number): void {
        const settings = getInfectedSettings(this.game.miniGame);
        if (!settings || this.arenaTeam !== settings.humanTeam) return;

        if (this.infectedHumanNoiseTicker <= 0) {
            this.infectedHumanNoiseTicker = settings.humanNoiseInterval;
        }

        this.infectedHumanNoiseTicker -= dt;
        if (this.infectedHumanNoiseTicker <= 0) {
            this.emitArenaNoisePing({
                weapon: settings.humanNoiseWeapon,
                ping: settings.humanNoisePing,
                pingOffsetRadius: settings.humanNoisePingOffsetRadius,
                shotAlt: settings.humanNoiseShotAlt,
                targetArenaTeams: [settings.humanTeam, settings.zombieTeam],
            });
            this.infectedHumanNoiseTicker = settings.humanNoiseInterval;
        }
    }

    applyHideAndSeekBlind(duration: number): void {
        this.hideAndSeekBlindTicker = Math.max(this.hideAndSeekBlindTicker, duration);
        this.hideAndSeekBlindDirty = true;
    }

    emitHideAndSeekNoise(settings: ReturnType<typeof getHideAndSeekSettings>): void {
        if (!settings) return;

        this.emitArenaNoisePing({
            weapon: settings.hiderNoiseWeapon,
            ping: settings.hiderNoisePing,
            pingOffsetRadius: settings.hiderNoisePingOffsetRadius,
            shotAlt: settings.hiderNoiseShotAlt,
            targetArenaTeams: [settings.hiderTeam, settings.seekerTeam],
        });
    }

    emitArenaNoisePing(settings: {
        weapon: string;
        ping: string;
        pingOffsetRadius: number;
        shotAlt: boolean;
        targetArenaTeams: Array<"A" | "B">;
    }): void {
        const weaponDef = GameObjectDefs[settings.weapon] as GunDef;
        const pingOffsetAngle = util.random(0, Math.PI * 2);
        const pingOffsetDistance = util.random(
            settings.pingOffsetRadius * 0.5,
            settings.pingOffsetRadius,
        );
        const pingPos = v2.add(
            this.pos,
            v2.mul(
                v2.create(Math.cos(pingOffsetAngle), Math.sin(pingOffsetAngle)),
                pingOffsetDistance,
            ),
        );
        this.game.map.clampToMapBounds(pingPos);
        this.game.playerBarn.addMapPing(
            settings.ping,
            pingPos,
            this.__id,
            settings.targetArenaTeams,
        );
        this.game.bulletBarn.fireBullet({
            dir: this.dir,
            pos: this.pos,
            bulletType: weaponDef.bulletType,
            gameSourceType: settings.weapon,
            layer: this.layer,
            damageMult: 0,
            damageType: GameConfig.DamageType.Player,
            playerId: this.__id,
            shotAlt: settings.shotAlt,
            shotFx: false,
        });
    }

    canUseHideAndSeekPropSwitch(): boolean {
        if (!isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return true;
        return this.hideAndSeekPropSwitchesLeft > 0;
    }

    syncHideAndSeekPropSwitchAmmo(): void {
        if (!isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;

        const primary = this.weapons[GameConfig.WeaponSlot.Primary];
        if (primary.type === "prop_o_matic") {
            primary.ammo = this.hideAndSeekPropSwitchesLeft > 0 ? 1 : 0;
            this.weapsDirty = true;
        }

        this.invManager.set(
            "9mm_cursed",
            Math.max(0, this.hideAndSeekPropSwitchesLeft - 1),
        );
    }

    consumeHideAndSeekPropSwitch(): void {
        if (!isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;
        this.hideAndSeekPropSwitchesLeft = Math.max(
            0,
            this.hideAndSeekPropSwitchesLeft - 1,
        );

        const primary = this.weapons[GameConfig.WeaponSlot.Primary];
        if (primary.type === "prop_o_matic") {
            primary.ammo = 0;
            this.weapsDirty = true;
            this.weaponManager.scheduledReload = this.hideAndSeekPropSwitchesLeft > 0;
        }

        this.invManager.set("9mm_cursed", this.hideAndSeekPropSwitchesLeft);
    }

    private getInfectedZombieGroup(): Group | undefined {
        return this.game.playerBarn.groups.find((group) =>
            group.players.some((p) => isInfectedZombie(this.game.miniGame, p.arenaTeam)),
        );
    }

    private applyInfectedLoadout(): void {
        const settings = getInfectedSettings(this.game.miniGame);
        if (!settings) return;

        for (let i = 0; i < GameConfig.WeaponSlot.Count; i++) {
            const type = i === GameConfig.WeaponSlot.Melee ? "fists" : "";
            this.weaponManager.setWeapon(i, type, 0);
            this.setDisplayWeaponType(i, type);
        }

        if (this.arenaTeam === settings.humanTeam) {
            const gunDef = GameObjectDefs[settings.humanPrimaryWeapon] as GunDef;
            this.weaponManager.setWeapon(
                GameConfig.WeaponSlot.Primary,
                settings.humanPrimaryWeapon,
                gunDef.maxClip,
            );
            this.setDisplayWeaponType(
                GameConfig.WeaponSlot.Primary,
                settings.humanPrimaryWeapon,
            );
        }

        this.invManager.wipeInventory();
        this.invManager.set("1xscope", 1);
        this.scope = "1xscope";
        this.zoom = this.scopeZoomRadius[this.scope];
        this.chest = "chest01";
        this.helmet = "helmet01";
        this.backpack = "backpack01";
        this.setOutfit(
            this.arenaTeam === settings.zombieTeam
                ? settings.zombieOutfit
                : settings.humanOutfit,
        );
        this.infectedHumanNoiseTicker =
            this.arenaTeam === settings.humanTeam ? settings.humanNoiseInterval : 0;

        for (const perk of [...this.perks]) {
            this.removePerk(perk.type);
        }
        if (this.arenaTeam === settings.humanTeam) {
            this.addPerk("endless_ammo", false);
        }

        this.weaponManager.setCurWeapIndex(
            this.arenaTeam === settings.humanTeam
                ? GameConfig.WeaponSlot.Primary
                : GameConfig.WeaponSlot.Melee,
        );
        this.weaponManager.showNextThrowable();
        this.recalculateScale();
        this.recalculateMinBoost();
        this.inventoryDirty = true;
        this.weapsDirty = true;
    }

    private applyAmongUsLoadout(): void {
        if (!isAmongUsMiniGame(this.game.miniGame) && !this.game.map.amongUsMode) {
            return;
        }

        const amongUsMelee = "karambit";
        this.loadout.melee = amongUsMelee;
        this.meleeSkin = amongUsMelee;

        for (let i = 0; i < GameConfig.WeaponSlot.Count; i++) {
            const type = i === GameConfig.WeaponSlot.Melee ? amongUsMelee : "";
            this.weaponManager.setWeapon(i, type, 0);
            this.setDisplayWeaponType(i, type);
        }

        this.invManager.emptyAll();
        this.invManager.set("1xscope", 1);
        this.scope = "1xscope";
        this.zoom = this.scopeZoomRadius[this.scope];

        for (const perk of [...this.perks]) {
            this.removePerk(perk.type);
        }

        this.streakReady = false;
        this.streakActive = false;
        this.streakDirty = true;
        this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee);
        this.weaponManager.showNextThrowable();
        this.recalculateScale();
        this.recalculateMinBoost();
        this.inventoryDirty = true;
        this.weapsDirty = true;
    }

    moveToAmongUsMeeting(pos: Vec2): void {
        this.cancelAction();
        this.shootHold = false;
        this.shootStart = false;
        this.layer = 0;
        v2.set(this.pos, pos);
        this.collider.pos = this.pos;
        this.game.grid.updateObject(this);
        this.setDirty();
    }

    getPlayerInfoFor(viewer: Player): PlayerInfo {
        const amongUsMode =
            isAmongUsMiniGame(this.game.miniGame) || this.game.map.amongUsMode;
        const canSeeAmongUsRole =
            amongUsMode &&
            (this === viewer ||
                (viewer.amongUsRole === "impostor" && this.amongUsRole === "impostor"));

        return {
            playerId: this.playerId,
            teamId: this.teamId,
            groupId: this.groupId,
            name: this.name,
            clanName: this.clanName,
            clanTagColor: this.clanTagColor,
            amongUsRole: canSeeAmongUsRole ? this.amongUsRole : "",
            loadout: {
                outfit: this.loadout.outfit,
                heal: this.loadout.heal,
                boost: this.loadout.boost,
                death_effect: this.loadout.death_effect,
            },
        };
    }

    markPlayerInfoDirty(): void {
        if (!this.game.playerBarn.dirtyPlayerInfos.includes(this)) {
            this.game.playerBarn.dirtyPlayerInfos.push(this);
        }
    }

    private getInfectedKillCreditSource(params: DamageParams): Player | undefined {
        const killCreditSource =
            params.killCreditSource?.__type === ObjectType.Player
                ? (params.killCreditSource as Player)
                : params.source?.__type === ObjectType.Player
                  ? (params.source as Player)
                  : undefined;

        return killCreditSource && killCreditSource !== this
            ? killCreditSource
            : undefined;
    }

    private creditInfectedKill(params: DamageParams): Player | undefined {
        const killCreditSource = this.getInfectedKillCreditSource(params);
        if (!killCreditSource) return undefined;

        this.trackWeaponStat(
            this.weaponDeaths,
            params.weaponSourceType ?? params.gameSourceType,
        );
        killCreditSource.killedIds.push(this.matchDataId);
        killCreditSource.kills++;
        killCreditSource.trackWeaponKill(params.gameSourceType);
        killCreditSource.questManager.trackEvent("kill", {
            weaponType: params.gameSourceType ?? "",
            buildingType: killCreditSource.currentBuildingType,
        });

        const leaderboardKey = killCreditSource.getLeaderboardKey();
        const original = this.game.leaderboard.get(leaderboardKey) ?? {
            name: killCreditSource.name,
            kills: killCreditSource.kills - 1,
        };
        this.game.leaderboard.set(leaderboardKey, {
            ...original,
            kills: original.kills + 1,
        });

        if (!isBattleRoyaleMapName(this.game.mapName)) {
            this.game.broadcastMsg(
                net.MsgType.Leaderboard,
                this.getKillsLeaderboardMsg(),
            );
        }

        return killCreditSource;
    }

    private broadcastInfectedKill(params: DamageParams, killCreditSource?: Player): void {
        const killMsg = new net.KillMsg();
        killMsg.damageType = params.damageType;
        killMsg.itemSourceType = params.gameSourceType ?? "";
        killMsg.mapSourceType = params.mapSourceType ?? "";
        killMsg.targetId = this.__id;
        killMsg.killed = true;
        if (params.source?.__type === ObjectType.Player) {
            killMsg.killerId = params.source.__id;
        }
        if (killCreditSource) {
            killMsg.killCreditId = killCreditSource.__id;
            killMsg.killerKills = killCreditSource.kills;
            this.killedBy = killCreditSource;
        }
        this.game.broadcastMsg(net.MsgType.Kill, killMsg);
    }

    private infectHuman(params: DamageParams): void {
        const settings = getInfectedSettings(this.game.miniGame);
        if (!settings) return;

        const killCreditSource = this.creditInfectedKill(params);
        this.broadcastInfectedKill(params, killCreditSource);

        const zombieGroup = this.getInfectedZombieGroup();
        this.arenaTeam = settings.zombieTeam;
        if (zombieGroup && this.group !== zombieGroup) {
            this.group?.removePlayer(this);
            zombieGroup.addPlayer(this);
        } else if (killCreditSource) {
            this.groupId = killCreditSource.groupId;
            this.teamId = killCreditSource.teamId;
        }

        this.health = GameConfig.player.health;
        this.boost = 0;
        this.downed = false;
        this.downedBy = undefined;
        this.cancelAction();
        this.applyInfectedLoadout();
        this.setDirty();
        this.setGroupStatuses();
        this.markPlayerInfoDirty();
        this.game.playerBarn.aliveCountDirty = true;
        this.game.updateData();
        this.game.checkGameOver();
    }

    private killZombieForRespawn(params: DamageParams): void {
        const settings = getInfectedSettings(this.game.miniGame);
        if (!settings) return;

        const killCreditSource = this.creditInfectedKill(params);
        this.broadcastInfectedKill(params, killCreditSource);

        this.dead = true;
        this.infectedRespawnTicker = settings.zombieRespawnCooldown;
        this.killedIndex = this.game.playerBarn.nextKilledNumber++;
        this.health = 0;
        this.boost = 0;
        this.cancelAction();
        this.shootHold = false;
        this.shootStart = false;
        this.spectating = undefined;
        this.mapIndicator?.kill();
        this.mapIndicator = undefined;
        util.removeFrom(this.game.playerBarn.livingPlayers, this);
        this.group?.checkPlayers();
        this.team?.checkPlayers();
        this.game.playerBarn.aliveCountDirty = true;
        this.game.modeManager.assignNewSpectate(this);
        this.game.deadBodyBarn.addDeadBody(this.pos, this.__id, this.layer, params.dir);
        this.obstacleOutfit?.kill(params);
        this.propDisguise?.kill(params);
        this.obstacleOutfit = undefined;
        this.propDisguise = undefined;
        this.setDirty();
        this.setGroupStatuses();
        this.game.updateData();
        this.game.checkGameOver();
    }

    private handleInfectedFatalDamage(params: DamageParams): boolean {
        if (!getInfectedSettings(this.game.miniGame)) return false;
        const playerSource = this.getInfectedKillCreditSource(params);

        if (
            isInfectedHuman(this.game.miniGame, this.arenaTeam) &&
            isInfectedZombie(this.game.miniGame, playerSource?.arenaTeam)
        ) {
            this.infectHuman(params);
            return true;
        }

        if (
            isInfectedZombie(this.game.miniGame, this.arenaTeam) &&
            isInfectedHuman(this.game.miniGame, playerSource?.arenaTeam)
        ) {
            this.killZombieForRespawn(params);
            return true;
        }

        return false;
    }

    respawnInfectedZombie(): void {
        if (!isInfectedZombie(this.game.miniGame, this.arenaTeam)) return;

        this.dead = false;
        this.infectedRespawnTicker = 0;
        this.health = GameConfig.player.health;
        this.boost = 0;
        this.spectating = undefined;
        this.sentDeathEmote = false;
        this.sendDeathEmoteTicker = 0;
        this.layer = 0;
        v2.set(this.pos, this.game.map.getSpawnPos());
        this.collider.pos = this.pos;
        this.applyInfectedLoadout();
        this.createObstacleOutfit();

        this.game.playerBarn.livingPlayers.push(this);
        if (this.group && !this.group.livingPlayers.includes(this)) {
            this.group.livingPlayers.push(this);
            this.group.allDeadOrDisconnected = false;
        }
        if (this.team && !this.team.livingPlayers.includes(this)) {
            this.team.livingPlayers.push(this);
            this.team.allDeadOrDisconnected = false;
        }
        if (!this.game.modeManager.isSolo) {
            this.game.playerBarn.livingPlayers.sort((a, b) => a.teamId - b.teamId);
        }

        this.game.grid.updateObject(this);
        this.game.playerBarn.aliveCountDirty = true;
        this.setDirty();
        this.setGroupStatuses();
        this.game.updateData();
    }

    punishHideAndSeekWrongPropHit(): void {
        const settings = getHideAndSeekSettings(this.game.miniGame);
        if (!settings || this.arenaTeam !== settings.seekerTeam) return;
        if (this.hideAndSeekWrongPropDamageCooldown > 0) return;

        this.hideAndSeekWrongPropDamageCooldown = settings.seekerWrongPropDamageCooldown;
        this.damage({
            amount: settings.seekerWrongPropDamage,
            damageType: GameConfig.DamageType.Player,
            gameSourceType: "prop_o_matic",
            weaponSourceType: "prop_o_matic",
            dir: v2.create(0, 0),
        });
    }

    hasActivePan() {
        return (
            this.wearingPan ||
            (this.activeWeapon == "pan" && this.animType !== GameConfig.Anim.Melee)
        );
    }

    getLasrSwrdReflectArea() {
        const meleeDef = GameObjectDefs[this.activeWeapon] as MeleeDef;
        if (!meleeDef.reflectArea) {
            return collider.createCircle(this.pos, 0);
        }
        const ang = Math.atan2(this.dir.y, this.dir.x);
        const off = v2.add(
            meleeDef.reflectArea.offset,
            v2.mul(v2.create(1, 0), this.scale - 1),
        );
        const pos = v2.add(this.pos, v2.rotate(off, ang));
        const rad = meleeDef.reflectArea.rad;
        return collider.createCircle(pos, rad);
    }

    getPanSegment() {
        const panSurface = this.wearingPan ? "unequipped" : "equipped";
        let surface = (GameObjectDefs.pan as MeleeDef).reflectSurface![panSurface];

        const scale = this.scale;

        if (scale !== 1) {
            if (panSurface === "unequipped") {
                surface = {
                    p0: v2.mul(surface.p0, scale),
                    p1: v2.mul(surface.p1, scale),
                };
            } else {
                const s = (scale - 1) * 0.75;
                const off = v2.create(s, -s);
                surface = {
                    p0: v2.add(surface.p0, off),
                    p1: v2.add(surface.p1, off),
                };
            }
        }

        return surface;
    }

    socketId: string;

    ack = 0;

    name: string;
    isMobile: boolean;

    bot: boolean;

    debug = {
        zoomEnabled: false,
        zoom: 1,

        speedEnabled: false,
        speed: 1,

        noClip: false,
        teleportToPings: false,
        invisible: false,
        godMode: false,
        infiniteThrowables: false,
        throwFast: false,
        shootFast: false,
        punchFast: false,

        /** drag and drop loot, obstacles, and buildings */
        moveObjMode: <MoveObjsMode>{
            enabled: false,
            /** object you're currently dragging */
            selectedObj: undefined,
            /** original position of the selected obj */
            originalPos: undefined,
            /** mouse position when obj first selected */
            selectPos: undefined,
        },
    };

    teamId = 1;
    groupId = 0;

    loadout = {
        melee: "fists",
        heal: "heal_basic",
        outfit: "outfitBase",
        primary: "spas12",
        secondary: "mosin",
        boost: "boost_basic",
        death_effect: "death_basic",
        streak: "streak_rapid_fire",
        perk: "quick_reload",
        emotes: [...GameConfig.defaultEmoteLoadout],
    };

    emoteSoftTicker = 0;
    emoteHardTicker = 0;
    emoteCounter = 0;

    damageTaken = 0;
    damageDealt = 0;
    currentBuildingType = "";
    questManager = new QuestManager(this);

    chosenStreakType = DefaultStreakType;
    streakActivationCount = 0;
    streakReady = false;
    streakActive = false;
    streakActiveTimer = 0;
    streakSavedWeapon: { slot: number; type: string; ammo: number } | null = null;
    streakGunSlot: number = -1;
    streakDirty = true;
    hideAndSeekBlindTicker = 0;
    hideAndSeekBlindDirty = false;
    hideAndSeekWrongPropDamageCooldown = 0;
    hideAndSeekPropSwitchesLeft = 0;
    hideAndSeekNoiseTicker = 0;
    infectedHumanNoiseTicker = 0;
    get hideAndSeekBlindTime(): number {
        return this.hideAndSeekBlindTicker;
    }
    get hideAndSeekHunterReleaseTime(): number {
        const settings = getHideAndSeekSettings(this.game.miniGame);
        if (!settings || !this.game.started) return 0;
        return Math.max(0, settings.hunterReleaseDelay - this.game.startedTime);
    }
    get hideAndSeekHunterReleaseSeeker(): boolean {
        return isHideAndSeekSeeker(this.game.miniGame, this.arenaTeam);
    }
    get hideAndSeekHunterReleaseLocked(): boolean {
        return (
            this.hideAndSeekHunterReleaseSeeker && this.hideAndSeekHunterReleaseTime > 0
        );
    }
    get infectedRespawnTime(): number {
        return this.infectedRespawnTicker;
    }
    get miniGameWinCountdownTime(): number {
        if (
            !this.game.started ||
            this.game.over ||
            this.game.gas.mode !== GasMode.Waiting
        ) {
            return 0;
        }
        if (
            !getInfectedSettings(this.game.miniGame) &&
            !getHideAndSeekSettings(this.game.miniGame)
        ) {
            return 0;
        }

        const timeLeft = this.game.gas.getTimeUntilNextStage();
        return timeLeft > 0 && timeLeft <= 5 ? timeLeft : 0;
    }
    get miniGameWinCountdownProps(): boolean {
        return !!getHideAndSeekSettings(this.game.miniGame);
    }
    get amongUsKillCooldownTime(): number {
        if (
            !this.game.map.amongUsMode ||
            this.amongUsRole !== "impostor" ||
            this.dead ||
            this.disconnected
        ) {
            return 0;
        }
        return this.amongUsKillCooldownTicker;
    }
    get amongUsEmergencyMeetingSeq(): number {
        return this.game.playerBarn.amongUsEmergencyMeetingSeq;
    }
    get amongUsEmergencyCallCooldownTime(): number {
        if (!this.game.map.amongUsMode || this.dead || this.disconnected) {
            return 0;
        }
        return math.max(0, amongUsEmergencyCallCooldown - this.game.startedTime);
    }
    get amongUsEmergencyCallsRemaining(): number {
        if (!this.game.map.amongUsMode || this.dead || this.disconnected) {
            return 0;
        }
        return math.max(0, 1 - this.amongUsEmergencyCallsUsed);
    }
    get streakNextThreshold(): number {
        return StreakThresholds.get(this.streakActivationCount);
    }
    get streakDamageDealt(): number {
        return this.damageDealt;
    }
    get activeStreakActive(): boolean {
        return this.streakActive;
    }
    get activeStreakTimeLeft(): number {
        return this.streakActiveTimer;
    }

    resetAmongUsKillCooldown() {
        this.amongUsKillCooldownTicker = amongUsInitialKillCooldown;
    }

    // infinity since we aren't dead yet ;)
    // this is used for sorting and getting player ranks
    // first player to die is 0, second is 1 etc
    killedIndex = Infinity;

    kills = 0;
    weaponKills: Record<string, number> = {};
    weaponDeaths: Record<string, number> = {};
    weaponDamageDealt: Record<string, number> = {};
    weaponDamageTaken: Record<string, number> = {};

    private trackWeaponStat(
        stats: Record<string, number>,
        weaponType: string | undefined,
        amount = 1,
    ): void {
        if (!weaponType) return;
        stats[weaponType] = (stats[weaponType] ?? 0) + amount;
    }

    private trackWeaponKill(weaponType?: string): void {
        this.trackWeaponStat(this.weaponKills, weaponType);
    }
    timeAlive = 0;
    pickedUpLoot = false;
    lostHealth = false;

    msgsToSend: Array<{ type: number; msg: net.Msg }> = [];

    amongUsRole: AmongUsRole | "" = "";
    amongUsKillCooldownTicker = 0;
    amongUsEmergencyCallsUsed = 0;

    weaponManager = new WeaponManager(this);
    recoilTicker = 0;

    // to disable auto pickup for some seconds after dropping something
    mobileDropTicker = 0;

    obstacleOutfit?: Obstacle;
    propDisguise?: Obstacle | Decal | Loot;

    /**
     * Only used for match data saving!
     * __id is for the game itself, __id can be reused when a player despawns
     * which can break the matchData
     */
    matchDataId: number;

    userId: string | null = null;
    clanName = "";
    clanTagColor = "";
    canUseDeveloper = false;
    ip: string;
    encodedIp: string;
    // see comment on server/src/api/schema.ts
    // about logging find_game IP's
    findGameIp: string;
    findGameEncodedIp: string;

    getLeaderboardKey() {
        return this.userId ? `user:${this.userId}` : `ip:${this.encodedIp}`;
    }

    constructor(
        game: Game,
        pos: Vec2,
        layer: number,
        name: string,
        socketId: string,
        joinMsg: net.JoinMsg,
        ip: string,
        findGameIp: string,
        userId: string | null,
        clanName: string | null | undefined,
        clanTagColor: string | null | undefined,
        canUseDeveloper = false,
        loadout?: Loadout,
        public arenaTeam?: "A" | "B",
        questIds?: string[],
    ) {
        super(game, pos);

        this.matchDataId = game.playerBarn.nextMatchDataId++;

        this.layer = layer;

        this.name = name;
        this.socketId = socketId;
        this.ip = ip;
        this.findGameIp = findGameIp;
        this.encodedIp = hashIp(ip);
        this.findGameEncodedIp = hashIp(findGameIp);
        this.userId = userId;
        this.clanName = joinMsg.showClanTag ? clanName?.trim() || "" : "";
        this.clanTagColor = joinMsg.showClanTag ? clanTagColor?.trim() || "" : "";
        this.canUseDeveloper = canUseDeveloper;

        this.questManager.quests = (questIds ?? []).map((id) => ({ id, delta: 0 }));

        this.isMobile = joinMsg.isMobile;

        this.weapons = this.weaponManager.weapons;

        this.bot = Config.debug.allowBots && joinMsg.bot;

        let defaultItems = isBattleRoyaleMapName(this.game.mapName)
            ? BattleRoyaleDefaultItems
            : GameConfig.player.defaultItems;

        if (!this.bot && !isBattleRoyaleMapName(this.game.mapName)) {
            defaultItems = this.game.playerBarn.defaultItems;
        }

        // createCircle clones the position
        // so set it manually to link both
        this.collider = collider.createCircle(this.pos, this.rad);
        this.collider.pos = this.pos;

        this.scopeZoomRadius =
            GameConfig.scopeZoomRadius[this.isMobile ? "mobile" : "desktop"];

        this.zoom = this.scopeZoomRadius[this.scope];

        function assertType(type: string, category: string, acceptNoItem: boolean) {
            if (!type && acceptNoItem) return;
            const def = GameObjectDefs[type];
            assert(def, `Invalid item type for ${category}: ${type}`);
            assert(
                def.type === category,
                `Invalid type ${type}, expected ${category} item`,
            );
        }

        for (let i = 0; i < GameConfig.WeaponSlot.Count; i++) {
            const weap = defaultItems.weapons[i];
            let type = weap.type || this.weapons[i].type;
            if (!type) continue;
            assertType(type, GameConfig.WeaponType[i], true);
            this.weaponManager.setWeapon(i, type, weap.ammo ?? 0);
        }

        this.chest = defaultItems.chest;
        assertType(this.chest, "chest", true);

        this.scope = defaultItems.scope;
        assertType(this.scope, "scope", false);
        this.invManager.set(this.scope as InventoryItem, 1);

        this.helmet = defaultItems.helmet;
        assertType(this.helmet, "helmet", true);

        this.backpack = defaultItems.backpack;
        assertType(this.backpack, "backpack", false);

        this.outfit = defaultItems.outfit;
        assertType(this.outfit, "outfit", false);

        for (const perk of defaultItems.perks) {
            assertType(perk.type, "perk", false);
            this.addPerk(perk.type, perk.droppable);
        }

        for (const [item, amount] of Object.entries(defaultItems.inventory)) {
            this.invManager.set(item as InventoryItem, amount);
        }

        this.setLoadout(loadout ? loadout : joinMsg.loadout, !loadout);
        if (getInfectedSettings(this.game.miniGame)) {
            this.applyInfectedLoadout();
        } else if (isAmongUsMiniGame(this.game.miniGame) || this.game.map.amongUsMode) {
            this.applyAmongUsLoadout();
        }

        if (this.game.map.sniperMode) {
            this.invManager.give("2xscope", 1);
        }

        this.weaponManager.showNextThrowable();
        this.recalculateScale();

        this.logPlayerIp();
        this._cullingZoom = this.zoom;
    }

    update(dt: number): void {
        if (this.dead) {
            this.spectateCooldown -= dt;
            if (this.infectedRespawnTicker > 0) {
                this.infectedRespawnTicker = Math.max(0, this.infectedRespawnTicker - dt);
                if (this.infectedRespawnTicker <= 0) {
                    this.respawnInfectedZombie();
                    return;
                }
            }

            if (this.spectateMsgCount > 0) {
                this.spectateMsgTicker += dt;
                if (this.spectateMsgTicker > 3) {
                    this.spectateMsgCount--;
                    this.spectateMsgTicker = 0;
                }
            }

            if (!this.sentDeathEmote) {
                this.sendDeathEmoteTicker -= dt;
                if (this.sendDeathEmoteTicker <= 0) {
                    this.emoteFromSlot(EmoteSlot.Death);
                    this.sentDeathEmote = true;
                }
            }
            return;
        }

        this.timeAlive += dt;

        if (
            this.game.map.amongUsMode &&
            this.amongUsRole === "impostor" &&
            !this.game.playerBarn.isAmongUsMeetingLocked
        ) {
            this.amongUsKillCooldownTicker = math.max(
                0,
                this.amongUsKillCooldownTicker - dt,
            );
        }

        this.updateStreaks(dt);
        this.updateHideAndSeek(dt);
        this.updateInfected(dt);

        if (this.game.map.factionMode && this.timeUntilHidden > 0) {
            this.timeUntilHidden -= dt;
            if (this.timeUntilHidden < 0) {
                this.playerStatusDirty = true;
            }
        }

        if (this.role === "leader" && !this.hasFiredFlare && this.flareTimer > 0) {
            this.flareTimer -= dt;
            if (this.flareTimer <= 0) {
                const flareGunIndex = this.weapons.findIndex(
                    (w) => w.type === "flare_gun" || w.type === "flare_gun_dual",
                );
                if (flareGunIndex !== -1) {
                    this.weaponManager.setCurWeapIndex(flareGunIndex);
                    this.weaponManager.fireWeapon(false, true);
                    this.hasFiredFlare = true;
                    this.flareTimer = 0;
                    // go back to melee if we fired while downed lol
                    if (this.downed) {
                        this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee);
                    }
                }
            }
        }

        if (this.roleMenuTicker > 0) {
            this.roleMenuTicker -= dt;
            if (this.roleMenuTicker <= 0) {
                this.roleMenuTicker = 0;
                const roleChoices = this.game.map.mapDef.gameMode.perkModeRoles!;
                const randomRole = roleChoices[util.randomInt(0, roleChoices.length - 1)];
                this.roleSelect(randomRole);
            }
        }

        // players are still choosing a perk from the perk select menu
        if (this.game.map.perkMode && !this.role) return;

        //
        // Direction
        //
        this.dirOld = v2.copy(this.dir);

        if (!v2.eq(this.dir, this.dirNew)) {
            this.dir = this.dirNew;
            this.setPartDirty();
        }
        this.mousePos = v2.add(this.pos, v2.mul(this.dir, this.toMouseLen));

        //
        // Boost logic
        //
        if (!this.downed) {
            this.boost = math.clamp(this.boost, this.minBoost, 100);

            if (this.boost > 0) {
                let healAmount = boostHeals.findLast((b, i) => {
                    const prev = boostHeals[i - 1]?.maxBoost ?? 0;
                    return this.boost >= prev && this.boost <= b.maxBoost;
                });

                const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
                const canHealFromAdrenaline =
                    !hideAndSeekSettings ||
                    this.arenaTeam !== hideAndSeekSettings.seekerTeam ||
                    hideAndSeekSettings.seekerAdrenalineHeals;
                if (canHealFromAdrenaline) {
                    this.health += healAmount!.heal * dt;
                }

                if (this.boost > this.minBoost) {
                    this.boost -= GameConfig.player.boostDecay * dt;
                }
            }
        } else {
            this.boost = 0;
        }

        // only set to dirty if it changed enough from last time we sent it
        // since it only uses 8 bits the precision is really low and sending it every tick is a waste
        if (!math.eqAbs(this.lastBoost, this.boost, 0.1)) {
            this.lastBoost = this.boost;
            this.boostDirty = true;
        }

        if (this.hasPerk("gotw")) {
            this.health += PerkProperties.gotw.healthRegen * dt;
        }

        //
        // Action logic
        //
        if (this.isReviving() || this.isBeingRevived()) {
            // cancel revive if either player goes out of range or if player being revived dies
            if (
                this.playerBeingRevived &&
                (v2.distance(this.pos, this.playerBeingRevived.pos) >
                    GameConfig.player.reviveRange ||
                    this.playerBeingRevived.dead)
            ) {
                this.cancelAction();
            }
        }

        if (this.downedDamageTicker > 0) {
            this.downedDamageTicker -= dt;

            if (this.downedDamageTicker <= 0) {
                this.downedDamageTicker = 0;
            }
        }

        //
        // Emote cooldown
        //

        this.emoteSoftTicker -= dt;
        if (
            this.emoteCounter >= GameConfig.player.emoteThreshold &&
            this.emoteHardTicker > 0.0
        ) {
            this.emoteHardTicker -= dt;
            if (this.emoteHardTicker < 0.0) {
                this.emoteCounter = 0;
            }
        } else if (this.emoteSoftTicker < 0.0 && this.emoteCounter > 0) {
            this.emoteCounter--;
            this.emoteSoftTicker = GameConfig.player.emoteSoftCooldown * 1.5;
        }

        // Take bleeding damage
        this.bleedTicker -= dt;
        if (
            ((this.downed && this.actionType == GameConfig.Action.None) ||
                this.hasPerk("trick_drain")) &&
            this.bleedTicker < 0
        ) {
            const hasDrain = this.hasPerk("trick_drain");
            this.bleedTicker = hasDrain
                ? GameConfig.player.bleedTickRate * 3
                : GameConfig.player.bleedTickRate;

            const mapConfig = this.game.map.mapDef.gameConfig;

            const bleedDamageMult = mapConfig.bleedDamageMult;

            const multiplier =
                bleedDamageMult != 1 ? this.downedCount * bleedDamageMult : 1;

            let damage = hasDrain ? 1 : mapConfig.bleedDamage * multiplier;
            this.damage({
                amount: damage,
                damageType: GameConfig.DamageType.Bleeding,
                dir: this.dir,
            });
            // don't continue the update if we died
            if (this.dead) {
                return;
            }
        }

        this.chattyTicker -= dt;

        if (this.hasPerk("trick_chatty") && this.chattyTicker < 0) {
            this.chattyTicker = util.random(5, 15);

            const emotes = Object.keys(EmotesDefs);

            this.game.playerBarn.addEmote(
                emotes[Math.floor(Math.random() * emotes.length)],
                this.__id,
            );
        }

        if (this.game.gas.doDamage && this.game.gas.isInGas(this.pos)) {
            this.damage({
                amount: this.disconnected ? 22 : this.game.gas.damage,
                damageType: GameConfig.DamageType.Gas,
                dir: this.dir,
            });
            // don't continue the update if we died
            if (this.dead) {
                return;
            }
        }

        // Inferno mode: burn when walking on water (lava)
        {
            const isInferno = this.game.map.mapId === MapId.Inferno;
            const isOnLava = isInferno && this.game.map.isOnLava(this.pos, this.layer);
            const hasPhoenix = this.hasPerk("phoenix");

            if (isOnLava) {
                this.burnDuration = GameConfig.player.burnDuration;
            }

            const oldBurnEffect = this.burnEffect;

            if (this.burnDuration > 0) {
                this.burnDuration -= dt;
                this.burnTicker -= dt;
                this.burnEffect = true;

                if (hasPhoenix) {
                    if (this.burnTicker <= 0) {
                        this.burnTicker = GameConfig.player.burnTickRate;
                        const healAmt = PerkProperties.phoenix.healRate;
                        this.health += healAmt;
                    }
                } else {
                    if (this.burnTicker <= 0) {
                        this.burnTicker = GameConfig.player.burnTickRate;
                        this.damage({
                            amount: GameConfig.player.burnDamage,
                            damageType: GameConfig.DamageType.Burning,
                            dir: this.dir,
                        });
                    }
                }

                if (this.burnDuration <= 0) {
                    this.burnDuration = 0;
                    this.burnTicker = 0;
                    this.burnEffect = false;
                }
            } else {
                this.burnEffect = false;
            }
            if (hasPhoenix && !this.burnEffect && !isOnLava) {
                this.phoenixPassiveTicker -= dt;
                if (this.phoenixPassiveTicker <= 0) {
                    this.phoenixPassiveTicker = PerkProperties.phoenix.passiveTickRate;
                    this.damage({
                        amount: PerkProperties.phoenix.passiveDamage,
                        damageType: GameConfig.DamageType.Phoenix,
                        dir: this.dir,
                    });
                }
            } else if (hasPhoenix) {
                this.phoenixPassiveTicker = PerkProperties.phoenix.passiveTickRate;
            }

            if (oldBurnEffect !== this.burnEffect) {
                this.setDirty();
            }
        }

        // Nitro Lace timer
        {
            const oldNitroLace = this.nitroLaceEffect;
            if (this.nitroLaceDuration > 0) {
                this.nitroLaceDuration -= dt;
                this.nitroLaceEffect = true;
                this.nitroLaceDirty = true;

                if (this.nitroLaceDuration <= 0) {
                    this.nitroLaceDuration = 0;
                    this.nitroLaceEffect = false;
                    this.nitroLaceDirty = true;
                }
            }
            if (oldNitroLace !== this.nitroLaceEffect) {
                this.setDirty();
            }
        }

        if (this.reloadAgain && this.actionType !== GameConfig.Action.Revive) {
            this.reloadAgain = false;
            this.weaponManager.scheduledReload = true;
        }

        // handle heal and boost actions

        if (this.actionType !== GameConfig.Action.None) {
            this.action.time += dt;
            this.action.time = math.clamp(
                this.action.time,
                0,
                net.Constants.ActionMaxDuration,
            );

            if (this.action.time >= this.action.duration) {
                if (this.actionType === GameConfig.Action.UseItem) {
                    const itemDef = GameObjectDefs[this.actionItem] as HealDef | BoostDef;
                    if ("heal" in itemDef) {
                        this.applyActionFunc((target: Player) => {
                            target.health += itemDef.heal;
                        });
                    }
                    if ("boost" in itemDef) {
                        this.applyActionFunc((target: Player) => {
                            target.boost += itemDef.boost;
                        });
                    }
                    if (this.actionItem === "nitroLace") {
                        this.nitroLaceDuration = this.nitroLaceMaxDuration;
                        this.nitroLaceEffect = true;
                        this.nitroLaceDirty = true;
                        this.setDirty();
                    }
                    this.invManager.take(this.actionItem as InventoryItem, 1);
                    this.questManager.trackEvent("item_used", {
                        itemType: this.actionItem,
                    });
                } else if (this.isReloading()) {
                    this.weaponManager.reload();
                } else if (
                    this.actionType === GameConfig.Action.Revive &&
                    this.playerBeingRevived
                ) {
                    this.applyActionFunc((target: Player) => {
                        if (!target.downed) return;
                        target.downed = false;
                        target.downedBy = undefined;
                        target.downedDamageTicker = 0;
                        target.health = GameConfig.player.reviveHealth;

                        // checks 2 conditions in one, player has pan AND has it selected
                        if (target.weapons[target.curWeapIdx].type === "pan") {
                            target.wearingPan = false;
                        }

                        target.setDirty();
                        target.setGroupStatuses();
                        this.game.pluginManager.emit("playerRevived", target);
                    });
                }

                // Prevent cancelAction from being called by revived players at the end of revive
                if (!this.revivedBy || this.playerBeingRevived == this.revivedBy) {
                    this.cancelAction();
                }

                if (
                    (this.curWeapIdx == GameConfig.WeaponSlot.Primary ||
                        this.curWeapIdx == GameConfig.WeaponSlot.Secondary) &&
                    this.weapons[this.curWeapIdx].ammo == 0 &&
                    this.actionType !== GameConfig.Action.Revive
                ) {
                    this.weaponManager.scheduledReload = true;
                }
            }
        }

        //
        // Animation logic
        //
        if (this.animType !== GameConfig.Anim.None) {
            this._animTicker -= dt;

            if (this._animTicker <= 0) {
                this.animType = GameConfig.Anim.None;
                this._animTicker = 0;
                this.animSeq++;
                this.setDirty();
            }
        }

        //
        // Projectile slowdown logic
        //
        if (this.frozen) {
            this.frozenTicker -= dt;

            if (this.frozenTicker <= 0) {
                this.frozenTicker = 0;
                this.frozen = false;
                this.setDirty();
            }
        }

        //
        // Haste logic
        //
        if (this.hasteType != GameConfig.HasteType.None) {
            this._hasteTicker -= dt;

            if (this._hasteTicker <= 0) {
                this.hasteType = GameConfig.HasteType.None;
                this._hasteTicker = 0;
                this.hasteSeq++;
                this.setDirty();
            }
        }

        //
        // Last breath logic
        //
        if (this.lastBreathActive) {
            this._lastBreathTicker -= dt;

            if (this._lastBreathTicker <= 0) {
                this.lastBreathActive = false;
                this._lastBreathTicker = 0;

                this.recalculateScale();
            }
        }

        //
        // Bugler logic
        //
        if (this.bugleTickerActive) {
            this._bugleTicker -= dt;

            if (this._bugleTicker <= 0) {
                this.bugleTickerActive = false;
                this._bugleTicker = 0;

                const bugle = this.weapons.find((w) => w.type == "bugle");
                if (bugle) {
                    bugle.ammo++;
                    if (
                        bugle.ammo <
                        this.weaponManager.getAmmoStats(GameObjectDefs["bugle"] as GunDef)
                            .maxClip
                    ) {
                        this.bugleTickerActive = true;
                        this._bugleTicker = 8;
                    }
                }
                this.weapsDirty = true;
            }
        }

        if (this.hasPerk("fabricate")) {
            if (this.fabricateThrowablesLeft > 0) {
                this.fabricateGiveTicker -= dt;
                if (this.fabricateGiveTicker < 0) {
                    this.fabricateGiveTicker = PerkProperties.fabricate.giveInterval;
                    this.invManager.give("frag", 1);

                    this.fabricateThrowablesLeft--;

                    const msg = new net.PickupMsg();
                    msg.type = net.PickupMsgType.Success;
                    msg.item = "frag";
                    msg.count = 1;
                    if (
                        !this.weaponManager.weapons[GameConfig.WeaponSlot.Throwable].type
                    ) {
                        this.weaponManager.showNextThrowable();
                    }

                    this.msgsToSend.push({ type: net.MsgType.Pickup, msg });
                }
            }

            this.fabricateRefillTicker -= dt;
            if (this.fabricateRefillTicker <= 0) {
                const maxSize = this.invManager.getMaxCapacity("frag");
                const current = this.invManager.get("frag");
                const throwablesToGive = math.max(maxSize - current, 0);

                this.fabricateThrowablesLeft = throwablesToGive;
                this.fabricateGiveTicker = PerkProperties.fabricate.giveInterval;
                this.fabricateRefillTicker = PerkProperties.fabricate.refillInterval;
            }
        }

        if (this.fatModifier > 0) {
            this.fatTicker -= dt;
            if (this.fatTicker < 0) {
                this.fatModifier -= 0.2 * dt;
                this.fatModifier = math.max(0, this.fatModifier);
                this.recalculateScale();
            }
        }

        if (this.pullToSourcePos && this.pullToSourceTicker > 0) {
            this.pullToSourceTicker -= dt;
            const dir = v2.sub(this.pullToSourcePos, this.pos);
            const dist = v2.length(dir);
            if (dist > 0.5) {
                const pullDir = v2.normalize(dir);
                const pullDist = math.min(this.pullToSourceSpeed * dt, dist * 0.4);
                v2.set(this.pos, v2.add(this.pos, v2.mul(pullDir, pullDist)));
                this.setPartDirty();
                this.game.grid.updateObject(this);
            }
            if (this.pullToSourceTicker <= 0 || dist <= 0.4) {
                this.pullToSourcePos = null;
                this.pullToSourceTicker = 0;
            }
        }

        //
        // Calculate new speed, position and check for collision with obstacles
        //
        const movement = v2.create(0, 0);

        if (this.touchMoveActive && this.touchMoveLen) {
            movement.x = this.touchMoveDir.x;
            movement.y = this.touchMoveDir.y;
        } else {
            if (this.moveUp) movement.y++;
            if (this.moveDown) movement.y--;
            if (this.moveLeft) movement.x--;
            if (this.moveRight) movement.x++;

            if (movement.x * movement.y !== 0) {
                // If the product is non-zero, then both of the components must be non-zero
                movement.x *= Math.SQRT1_2;
                movement.y *= Math.SQRT1_2;
            }
        }

        this.posOld = v2.copy(this.pos);

        const hasTreeClimbing = this.hasPerk("tree_climbing");

        let steps: number;
        if (movement.x !== 0 || movement.y !== 0) {
            this.recalculateSpeed(hasTreeClimbing);
            steps = Math.round(math.max(this.speed * dt + 5, 5));
        } else {
            this.speed = 0;
            steps = 1;
        }
        this.moveVel = v2.mul(movement, this.speed);

        const speedToAdd = (this.speed / steps) * dt;

        const broadphaseRadius = math.max(
            GameConfig.player.maxVisualRadius * this.scale,
            this.getMovementBlockCircle().rad,
        );
        const circle = collider.createCircle(
            this.pos,
            broadphaseRadius + this.speed * dt,
        );

        const objs = this.game.grid.intersectCollider(circle);
        const syncSkinObstacles = () => {
            if (this.obstacleOutfit) {
                this.obstacleOutfit.pos = v2.copy(this.pos);
                this.obstacleOutfit.updateCollider();
            }
            if (this.propDisguise) {
                this.propDisguise.pos = v2.copy(this.pos);
                this.propDisguise.updateCollider();
            }
        };

        for (let i = 0; i < steps; i++) {
            v2.set(this.pos, v2.add(this.pos, v2.mul(movement, speedToAdd)));
            syncSkinObstacles();

            for (let j = 0; j < objs.length && !this.debug.noClip; j++) {
                const obj = objs[j];
                let collision:
                    | ReturnType<typeof coldet.intersectCircleCircle>
                    | ReturnType<typeof collider.intersectCircle> = null;

                if (obj.__type === ObjectType.Obstacle) {
                    if (!obj.collidable) continue;
                    if (obj.dead) continue;
                    if (!util.sameLayer(obj.layer, this.layer)) continue;
                    if (obj.isTree && hasTreeClimbing) continue;
                    if (obj.isSkin) continue;

                    collision = collider.intersectCircle(
                        obj.collider,
                        this.pos,
                        this.rad,
                    );
                } else {
                    continue;
                }

                if (collision) {
                    v2.set(
                        this.pos,
                        v2.add(this.pos, v2.mul(collision.dir, collision.pen + 0.001)),
                    );
                    syncSkinObstacles();
                }
            }

            for (
                let j = 0;
                j < this.game.playerBarn.livingPlayers.length && !this.debug.noClip;
                j++
            ) {
                const obj = this.game.playerBarn.livingPlayers[j];
                if (obj === this) continue;
                if (obj.dead || obj.downed) continue;
                if (!util.sameLayer(obj.layer, this.layer)) continue;

                let collision:
                    | ReturnType<typeof coldet.intersectCircleCircle>
                    | ReturnType<typeof collider.intersectCircle> = null;
                let collisionDirMult = 1;

                if (this.propDisguise && obj.propDisguise) {
                    continue;
                }
                if (this.propDisguise) {
                    if (movement.x === 0 && movement.y === 0) continue;

                    collision = collider.intersectCircle(
                        this.propDisguise.collider,
                        obj.pos,
                        obj.rad,
                    );
                    collisionDirMult = -1;
                } else if (obj.propDisguise) {
                    if (movement.x === 0 && movement.y === 0) continue;

                    collision = collider.intersectCircle(
                        obj.propDisguise.collider,
                        this.pos,
                        this.rad,
                    );
                } else {
                    continue;
                }

                if (collision) {
                    v2.set(
                        this.pos,
                        v2.add(
                            this.pos,
                            v2.mul(
                                collision.dir,
                                collisionDirMult * (collision.pen + 0.001),
                            ),
                        ),
                    );
                    syncSkinObstacles();
                }
            }
        }

        this.mapIndicator?.updatePosition(this.pos);

        // if we are the group leader and new players can still join the group
        // update the group spawn position to our current position every 1 second
        // if we are in a valid spawn position (not on water, inside a building, etc)
        if (
            this.group?.players[0] === this &&
            this.game.canJoin &&
            this.group.players.length < this.group.maxPlayers
        ) {
            this.group.spawnPositionTicker -= dt;

            if (this.group.spawnPositionTicker <= 0) {
                this.group.spawnPositionTicker = 1;

                if (this.game.map.canPlayerSpawn(this.pos)) {
                    this.group.spawnPosition = v2.copy(this.pos);
                }
            }
        }

        this.pickupTicker -= dt;

        //
        // Mobile auto interaction
        //
        this.mobileDropTicker -= dt;
        if (this.isMobile && this.mobileDropTicker <= 0 && !this.downed && !this.dead) {
            const closestLoot = this.getClosestLoot();

            if (closestLoot) {
                const itemDef = GameObjectDefs[closestLoot.type];
                switch (itemDef.type) {
                    case "gun":
                        const freeSlot = this.getFreeGunSlot(closestLoot);
                        if (
                            freeSlot.slot &&
                            freeSlot.slot !== this.curWeapIdx &&
                            !this.weapons[freeSlot.slot].type
                        ) {
                            this.pickupLoot(closestLoot);
                        }
                        break;
                    case "melee": {
                        if (this.weapons[GameConfig.WeaponSlot.Melee].type === "fists") {
                            this.pickupLoot(closestLoot);
                        }
                        break;
                    }
                    case "perk": {
                        /**
                         * Prevents mobile players from automatically picking up
                         * halloween perks. Additionally prevents them from auto-picking
                         * up perks if they already have a droppable perk.
                         *
                         * NOTE: This is a poor solution (idString checking) and should
                         * not be used as a precedent to allow more idString checking.
                         */
                        if (
                            closestLoot.type !== "halloween_mystery" &&
                            !this.perks.find((perk) => perk.droppable)
                        ) {
                            this.pickupLoot(closestLoot);
                        }
                        break;
                    }
                    case "outfit": {
                        break;
                    }
                    case "helmet":
                    case "chest":
                    case "backpack": {
                        const thisLevel = this.getGearLevel(this[itemDef.type]);
                        const thatLevel = this.getGearLevel(closestLoot.type);
                        if (thisLevel < thatLevel) {
                            this.pickupLoot(closestLoot);
                        }
                        break;
                    }
                    default:
                        if (
                            this.invManager.isValid(closestLoot.type) &&
                            this.invManager.get(closestLoot.type) >=
                                this.invManager.getMaxCapacity(closestLoot.type)
                        ) {
                            break;
                        }
                        this.pickupLoot(closestLoot);
                        break;
                }
            }

            const obstacles = this.getInteractableObstacles();
            for (let i = 0; i < obstacles.length; i++) {
                const obstacle = obstacles[i];
                if (obstacle.isDoor && obstacle.door && !obstacle.door.open) {
                    obstacle.interact(this);
                }
            }
        }

        //
        // Scope zoom, heal regions and and auto open doors logic
        //

        let finalZoom = this.scopeZoomRadius[this.scope];
        let lowestZoom = this.scopeZoomRadius["1xscope"];

        this.indoors = false;

        /*
         * checking when a player leaves a heal region is a pain,
         * so we just set healEffect to false by default and set it to true when theyre inside a heal region
         */
        const oldHealEffect = this.healEffect;
        this.healEffect = false;

        // Special handling for short ticker for throwable healing
        this.healEffectTicker -= dt;
        if (this.healEffectTicker > 0) {
            this.healEffect = true;
        }

        let zoomRegionZoom = lowestZoom;
        let insideNoZoomRegion = true;
        let insideSmoke = false;
        let poisonSmoke: Smoke | undefined;
        // building player is currently inside of
        let occupiedBuilding: Building | undefined;

        for (let i = 0; i < objs.length; i++) {
            const obj = objs[i];
            if (obj.__type === ObjectType.Building) {
                if (
                    !this.downed &&
                    obj.healRegions &&
                    util.sameLayer(this.layer, obj.layer) &&
                    !this.game.gas.isInGas(this.pos) // heal regions don't work in gas
                ) {
                    let totalHeal = 0;
                    const c = collider.createCircle(this.pos, 0.1);

                    for (let j = 0; j < obj.healRegions.length; j++) {
                        const hr = obj.healRegions[j];
                        if (coldet.test(c, hr.collision)) {
                            totalHeal += hr.healRate;
                        }
                    }

                    if (totalHeal) {
                        this.health += totalHeal * dt;
                        this.healEffect = true;
                    }
                }

                if (obj.ceilingDead) continue;

                // only check if layer is the same when not on stairs!
                if (this.layer < 2 && this.layer !== obj.layer) continue;

                for (let i = 0; i < obj.zoomRegions.length; i++) {
                    const zoomRegion = obj.zoomRegions[i];

                    if (
                        zoomRegion.zoomIn &&
                        coldet.testCircleAabb(
                            this.collider.pos,
                            this.collider.rad,
                            zoomRegion.zoomIn.min,
                            zoomRegion.zoomIn.max,
                        )
                    ) {
                        this.indoors = true;
                        this.insideZoomRegion = !zoomRegion.noZoom;
                        occupiedBuilding = obj;
                        insideNoZoomRegion = false;
                        if (zoomRegion.zoom) {
                            zoomRegionZoom = zoomRegion.zoom;
                        }
                    }

                    if (
                        zoomRegion.zoomOut &&
                        coldet.testCircleAabb(
                            this.collider.pos,
                            this.collider.rad,
                            zoomRegion.zoomOut.min,
                            zoomRegion.zoomOut.max,
                        )
                    ) {
                        insideNoZoomRegion = false;
                        if (this.insideZoomRegion) {
                            if (zoomRegion.zoom) {
                                zoomRegionZoom = zoomRegion.zoom;
                            }
                        }
                    }
                }
            } else if (obj.__type === ObjectType.Obstacle) {
                if (!util.sameLayer(this.layer, obj.layer)) continue;
                if (!obj.door || !obj.isDoor) continue;
                if (obj.door.locked) continue;
                if (!obj.door.autoOpen) continue;
                if (obj.door.open) continue;
                if (
                    obj.door.openOneWay &&
                    obj.getPlayerSide(this) !== obj.door.openOneWay
                )
                    continue;

                const res = collider.intersectCircle(
                    obj.collider,
                    this.pos,
                    this.rad + obj.interactionRad,
                );
                if (res) {
                    obj.interact(this, true);
                }
            } else if (obj.__type === ObjectType.Smoke) {
                if (!util.sameLayer(this.layer, obj.layer)) continue;
                if (coldet.testCircleCircle(this.pos, this.rad, obj.pos, obj.rad)) {
                    if (obj.isPoison) {
                        poisonSmoke = obj;
                        continue;
                    }
                    insideSmoke = true;
                }
            }
        }

        // guh, works for the club, might need testing for other buildings idk
        const parentStructureType = occupiedBuilding?.parentStructure
            ? (MapObjectDefs[occupiedBuilding.parentStructure.type] as StructureDef)
                  .structureType
            : undefined;
        this.currentBuildingType = parentStructureType ?? occupiedBuilding?.type ?? "";

        // only dirty if healEffect changed from last tick to current tick (leaving or entering a heal region)
        if (oldHealEffect != this.healEffect) {
            this.setDirty();
        }

        if (poisonSmoke) {
            this.poisonDuration = GameConfig.player.poisonDuration;
            this.poisonSource = poisonSmoke.source;
            this.poisonSourceTeamId = poisonSmoke.sourceTeamId;
        } else {
            this.poisonDuration = math.max(0, this.poisonDuration - dt);
        }

        const oldPoisonEffect = this.poisonEffect;
        this.poisonEffect = this.poisonDuration > 0;
        if (this.poisonEffect) {
            this.poisonTicker -= dt;
            if (this.poisonTicker <= 0) {
                this.poisonTicker = GameConfig.player.poisonTickRate;
                this.damage({
                    amount: GameConfig.player.poisonDamage,
                    damageType: GameConfig.DamageType.Gas,
                    dir: this.dir,
                    gameSourceType: "poison_gas",
                    source: this.poisonSource,
                    sourceTeamId: this.poisonSourceTeamId,
                });
            }
        } else {
            this.poisonTicker = 0;
            this.poisonSource = undefined;
            this.poisonSourceTeamId = undefined;
        }
        if (oldPoisonEffect !== this.poisonEffect) {
            this.setDirty();
        }

        if (this.insideZoomRegion) {
            finalZoom = zoomRegionZoom;
        }
        if (insideSmoke || this.downed) {
            finalZoom = lowestZoom;
        }
        if (this.debug.zoomEnabled) {
            this.zoom = this.debug.zoom;
        } else {
            this.zoom = finalZoom;
        }

        if (this._cullingZoom !== this.zoom) {
            this._cullingZoomTicker -= dt;
            if (this._cullingZoomTicker <= 0) {
                this._cullingZoom = this.zoom;
            }
        }
        if (this.portrait !== this._cullingPortrait) {
            this._cullingPortraitTicker -= dt;
            if (this._cullingPortraitTicker <= 0) {
                this._cullingPortrait = this.portrait;
            }
        }

        if (insideNoZoomRegion) {
            this.insideZoomRegion = false;
        }

        //
        // Calculate layer
        //
        const originalLayer = this.layer;
        const rot = Math.atan2(this.dir.y, this.dir.x);
        const ori = math.radToOri(rot);
        const stair = this.checkStairs(objs!, this.rad);
        if (stair) {
            if (ori === stair.downOri) {
                this.aimLayer = 3;
            } else if (ori === stair.upOri) {
                this.aimLayer = 2;
            } else {
                this.aimLayer = this.layer;
            }
        } else {
            this.aimLayer = this.layer;
        }
        if (this.layer !== originalLayer) {
            this.setDirty();

            if (this.obstacleOutfit) {
                this.obstacleOutfit.layer = this.layer;
                this.obstacleOutfit.setDirty();
            }
            if (this.propDisguise) {
                this.propDisguise.layer = this.layer;
                this.propDisguise.setDirty();
            }
        }

        //
        // Final position calculation: clamp to map bounds and set dirty if changed
        //
        this.game.map.clampToMapBounds(this.pos, this.rad);

        if (!v2.eq(this.pos, this.posOld)) {
            this.setPartDirty();
            this.game.grid.updateObject(this);

            //
            // Halloween obstacle skin
            //
            if (this.obstacleOutfit) {
                this.obstacleOutfit.pos = v2.copy(this.pos);
                this.obstacleOutfit.updateCollider();
                this.obstacleOutfit.setPartDirty();
            }
            if (this.propDisguise) {
                this.propDisguise.pos = v2.copy(this.pos);
                this.propDisguise.updateCollider();
                this.propDisguise.setPartDirty();
            }
        }

        //
        // Downed logic
        //
        if (this.downed) {
            this.distSinceLastCrawl += v2.distance(this.posOld, this.pos);

            if (this.animType === GameConfig.Anim.None && this.distSinceLastCrawl > 3) {
                let anim: number = GameConfig.Anim.CrawlForward;

                if (!v2.eq(this.dir, movement, 1)) {
                    anim = GameConfig.Anim.CrawlBackward;
                }

                this.playAnim(anim, GameConfig.player.crawlTime);
                this.distSinceLastCrawl = 0;
            }
        }

        if (this.debug.moveObjMode.enabled) this.moveObjUpdate(occupiedBuilding);

        //
        // Weapon stuff
        //
        this.weaponManager.update(dt);

        this.shotSlowdownTimer -= dt;
        if (this.shotSlowdownTimer <= 0) {
            this.shotSlowdownTimer = 0;
        }
        this.shootDisabledTimer -= dt;
        if (this.shootDisabledTimer <= 0) {
            this.shootDisabledTimer = 0;
        }
        this.lowHpSurgeTicker -= dt;
        if (this.lowHpSurgeTicker <= 0) {
            this.lowHpSurgeTicker = 0;
        }
    }

    moveObjUpdate(occupiedBuilding?: Building): void {
        if (!this.debug.moveObjMode.enabled) return;
        const mouseCollider = collider.createCircle(this.mousePos, 1);
        const childIds = occupiedBuilding
            ? new Set(occupiedBuilding.childObjects.map((o) => o.__id))
            : undefined;
        const hoveredObj = this.game.grid
            .intersectCollider(mouseCollider)
            .filter((o): o is Loot | Obstacle | Building => {
                if (
                    o.__type != ObjectType.Loot &&
                    o.__type != ObjectType.Obstacle &&
                    o.__type != ObjectType.Building
                )
                    return false;

                if (!util.sameLayer(o.layer, this.layer)) return false;
                if (o.__type == ObjectType.Obstacle && o.dead) return false;
                // if inside building, can only select one of its children
                if (this.indoors && !childIds?.has(o.__id)) return false;
                return true;
            })
            .find((o) => {
                const transformedBounds = collider.transform(o.bounds, o.pos, 0, 1);
                const aabb = collider.toAabb(transformedBounds);
                return coldet.testPointAabb(this.mousePos, aabb.min, aabb.max);
            });

        if (hoveredObj && this.shootStart) {
            this.debug.moveObjMode.selectedObj = hoveredObj;
            this.debug.moveObjMode.originalPos = v2.copy(
                this.debug.moveObjMode.selectedObj.pos,
            );
            this.debug.moveObjMode.selectPos = v2.copy(this.mousePos);
        }

        if (
            this.debug.moveObjMode.selectedObj &&
            this.debug.moveObjMode.selectPos &&
            this.debug.moveObjMode.originalPos
        ) {
            if (this.shootHold) {
                const deltaPos = v2.sub(this.mousePos, this.debug.moveObjMode.selectPos);
                const newPos = v2.add(this.debug.moveObjMode.originalPos, deltaPos);
                this.debug.moveObjMode.selectedObj.updatePos(newPos);
            } else {
                this.debug.moveObjMode.selectedObj.refresh();
                this.debug.moveObjMode.selectedObj = undefined;
                this.debug.moveObjMode.selectPos = undefined;
                this.debug.moveObjMode.originalPos = undefined;
            }
        }
    }

    private _firstUpdate = true;
    visibleObjects = new Set<GameObject>();
    visibleMapIndicators = new Set<MapIndicator>();

    isInvisibleTo(viewer: Player) {
        return this !== viewer && this.debug.invisible;
    }

    msgStream = new net.MsgStream(new ArrayBuffer(65536));
    sendMsgs(): void {
        const msgStream = this.msgStream;
        const game = this.game;
        const playerBarn = game.playerBarn;
        msgStream.stream.index = 0;

        if (this._firstUpdate) {
            const joinedMsg = new net.JoinedMsg();
            joinedMsg.teamMode = this.game.teamMode;
            joinedMsg.playerId = this.__id;
            joinedMsg.started = game.started;
            joinedMsg.arenaPrivate = this.game.arenaPrivate;
            joinedMsg.arenaCountdown = Math.ceil(this.game.arenaStartLockTimer);
            joinedMsg.teamMode = game.teamMode;
            joinedMsg.emotes = this.loadout.emotes;
            this.sendMsg(net.MsgType.Joined, joinedMsg);

            if (!isBattleRoyaleMapName(this.game.mapName)) {
                const leaderboardMsg = this.getKillsLeaderboardMsg();
                this.sendMsg(net.MsgType.Leaderboard, leaderboardMsg);
            }

            const mapStream = game.map.mapStream.stream;

            msgStream.stream.writeBytes(mapStream, 0, mapStream.byteIndex);
        }

        if (playerBarn.aliveCountDirty || this._firstUpdate) {
            const aliveMsg = new net.AliveCountsMsg();
            this.game.modeManager.updateAliveCounts(aliveMsg.teamAliveCounts);
            msgStream.serializeMsg(net.MsgType.AliveCounts, aliveMsg);
        }

        const updateMsg = new net.UpdateMsg();

        updateMsg.ack = this.ack;

        if (game.gas.dirty || this._firstUpdate) {
            updateMsg.gasDirty = true;
            updateMsg.gasData = game.gas;
        }

        if (game.gas.timeDirty || this._firstUpdate) {
            updateMsg.gasTDirty = true;
            updateMsg.gasT = game.gas.gasT;
        }

        let player: Player;
        if (
            this.spectatorOnly &&
            this.spectating == undefined &&
            playerBarn.livingPlayers.length > 0
        ) {
            this.spectating = playerBarn.randomPlayer(this);
        }

        if (this.spectating == undefined) {
            // not spectating anyone
            player = this;
        } else if (this.spectating.dead) {
            // was spectating someone but they died so find new player to spectate
            player =
                this.spectating.killedBy && !this.spectating.killedBy.dead
                    ? this.spectating.killedBy
                    : playerBarn.randomPlayer();
            if (player === this) {
                player = playerBarn.randomPlayer();
            }
            this.spectating = player;
        } else {
            // spectating someone currently who is still alive
            player = this.spectating;
        }
        // temporary guard while the spectating code is not fixed
        if (!player) {
            player = this;
        }

        const radius = player._cullingZoom + 4;
        let width = player._cullingZoom + 4;
        // client zoom tries to keep a 16/9 aspect ratio, mirror it here
        let height = width / (16 / 9);
        if (this._cullingPortrait) {
            let tmp = width;
            width = height;
            height = tmp;
        }
        const rect = collider.createAabbExtents(player.pos, v2.create(width, height));

        const newVisibleObjects = game.grid.intersectColliderSet(rect);
        for (const obj of newVisibleObjects) {
            if (obj.__type === ObjectType.Player && (obj as Player).isInvisibleTo(this)) {
                newVisibleObjects.delete(obj);
            }
        }
        if (game.map.amongUsMode) {
            this.addAmongUsCameraObjects(newVisibleObjects);
        }
        // client crashes if active player is not visible
        // so make sure its always added to visible objects
        newVisibleObjects.add(this);
        newVisibleObjects.add(player);

        for (const obj of this.visibleObjects) {
            if (!newVisibleObjects.has(obj)) {
                updateMsg.delObjIds.push(obj.__id);
            }
        }

        for (const obj of newVisibleObjects) {
            if (
                !this.visibleObjects.has(obj) ||
                game.objectRegister.dirtyFull[obj.__id]
            ) {
                updateMsg.fullObjects.push(obj);
            } else if (game.objectRegister.dirtyPart[obj.__id]) {
                updateMsg.partObjects.push(obj);
            }
        }

        this.visibleObjects = newVisibleObjects;

        updateMsg.activePlayerId = player.__id;
        if (this.startedSpectating) {
            updateMsg.activePlayerIdDirty = true;

            // build the active player data object manually
            // To avoid setting the spectating player fields to dirty
            updateMsg.activePlayerData = {
                healthDirty: true,
                health: player.health,
                boostDirty: true,
                boost: player.boost,
                zoomDirty: true,
                zoom: player.zoom,
                actionDirty: true,
                action: player.action,
                inventoryDirty: true,
                inventory: player.inventory,
                scope: player.scope,
                weapsDirty: true,
                curWeapIdx: player.curWeapIdx,
                weapons: player.getNetWeapons(),
                spectatorCountDirty: true,
                spectatorCount: player.spectatorCount,
                streakDirty: true,
                streakDamageDealt: player.damageDealt,
                streakNextThreshold: player.streakNextThreshold,
                streakReady: player.streakReady,
                activeStreakActive: player.streakActive,
                activeStreakTimeLeft: player.streakActiveTimer,
                nitroLaceDirty: true,
                nitroLacePercentage: player.nitroLacePercentage,
                hideAndSeekBlindDirty: true,
                hideAndSeekBlindTime: player.hideAndSeekBlindTicker,
                hideAndSeekHunterReleaseTime: player.hideAndSeekHunterReleaseTime,
                hideAndSeekHunterReleaseSeeker: player.hideAndSeekHunterReleaseSeeker,
                infectedRespawnTime: player.infectedRespawnTime,
                miniGameWinCountdownTime: player.miniGameWinCountdownTime,
                miniGameWinCountdownProps: player.miniGameWinCountdownProps,
                amongUsKillCooldownTime: player.amongUsKillCooldownTime,
                amongUsEmergencyCallCooldownTime: player.amongUsEmergencyCallCooldownTime,
                amongUsEmergencyCallsRemaining: player.amongUsEmergencyCallsRemaining,
                amongUsEmergencyMeetingSeq: player.amongUsEmergencyMeetingSeq,
            };
            this.startedSpectating = false;
        } else {
            updateMsg.activePlayerIdDirty = player.activeIdDirty;
            updateMsg.activePlayerData = player;
        }

        updateMsg.playerInfos = (
            this._firstUpdate
                ? playerBarn.players
                : [
                      ...playerBarn.newPlayers,
                      ...playerBarn.dirtyPlayerInfos.filter(
                          (p) => !playerBarn.newPlayers.includes(p),
                      ),
                  ]
        ).map((p) => p.getPlayerInfoFor(player));

        updateMsg.deletedPlayerIds = playerBarn.deletedPlayers;

        if (playerBarn.playerStatusTicker > playerBarn.playerStatusRate) {
            let statuses = player.getPlayerStatus();
            updateMsg.playerStatus = statuses;
            updateMsg.playerStatusDirty = true;
        }

        if (player.groupStatusDirty) {
            const teamPlayers = player.group!.players;

            let statuses: GroupStatus[] = [];
            for (const p of teamPlayers) {
                statuses.push({
                    health: p.health,
                    disconnected: p.disconnected,
                });
            }
            updateMsg.groupStatus = statuses;
            updateMsg.groupStatusDirty = true;
        }

        const shouldSendEmote = (emote: Emote) => {
            const emotePlayer = game.objectRegister.getById(emote.playerId) as
                | Player
                | undefined;

            const emoteDef = GameObjectDefs[emote.type];

            if (
                game.map.amongUsMode &&
                emote.isPing &&
                emoteDef.type === "ping" &&
                !emoteDef.mapEvent
            ) {
                return player.__id === emote.playerId;
            }

            if (emote.targetArenaTeam && player.arenaTeam !== emote.targetArenaTeam) {
                return false;
            }
            if (
                emote.targetArenaTeams &&
                (!player.arenaTeam || !emote.targetArenaTeams.includes(player.arenaTeam))
            ) {
                return false;
            }

            if (emotePlayer) {
                if (!emote.isPing && !player.visibleObjects.has(emotePlayer)) {
                    return false;
                }

                // regular emotes: always send if visible
                if (!emote.isPing && !(emoteDef as EmoteDef).teamOnly) {
                    return true;
                }

                // part of the same group
                if (emotePlayer?.groupId === player.groupId) {
                    return true;
                }

                // part of the same team
                if (emotePlayer?.teamId === player.teamId && !emote.isPing) {
                    return true;
                }

                // faction team leader
                if (
                    (emotePlayer.role === "leader" || emotePlayer.role === "captain") &&
                    emotePlayer.teamId === player.teamId
                ) {
                    return true;
                }
            }

            // always send map events pings
            if (emote.isPing && emoteDef.type === "ping" && emoteDef.mapEvent) {
                return true;
            }

            return false;
        };

        for (let i = 0; i < playerBarn.emotes.length; i++) {
            const emote = playerBarn.emotes[i];
            if (shouldSendEmote(emote)) {
                updateMsg.emotes.push(emote);
            }
        }

        const extendedRadius = 1.1 * radius;
        const radiusSquared = extendedRadius * extendedRadius;

        const bullets = game.bulletBarn.newBullets;
        for (let i = 0; i < bullets.length; i++) {
            const bullet = bullets[i];
            if (
                (bullet.soundTargetArenaTeam !== undefined &&
                    bullet.soundTargetArenaTeam === player.arenaTeam) ||
                v2.lengthSqr(v2.sub(bullet.pos, player.pos)) < radiusSquared ||
                v2.lengthSqr(v2.sub(bullet.clientEndPos, player.pos)) < radiusSquared ||
                coldet.intersectSegmentCircle(
                    bullet.pos,
                    bullet.clientEndPos,
                    player.pos,
                    extendedRadius,
                )
            ) {
                updateMsg.bullets.push(bullet);
            }
        }

        for (let i = 0; i < game.explosionBarn.newExplosions.length; i++) {
            const explosion = game.explosionBarn.newExplosions[i];
            const rad = explosion.rad + extendedRadius;
            if (v2.lengthSqr(v2.sub(explosion.pos, player.pos)) < rad * rad) {
                updateMsg.explosions.push(explosion);
            }
        }

        const planes = this.game.planeBarn.planes;
        for (let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            if (
                coldet.testCircleAabb(plane.pos, plane.rad, rect.min, rect.max) &&
                coldet.testPointAabb(
                    plane.pos,
                    this.game.planeBarn.planeBounds.min,
                    this.game.planeBarn.planeBounds.max,
                )
            ) {
                updateMsg.planes.push(plane);
            }
        }
        const newAirstrikeZones = this.game.planeBarn.newAirstrikeZones;
        for (let i = 0; i < newAirstrikeZones.length; i++) {
            const zone = newAirstrikeZones[i];
            updateMsg.airstrikeZones.push(zone);
        }

        const indicators = this.game.mapIndicatorBarn.mapIndicators;
        for (let i = 0; i < indicators.length; i++) {
            const indicator = indicators[i];
            if (indicator.dirty || !this.visibleMapIndicators.has(indicator)) {
                updateMsg.mapIndicators.push(indicator);
                this.visibleMapIndicators.add(indicator);
            }
            if (indicator.dead) {
                this.visibleMapIndicators.delete(indicator);
            }
        }

        if (playerBarn.killLeaderDirty || this._firstUpdate) {
            updateMsg.killLeaderDirty = true;
            updateMsg.killLeaderId = playerBarn.killLeader?.__id ?? 0;
            updateMsg.killLeaderKills = playerBarn.killLeader?.kills ?? 0;
        }

        msgStream.serializeMsg(net.MsgType.Update, updateMsg);

        for (let i = 0; i < this.msgsToSend.length; i++) {
            const msg = this.msgsToSend[i];
            msgStream.serializeMsg(msg.type, msg.msg);
        }

        this.msgsToSend.length = 0;

        const globalMsgStream = this.game.msgsToSend.stream;
        msgStream.stream.writeBytes(globalMsgStream, 0, globalMsgStream.byteIndex);

        this.sendData(msgStream.getBuffer());
        this._firstUpdate = false;
    }

    addAmongUsCameraObjects(visibleObjects: Set<GameObject>) {
        const addBuildingTree = (building: Building) => {
            if (!building.__id) return;
            visibleObjects.add(building);

            for (const child of building.childObjects) {
                if (!child.__id) continue;
                visibleObjects.add(child);
                if (child.__type === ObjectType.Building) {
                    addBuildingTree(child as Building);
                }
            }
        };

        for (const building of this.game.map.buildings) {
            if (building.type === "cafetria_01") {
                addBuildingTree(building);
            }
        }
    }

    spectate(spectateMsg: net.SpectateMsg): void {
        if (!this.dead) return;

        if (this.spectateCooldown >= 0.75) {
            this.spectateCooldownCount++;

            if (this.spectateCooldownCount > 10) {
                this.disconnect();
                this.game.logger.error(
                    `Game ${this.game.id} - Player ${this.name} disconnected for spamming SpectateMsg (cooldown)`,
                );
            }
            return;
        }
        this.spectateCooldown = 1;

        this.spectateMsgCount++;

        if (this.spectateMsgCount > 50) {
            this.disconnect();
            this.game.logger.error(
                `Game ${this.game.id} - Player ${this.name} Player ${this.name} disconnected for spamming SpectateMsg (count)`,
            );
            return;
        }

        // livingPlayers is used here instead of a more "efficient" option because its sorted while other options are not
        const spectatablePlayers = this.game.playerBarn.livingPlayers.filter(
            (p) => this != p,
            // !p.disconnected &&
            // (this.game.modeManager.getPlayerAlivePlayersContext(this).length === 0 ||
            //     p.teamId == this.teamId),
        );

        let playerToSpec: Player | undefined;
        switch (true) {
            case spectateMsg.specBegin:
                if (spectateMsg.targetId) {
                    playerToSpec = spectatablePlayers.find(
                        (player) => player.playerId === spectateMsg.targetId,
                    );
                    if (playerToSpec) {
                        break;
                    }
                }

                const groupExistsOrAlive =
                    this.game.isTeamMode && this.group!.livingPlayers.length > 0;
                const teamExistsOrAlive =
                    this.game.map.factionMode && this.team!.livingPlayers.length > 0;
                const aliveKiller = this.getAliveKiller();
                const shouldSpecRandom =
                    groupExistsOrAlive || teamExistsOrAlive || !aliveKiller;

                if (!shouldSpecRandom) {
                    playerToSpec = aliveKiller;
                    break;
                }

                const players =
                    this.game.map.factionMode && groupExistsOrAlive
                        ? this.group!.livingPlayers
                        : spectatablePlayers;

                playerToSpec = util.randomItem(players);
                break;
            case spectateMsg.specNext:
            case spectateMsg.specPrev:
                const nextOrPrev = +spectateMsg.specNext - +spectateMsg.specPrev;
                playerToSpec = util.wrappedArrayIndex(
                    spectatablePlayers,
                    spectatablePlayers.indexOf(this.spectating!) + nextOrPrev,
                );
                break;
        }
        this.spectating = playerToSpec;
    }

    /**
     * doesn't care about kill credit or anything, simply the last player to damage you (excludes yourself)
     */
    lastDamagedBy: Player | undefined;

    damage(params: DamageParams) {
        if (this.debug.godMode) return;
        if (this._health < 0) this._health = 0;
        if (this.dead) return;
        if (this.downed && this.downedDamageTicker > 0) return;
        // cobalt players on role picker menu
        if (this.game.map.perkMode && !this.role) return;

        // Phoenix perk: immune to burn DoT damage (Burning effect and Flamethrower)
        if (
            this.hasPerk("phoenix") &&
            params.damageType === GameConfig.DamageType.Burning
        ) {
            return;
        }

        const playerSource =
            params.source?.__type === ObjectType.Player
                ? (params.source as Player)
                : undefined;
        const sourceTeamId = playerSource?.teamId ?? params.sourceTeamId;
        const infectedSettings = getInfectedSettings(this.game.miniGame);

        if (
            playerSource &&
            playerSource !== this &&
            isHideAndSeekHider(this.game.miniGame, playerSource.arenaTeam) &&
            isHideAndSeekSeeker(this.game.miniGame, this.arenaTeam)
        ) {
            return;
        }

        const preHealth = this._health;

        if (params.source !== this && sourceTeamId !== undefined) {
            const amongUsImpostorAttack =
                (isAmongUsMiniGame(this.game.miniGame) || this.game.map.amongUsMode) &&
                playerSource?.amongUsRole === "impostor" &&
                params.gameSourceType === "karambit";
            if (amongUsImpostorAttack && playerSource.amongUsKillCooldownTime > 0) {
                return;
            }
            if (amongUsImpostorAttack && this.amongUsRole === "impostor") {
                return;
            }
            const infectedFriendlyFire =
                !!infectedSettings &&
                (playerSource?.arenaTeam
                    ? playerSource.arenaTeam === this.arenaTeam
                    : sourceTeamId === this.teamId);
            const regularFriendlyFire = !infectedSettings && sourceTeamId === this.teamId;
            if (
                (infectedFriendlyFire || regularFriendlyFire) &&
                !amongUsImpostorAttack &&
                !this.disconnected
            ) {
                return;
            }
        }

        let finalDamage = params.amount!;
        if (
            params.isExplosion &&
            params.gameSourceType === "mine" &&
            this.hasPerk("mine_master")
        ) {
            const mult = (PerkProperties as any).mine_master?.mineDamageMult as
                | number
                | undefined;
            if (typeof mult === "number" && isFinite(mult) && mult >= 0) {
                finalDamage = finalDamage * mult;
            }
        }

        const reduceDamage = (multi: number) => {
            if (params.armorPenetration !== undefined) {
                multi *= params.armorPenetration;
            }
            finalDamage -= finalDamage * multi;
        };

        // ignore armor for gas, bleeding, burning, and airdrop damage
        if (
            params.damageType !== GameConfig.DamageType.Gas &&
            params.damageType !== GameConfig.DamageType.Bleeding &&
            params.damageType !== GameConfig.DamageType.Airdrop &&
            params.damageType !== GameConfig.DamageType.Burning
        ) {
            const gameSourceDef = GameObjectDefs[params.gameSourceType ?? ""];
            let isHeadShot = false;

            if (gameSourceDef && "headshotMult" in gameSourceDef && !params.isExplosion) {
                isHeadShot = Math.random() < GameConfig.player.headshotChance;

                if (isHeadShot) {
                    finalDamage *= gameSourceDef.headshotMult;
                }
            }

            if (this.hasPerk("flak_jacket")) {
                reduceDamage(
                    params.isExplosion
                        ? PerkProperties.flak_jacket.explosionDamageReduction
                        : PerkProperties.flak_jacket.damageReduction,
                );
            }

            if (this.hasPerk("steelskin")) {
                reduceDamage(PerkProperties.steelskin.damageReduction);
            }

            // Streak: Juggernaut damage reduction
            if (this.hasPerk("streak_juggernaut_effect")) {
                reduceDamage(
                    DamageStreakProperties.streak_juggernaut_effect.damageReduction,
                );
            }

            const chest = GameObjectDefs[this.chest] as ChestDef;
            if (chest && !isHeadShot) {
                let chestReduction = chest.damageReduction;
                if (this.hasPerk("armor_master")) {
                    chestReduction *= 1 + (PerkProperties.armor_master?.armorBonus ?? 0);
                }
                reduceDamage(chestReduction);
            }

            const helmet = GameObjectDefs[this.helmet] as HelmetDef;
            if (helmet) {
                let helmetReduction = helmet.damageReduction * (isHeadShot ? 1 : 0.3);
                if (this.hasPerk("armor_master")) {
                    helmetReduction *= 1 + (PerkProperties.armor_master?.armorBonus ?? 0);
                }
                reduceDamage(helmetReduction);
            }
        }

        if (infectedSettings && this.arenaTeam === infectedSettings.zombieTeam) {
            reduceDamage(infectedSettings.zombieDamageReduction);
        }

        if (
            this.hasPerk("first_hit") &&
            this._health === GameConfig.player.health &&
            this.game.now > (this._firstShieldBrokenUntil || 0)
        ) {
            const red = PerkProperties.first_hit?.firstShieldReduction ?? 0.25;
            if (typeof red === "number" && red > 0 && red < 1) {
                finalDamage -= finalDamage * red;
            }
            const breakMs = PerkProperties.first_hit?.firstShieldBreakMs ?? 300;
            this._firstShieldBrokenUntil = this.game.now + breakMs;
        }

        if (this._health - finalDamage < 0) finalDamage = this.health;

        this.game.pluginManager.emit("playerDamage", { ...params, player: this });

        this.damageTaken += finalDamage;
        this.trackWeaponStat(
            this.weaponDamageTaken,
            params.weaponSourceType ?? params.gameSourceType,
            finalDamage,
        );
        if (playerSource && params.source !== this) {
            if (playerSource.groupId !== this.groupId) {
                playerSource.damageDealt += finalDamage;
                playerSource.trackWeaponStat(
                    playerSource.weaponDamageDealt,
                    params.weaponSourceType ?? params.gameSourceType,
                    finalDamage,
                );
                playerSource.streakDirty = true;
                playerSource.checkDamageStreaks();
                playerSource.questManager.trackEvent("damage", {
                    amount: finalDamage,
                    weaponType: params.gameSourceType ?? "",
                });
            }
            this.lastDamagedBy = playerSource;
        }

        if (finalDamage > 0) {
            this.lostHealth = true;
        }
        this.health -= finalDamage;

        if (this.hasPerk("low_hp_surge")) {
            const props = PerkProperties.low_hp_surge as any;
            const threshold = props?.threshold ?? 30;
            const dur = props?.duration ?? 1.5;
            if (preHealth >= threshold && this._health < threshold) {
                this.lowHpSurgeTicker = Math.max(this.lowHpSurgeTicker, dur);
            }
        }

        if (this.game.isTeamMode) {
            this.setGroupStatuses();
        }

        if (this._health === 0) {
            if (this.handleInfectedFatalDamage(params)) {
                return;
            }

            if (false || (!this.downed && this.hasPerk("self_revive"))) {
                this.kill(params);
            } else {
                this.game.modeManager.handlePlayerDeath(this, params);
            }
        }
    }

    /**
     * adds gameover message to "this.msgsToSend" for the player and all their spectators
     */
    addGameOverMsg(winningTeamId: number = 0, opts: { gameOver?: boolean } = {}): void {
        this.questManager.flushProgress(winningTeamId);

        const gameOver = opts.gameOver || !!winningTeamId;

        if (!gameOver && this.game.map.amongUsMode && winningTeamId === 0) {
            const statsMsg = new net.PlayerStatsMsg();
            statsMsg.playerStats = this.getPlayerStatsSnapshot(this);
            this.msgsToSend.push({ type: net.MsgType.PlayerStats, msg: statsMsg });
        } else {
            const recipients = new Set<Player>([this, ...this.spectators]);
            if (!this.game.map.amongUsMode) {
                for (const player of this.game.playerBarn.players) {
                    if (player.dead && !player.disconnected) {
                        recipients.add(player);
                    }
                }
            }

            const rankedPlayers = this.game.modeManager.getPlayersSortedByRank();
            for (const recipient of recipients) {
                const gameOverMsg = new net.GameOverMsg();
                const statsArr: net.PlayerStatsMsg["playerStats"][] =
                    this.game.modeManager
                        .getGameoverPlayers(recipient)
                        .map((player) => this.getPlayerStatsSnapshot(player));
                gameOverMsg.playerStats = statsArr;
                gameOverMsg.teamRank =
                    winningTeamId == recipient.teamId
                        ? 1
                        : (rankedPlayers.find(({ player }) => player === recipient)
                              ?.rank ?? this.game.modeManager.aliveCount() + 1);
                gameOverMsg.teamId = recipient.teamId;
                gameOverMsg.winningTeamId = winningTeamId;
                gameOverMsg.gameOver = gameOver;
                recipient.msgsToSend.push({
                    type: net.MsgType.GameOver,
                    msg: gameOverMsg,
                });
            }
        }
    }

    downedBy: Player | undefined;
    /** downs a player */
    down(params: DamageParams): void {
        this.downed = true;
        this.downedCount++;
        this.downedDamageTicker = GameConfig.player.downedDamageBuffer;
        this.boost = 0;
        this.health = 100;

        if (this.game.gas.currentRad <= 0.1) {
            this.health = 50;
        }

        this.animType = GameConfig.Anim.None;
        this.setDirty();

        this.shootStart = false;
        this.shootHold = false;
        this.cancelAction();

        this.weaponManager.throwThrowable();
        this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee);

        if (this.weapons[GameConfig.WeaponSlot.Melee].type === "pan") {
            this.wearingPan = true;
        }

        //
        // Send downed msg
        //
        const downedMsg = new net.KillMsg();
        downedMsg.damageType = params.damageType;
        downedMsg.itemSourceType = params.gameSourceType ?? "";
        downedMsg.mapSourceType = params.mapSourceType ?? "";
        downedMsg.targetId = this.__id;
        downedMsg.downed = true;

        if (params.source?.__type === ObjectType.Player) {
            this.downedBy = params.source;
            downedMsg.killerId = params.source.__id;
            downedMsg.killCreditId = params.source.__id;
        }

        this.game.broadcastMsg(net.MsgType.Kill, downedMsg);

        // lone survivr can be given on knock or kill
        if (this.game.map.factionMode) {
            // this.team!.checkAndApplyLastMan();
            // this.team!.checkAndApplyCaptain();
        }
    }

    killedBy: Player | undefined;
    killedIds: number[] = [];

    private getPlayerStatsSnapshot(player: Player): net.PlayerStatsMsg["playerStats"] {
        return {
            playerId: player.playerId,
            timeAlive: Math.round(player.timeAlive),
            kills: this.game.playerBarn.getTrackedKills(player),
            dead: player.dead,
            damageDealt: Math.round(player.damageDealt),
            damageTaken: Math.round(player.damageTaken),
            killerId: player.getAliveKiller()?.playerId ?? player.killedBy?.playerId ?? 0,
            name: player.name,
        };
    }

    private getKillsLeaderboardMsg() {
        const killLeaderboardPlayers = Array.from(this.game.leaderboard.entries())
            .map(([userId, value]) => ({ userId, value }))
            .sort((a, b) => {
                if (b.value.kills !== a.value.kills) {
                    return b.value.kills - a.value.kills;
                }
                return a.value.name.localeCompare(b.value.name);
            })
            .splice(0, 6);

        const leaderboradMsg = new net.LeaderboardMsg();
        leaderboradMsg.players = killLeaderboardPlayers.map(({ value }) => value);

        return leaderboradMsg;
    }

    kill(params: DamageParams): void {
        if (this.dead) return;
        if (this.handleInfectedFatalDamage(params)) return;
        if (this.downed) this.downed = false;
        this.dead = true;
        this.trackWeaponStat(
            this.weaponDeaths,
            params.weaponSourceType ?? params.gameSourceType,
        );
        this.killedIndex = this.game.playerBarn.nextKilledNumber++;
        this.boost = 0;
        this.actionType = GameConfig.Action.None;
        this.actionSeq++;
        this.hasteType = GameConfig.HasteType.None;
        this.hasteSeq++;
        this.animType = GameConfig.Anim.None;
        this.animSeq++;
        this.healEffect = false;
        this.poisonEffect = false;
        this.poisonTicker = 0;
        this.poisonDuration = 0;
        this.poisonSource = undefined;
        this.poisonSourceTeamId = undefined;
        this.boostDirty = true;
        this.inventoryDirty = true;
        this.setDirty();

        this.shootHold = false;

        this.mapIndicator?.kill();

        this.game.playerBarn.aliveCountDirty = true;

        util.removeFrom(this.game.playerBarn.livingPlayers, this);

        this.game.playerBarn.killedPlayers.push(this);

        this.group?.checkPlayers();

        if (this.team) {
            util.removeFrom(this.team.livingPlayers, this);
        }

        if (this.weaponManager.cookingThrowable) {
            this.weaponManager.throwThrowable(true);
        }

        //
        // Send kill msg
        //
        const killMsg = new net.KillMsg();
        killMsg.damageType = params.damageType;
        killMsg.itemSourceType = params.gameSourceType ?? "";
        killMsg.mapSourceType = params.mapSourceType ?? "";
        killMsg.targetId = this.__id;
        killMsg.killed = true;

        const killCreditSource = params.killCreditSource
            ? params.killCreditSource
            : params.source;
        if (killCreditSource?.__type === ObjectType.Player) {
            this.killedBy = killCreditSource;
            if (
                (isAmongUsMiniGame(this.game.miniGame) || this.game.map.amongUsMode) &&
                killCreditSource !== this &&
                killCreditSource.amongUsRole === "impostor" &&
                params.gameSourceType === "karambit"
            ) {
                killCreditSource.resetAmongUsKillCooldown();
            }

            if (killCreditSource !== this && killCreditSource.teamId !== this.teamId) {
                killCreditSource.killedIds.push(this.matchDataId);
                killCreditSource.kills++;
                killCreditSource.trackWeaponKill(params.gameSourceType);
                killCreditSource.questManager.trackEvent("kill", {
                    weaponType: params.gameSourceType ?? "",
                    buildingType: killCreditSource.currentBuildingType,
                });

                if (killCreditSource.isKillLeader) {
                    this.game.playerBarn.killLeaderDirty = true;
                }

                const leaderboardKey = killCreditSource.getLeaderboardKey();
                const original = this.game.leaderboard.get(leaderboardKey)!;
                this.game.leaderboard.set(leaderboardKey, {
                    ...original,
                    kills: original.kills + 1,
                });

                if (!isBattleRoyaleMapName(this.game.mapName)) {
                    const leaderboradMsg = this.getKillsLeaderboardMsg();
                    this.game.broadcastMsg(net.MsgType.Leaderboard, leaderboradMsg);
                }

                if (killCreditSource.hasPerk("takedown")) {
                    killCreditSource.health += 25;
                    killCreditSource.boost += 25;
                    killCreditSource.giveHaste(GameConfig.HasteType.Takedown, 3);
                }

                // If the killer used a mine and has the mine_master perk, refund a mine
                if (
                    params.gameSourceType === "mine" &&
                    killCreditSource.hasPerk("mine_master")
                ) {
                    const killer = killCreditSource as Player;
                    killer.invManager.give("mine", 1);
                }

                // Pirate's Bounty (Cutlass-specific): melee kills with the pirate perk spawn extra loot
                const weaponDef = GameObjectDefs[params.gameSourceType || ""];
                if (killCreditSource.hasPerk("pirate") && weaponDef?.type == "melee") {
                    const count = util.randomInt(3, 4);
                    for (let i = 0; i < count; i++) {
                        const item = this.game.lootBarn.getLootTable("tier_pirate");
                        if (!item) continue;

                        this.game.lootBarn.addLoot(
                            item.name,
                            this.pos,
                            this.layer,
                            item.count,
                        );
                    }

                    // rare gun
                    if (Math.random() < 0.12) {
                        const item = this.game.lootBarn.getLootTable("tier_pirate_rare");
                        if (item) {
                            this.game.lootBarn.addLoot(
                                item.name,
                                this.pos,
                                this.layer,
                                item.count,
                            );
                        }
                    }
                }

                if (killCreditSource.role === "woods_king") {
                    this.game.playerBarn.addMapPing("ping_woodsking", this.pos);
                }

                if (killCreditSource.role === "lava_king") {
                    this.game.playerBarn.addMapPing("ping_lavasking", this.pos);
                }
            }
            killMsg.killCreditId = killCreditSource.__id;
            killMsg.killerKills = killCreditSource.kills;
        }

        if (params.source?.__type === ObjectType.Player) {
            killMsg.killerId = params.source.__id;
        }

        if (this.hasPerk("final_bugle")) {
            this.initLastBreath();
        }

        if (
            this.hasPerk("martyrdom") ||
            this.role == "grenadier" ||
            this.role == "demo"
        ) {
            const martyrNadeType = "martyr_nade";
            const throwableDef = GameObjectDefs[martyrNadeType] as ThrowableDef;
            for (let i = 0; i < 12; i++) {
                const velocity = v2.mul(v2.randomUnit(), util.random(2, 5));
                this.game.projectileBarn.addProjectile(
                    this.__id,
                    martyrNadeType,
                    this.pos,
                    1,
                    this.layer,
                    velocity,
                    throwableDef.fuseTime,
                    GameConfig.DamageType.Player,
                );
            }
        }

        if (this.game.map.factionMode) {
            // lone survivr can be given on knock or kill
            // this.team!.checkAndApplyLastMan();
            // this.team!.checkAndApplyCaptain();

            // golden airdrops depend on alive counts, so we only do this logic on kill
            if (this.game.planeBarn.isOneTeamWinning()) {
                this.game.planeBarn.helpLosingTeam();
            }
        }

        // params.gameSourceType check ensures player didnt die by bleeding out
        if (
            this.game.map.potatoMode &&
            this.lastDamagedBy &&
            params.damageType === GameConfig.DamageType.Player &&
            params.source !== this
        ) {
            this.lastDamagedBy.randomWeaponSwap(params);
        }

        this.questManager.flushProgress();

        this.game.broadcastMsg(net.MsgType.Kill, killMsg);

        if (this.role) {
            const roleMsg = new net.RoleAnnouncementMsg();
            roleMsg.role = this.role;
            roleMsg.assigned = false;
            roleMsg.killed = true;
            roleMsg.playerId = this.__id;
            roleMsg.killerId = params.source?.__id ?? 0;
            this.game.broadcastMsg(net.MsgType.RoleAnnouncement, roleMsg);
        }

        if (this.isKillLeader && this.role !== "the_hunted") {
            const roleMsg = new net.RoleAnnouncementMsg();
            roleMsg.role = "kill_leader";
            roleMsg.assigned = false;
            roleMsg.killed = true;
            roleMsg.playerId = this.__id;
            roleMsg.killerId = params.source?.__id ?? 0;
            this.game.broadcastMsg(net.MsgType.RoleAnnouncement, roleMsg);
        }

        if (this.game.map.mapDef.gameMode.killLeaderEnabled) {
            const killLeader = this.game.playerBarn.killLeader;

            let killLeaderKills = 0;

            if (killLeader && !killLeader.dead) {
                killLeaderKills = this.game.playerBarn.getTrackedKills(killLeader);
            }

            const newKillLeader = this.game.playerBarn.getPlayerWithHighestKills();
            if (
                killLeader !== newKillLeader &&
                killCreditSource &&
                newKillLeader === killCreditSource &&
                this.game.playerBarn.getTrackedKills(newKillLeader) > killLeaderKills
            ) {
                if (killLeader && killLeader.role === "the_hunted") {
                    killLeader.removeRole();
                }

                killCreditSource.promoteToKillLeader();
            }
        }

        if (this.isKillLeader) {
            this.game.playerBarn.killLeader = undefined;
            this.game.playerBarn.killLeaderDirty = true;
            this.isKillLeader = false;

            // remove the role on savannah
            if (this.role === "the_hunted") {
                this.removeRole();
            }
        }

        // this.game.pluginManager.emit("playerKill", { ...params, player: this });
        onPlayerKill({ ...params, player: this });

        //
        // Give spectators someone new to spectate
        //

        this.game.modeManager.assignNewSpectate(this);

        if (this.game.map.amongUsMode) {
            const aliveKiller = this.getAliveKiller();
            const spectateTargets = this.game.playerBarn.livingPlayers.filter(
                (player) => player !== this && !player.dead && !player.disconnected,
            );
            const spectateTarget =
                aliveKiller && !aliveKiller.dead && !aliveKiller.disconnected
                    ? aliveKiller
                    : spectateTargets.length > 0
                      ? util.randomItem(spectateTargets)
                      : undefined;
            if (spectateTarget) {
                this.spectating = spectateTarget;
                this.spectateCooldown = 0;
            }
        }

        this.game.deadBodyBarn.addDeadBody(this.pos, this.__id, this.layer, params.dir);
        this.game.playerBarn.refreshAmongUsMeetingAfterParticipantChange();

        //
        // Kill outfit obstacle
        //
        if (this.obstacleOutfit) {
            this.obstacleOutfit.kill(params);
        }
        if (this.propDisguise) {
            this.propDisguise.kill(params);
        }

        //
        // drop loot
        //

        if (this.streakActive) {
            if (this.streakGunSlot >= 0) {
                this.weaponManager.setWeapon(this.streakGunSlot, "", 0);
            }
            if (this.streakSavedWeapon) {
                this.weaponManager.setWeapon(
                    this.streakSavedWeapon.slot,
                    this.streakSavedWeapon.type,
                    this.streakSavedWeapon.ammo,
                );
                this.streakSavedWeapon = null;
            }
            this.streakGunSlot = -1;
            this.deactivateStreak();
        }

        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        const isHideAndSeekHiderDeath =
            !!hideAndSeekSettings && this.arenaTeam === hideAndSeekSettings.hiderTeam;

        for (let i = 0; i < GameConfig.WeaponSlot.Count; i++) {
            const weap = this.weapons[i];
            if (!weap.type) continue;
            const def = GameObjectDefs[weap.type];
            switch (def.type) {
                case "gun":
                    if (
                        !isHideAndSeekHiderDeath ||
                        weap.type !== hideAndSeekSettings.hiderPrimaryWeapon
                    ) {
                        this.weaponManager.dropGun(i);
                    }
                    weap.type = "";
                    break;
                case "melee":
                    if (def.noDropOnDeath || weap.type === "fists") break;
                    this.game.lootBarn.addLoot(weap.type, this.pos, this.layer, 1);
                    weap.type = "fists";
                    break;
                case "throwable":
                    weap.type = "";
                    break;
            }
        }
        this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee);

        for (const item of Object.keys(this.invManager.items) as InventoryItem[]) {
            // const def = GameObjectDefs[item] as AmmoDef | HealDef;
            if (item == "1xscope" && !isBattleRoyaleMapName(this.game.mapName)) {
                continue;
            }

            const amount = this.invManager.get(item);
            if (amount > 0) {
                this.game.lootBarn.addLoot(item, this.pos, this.layer, amount);
            }
        }

        for (const item of GEAR_TYPES) {
            const type = this[item];
            if (!type) continue;
            const def = GameObjectDefs[type] as HelmetDef | ChestDef | BackpackDef;
            if (!!(def as ChestDef).noDrop || def.level < 1) continue;
            this.game.lootBarn.addLoot(type, this.pos, this.layer, 1);
        }

        if (this.outfit) {
            const def = GameObjectDefs[this.outfit] as OutfitDef;
            if (!def.noDropOnDeath && !def.noDrop) {
                this.game.lootBarn.addLoot(this.outfit, this.pos, this.layer, 1);
            }
        }

        if (
            !this.game.disablePerks &&
            !isAmongUsMiniGame(this.game.miniGame) &&
            !this.game.map.amongUsMode
        ) {
            for (let i = this.perks.length - 1; i >= 0; i--) {
                const perk = this.perks[i];
                if (perk.droppable || perk.replaceOnDeath) {
                    this.game.lootBarn.addLoot(
                        perk.replaceOnDeath || perk.type,
                        this.pos,
                        this.layer,
                        1,
                    );
                }
            }
        }
        this._perks.length = 0;
        this._perkTypes.length = 0;

        // Wipe inventory
        this.invManager.wipeInventory();
        this.chest = "";
        this.helmet = "";
        this.backpack = "backpack00";
        this.weaponManager.showNextThrowable();

        // death emote
        this.sendDeathEmoteTicker = 0.3;

        // Building gore region (club pool)
        const objs = this.game.grid.intersectGameObject(this);
        for (const obj of objs) {
            if (
                obj.__type === ObjectType.Building &&
                obj.goreRegion &&
                util.sameLayer(this.layer, obj.layer) &&
                coldet.testCircleAabb(
                    this.pos,
                    this.rad,
                    obj.goreRegion.min,
                    obj.goreRegion.max,
                )
            ) {
                obj.onGoreRegionKill();
            }
        }

        // Check for game over
        this.game.checkGameOver();

        // send data to parent process
        this.game.updateData();
    }

    getAliveKiller(): Player | undefined {
        let attempts = 0;
        const findAliveKiller = (killer: Player | undefined): Player | undefined => {
            attempts++;
            if (attempts > 80) return undefined;

            if (!killer) return undefined;
            if (!killer.dead) return killer;
            if (
                killer.killedBy &&
                killer.killedBy !== this &&
                killer.killedBy !== killer
            ) {
                return findAliveKiller(killer.killedBy);
            }

            return undefined;
        };
        return findAliveKiller(this.killedBy);
    }

    canDespawn() {
        // special check for 50v50
        // we dont want eg leaders to despawn a second after being promoted :p
        if (this.game.map.factionMode && this.role) return false;

        return (
            this.timeAlive < GameConfig.player.minActiveTime && !this.dead && !this.downed
        );
    }

    isReloading() {
        return (
            this.actionType == GameConfig.Action.Reload ||
            this.actionType == GameConfig.Action.ReloadAlt
        );
    }

    isReviving() {
        return this.actionType == GameConfig.Action.Revive && !!this.action.targetId;
    }

    isBeingRevived() {
        if (!this.downed) return false;

        const normalRevive =
            this.actionType == GameConfig.Action.Revive && this.action.targetId == 0;
        if (normalRevive) return true;

        const numMedics = this.game.playerBarn.aoeHealPlayers.length;
        if (numMedics) {
            return this.game.playerBarn.aoeHealPlayers.some((medic) => {
                return medic != this && medic.isReviving() && this.isAffectedByAOE(medic);
            });
        }
        return false;
    }

    /** returns player to revive if can revive */
    getPlayerToRevive(): Player | undefined {
        if (this.actionType != GameConfig.Action.None) return undefined; // action in progress already

        if (this.downed && this.hasPerk("self_revive")) return this;

        if (!this.game.isTeamMode) return undefined; // no revives in solos
        if (this.downed) return undefined; // can't revive players while downed

        const nearbyDownedTeammates = this.game.grid
            .intersectCollider(
                collider.createCircle(this.pos, GameConfig.player.reviveRange),
            )
            .filter(
                (obj): obj is Player =>
                    obj.__type == ObjectType.Player &&
                    obj.teamId == this.teamId &&
                    obj.downed &&
                    // can't revive someone already being revived or self reviving (medic)
                    obj.actionType != GameConfig.Action.Revive,
            );

        let playerToRevive: Player | undefined;
        let closestDist = Number.MAX_VALUE;
        for (const teammate of nearbyDownedTeammates) {
            if (!util.sameLayer(this.layer, teammate.layer)) {
                continue;
            }
            const dist = v2.distance(this.pos, teammate.pos);
            if (dist <= GameConfig.player.reviveRange && dist < closestDist) {
                playerToRevive = teammate;
                closestDist = dist;
            }
        }

        return playerToRevive;
    }

    revive(playerToRevive: Player | undefined) {
        if (!playerToRevive) return;

        this.playerBeingRevived = playerToRevive;
        playerToRevive.revivedBy = this;
        if (this.downed && this.hasPerk("self_revive")) {
            this.doAction(
                "",
                GameConfig.Action.Revive,
                GameConfig.player.reviveDuration,
                this.__id,
            );
        } else {
            playerToRevive.doAction(
                "",
                GameConfig.Action.Revive,
                GameConfig.player.reviveDuration,
            );
            this.doAction(
                "",
                GameConfig.Action.Revive,
                GameConfig.player.reviveDuration,
                playerToRevive.__id,
            );
            this.playAnim(GameConfig.Anim.Revive, GameConfig.player.reviveDuration);
        }
    }

    isAffectedByAOE(medic: Player): boolean {
        const effectRange =
            medic.actionType == GameConfig.Action.Revive
                ? GameConfig.player.medicReviveRange
                : GameConfig.player.medicHealRange;

        return (
            medic.teamId == this.teamId &&
            !!util.sameLayer(medic.layer, this.layer) &&
            v2.lengthSqr(v2.sub(medic.pos, this.pos)) <= effectRange * effectRange
        );
    }

    /** for the medic role in 50v50 */
    getAOEPlayers(): Player[] {
        const effectRange =
            this.actionType == GameConfig.Action.Revive
                ? GameConfig.player.medicReviveRange
                : GameConfig.player.medicHealRange;

        return this.game.grid
            .intersectCollider(
                // includes self
                collider.createCircle(this.pos, effectRange),
            )
            .filter(
                (obj): obj is Player =>
                    obj.__type == ObjectType.Player && obj.isAffectedByAOE(this),
            );
    }

    useHealingItem(item: InventoryItem): void {
        const itemDef = GameObjectDefs[item];
        assert(itemDef.type === "heal", `Invalid heal item ${item}`);

        const hasAoeHeal = this.hasPerk("aoe_heal");
        if (
            (!hasAoeHeal && this.health == itemDef.maxHeal) ||
            this.actionType == GameConfig.Action.UseItem ||
            this.actionType == GameConfig.Action.Revive ||
            this.weaponManager.cookingThrowable
        ) {
            return;
        }
        if (!this.invManager.has(item)) {
            return;
        }

        // medics always emote the healing/boost item they're using
        if (hasAoeHeal) {
            this.game.playerBarn.addEmote("emote_loot", this.__id, item);
        }

        this.cancelAction();
        this.doAction(
            item,
            GameConfig.Action.UseItem,
            (hasAoeHeal ? 0.75 : 1) * itemDef.useTime,
        );
    }

    applyActionFunc(actionFunc: (target: Player) => void): void {
        const hasAoeHeal = this.hasPerk("aoe_heal");

        if (hasAoeHeal) {
            let aoePlayers = this.getAOEPlayers();

            // aoe doesnt heal/give boost to downed players
            if (this.actionType == GameConfig.Action.UseItem) {
                aoePlayers = aoePlayers.filter((p) => !p.downed);
            }

            for (let i = 0; i < aoePlayers.length; i++) {
                const aoePlayer = aoePlayers[i];
                actionFunc(aoePlayer);
            }
        } else {
            const target =
                this.actionType === GameConfig.Action.Revive && this.playerBeingRevived
                    ? this.playerBeingRevived
                    : this;
            actionFunc(target);
        }
    }

    useBoostItem(item: InventoryItem): void {
        const itemDef = GameObjectDefs[item];
        assert(itemDef.type === "boost", `Invalid boost item ${item}`);

        if (
            this.actionType == GameConfig.Action.UseItem ||
            this.actionType == GameConfig.Action.Revive ||
            this.weaponManager.cookingThrowable
        ) {
            return;
        }
        if (!this.invManager.has(item)) {
            return;
        }
        const hasAoeHeal = this.hasPerk("aoe_heal");

        // medics always emote the healing/boost item they're using
        if (hasAoeHeal) {
            this.game.playerBarn.addEmote("emote_loot", this.__id, item);
        }

        this.cancelAction();
        this.doAction(
            item,
            GameConfig.Action.UseItem,
            (hasAoeHeal ? 0.75 : 1) * itemDef.useTime,
        );
    }

    usePulseEffect(): void {
        const origin = this.pos;
        const rad = 300;
        const force = 4.5;

        // this does not work rn
        for (const other of this.game.playerBarn.livingPlayers) {
            if (other === this) continue;
            const dx = other.pos.x - origin.x;
            const dy = other.pos.y - origin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > rad || dist === 0) continue;
            const f = (1 - dist / rad) * force;
            const nx = dx / dist;
            const ny = dy / dist;
            other.pushBack = v2.create(nx * f * 0.2, ny * f * 0.2);
            other.pushBackTime = 0.2;
        }

        // this probably need to be removed since surviv never had this
        for (const proj of this.game.projectileBarn.projectiles) {
            const dx = proj.pos.x - origin.x;
            const dy = proj.pos.y - origin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > rad || dist === 0) continue;

            const f = (1 - dist / rad) * force;
            const nx = dx / dist;
            const ny = dy / dist;
            proj.vel.x += nx * f;
            proj.vel.y += ny * f;
        }

        for (const loot of this.game.lootBarn.loots) {
            const dx = loot.pos.x - origin.x;
            const dy = loot.pos.y - origin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > rad || dist === 0) continue;

            const f = (1 - dist / rad) * force;
            const nx = dx / dist;
            const ny = dy / dist;

            if (typeof loot.push === "function") {
                loot.push(v2.create(nx, ny), f);
            } else if (loot.vel) {
                loot.vel.x += nx * f;
                loot.vel.y += ny * f;
            }
        }
    }

    moveLeft = false;
    moveRight = false;
    moveUp = false;
    moveDown = false;
    shootStart = false;
    shootHold = false;
    portrait = false;
    private _cullingPortrait = false;
    private _cullingPortraitTicker = 0;
    touchMoveActive = false;
    touchMoveDir = v2.create(1, 0);
    touchMoveLen = 255;
    toMouseDir = v2.create(1, 0);
    toMouseLen = 0;
    mousePos = v2.create(1, 0);

    shouldAcceptInput(input: Input): boolean {
        return (
            !this.downed ||
            input === GameConfig.Input.Interact || // Players can interact with obstacles while downed.
            input === GameConfig.Input.Use || // Players can interact with doors while downed.
            (input === GameConfig.Input.Revive && this.hasPerk("self_revive")) || // Players can revive themselves if they have the self-revive perk.
            (input === GameConfig.Input.Cancel &&
                (!this.revivedBy?.hasPerk("aoe_heal") || // Players can cancel their own revives if they are not revived by aoe heal.
                    this.revivedBy === this.playerBeingRevived)) // Players can cancel their own revives if they are reviving themselves.
        );
    }

    handleInput(msg: net.InputMsg): void {
        this.ack = msg.seq;
        this.amongUsCamerasOpen =
            this.game.map.amongUsMode && Boolean(msg.amongUsCamerasOpen);

        if (this.dead) return;
        if (this.game.map.perkMode && !this.role) return;
        if (this.game.playerBarn.isAmongUsMeetingLocked) {
            this.moveLeft = false;
            this.moveRight = false;
            this.moveUp = false;
            this.moveDown = false;
            this.touchMoveActive = false;
            this.touchMoveDir = v2.create(0, 0);
            this.touchMoveLen = 0;
            this.shootHold = false;
            this.shootStart = false;
            return;
        }
        if (this.game.arenaPrivate && this.game.arenaStartLockTimer > 0) {
            this.moveLeft = false;
            this.moveRight = false;
            this.moveUp = false;
            this.moveDown = false;
            this.touchMoveActive = false;
            this.touchMoveDir = v2.create(0, 0);
            this.touchMoveLen = 0;
            this.shootHold = false;
            this.shootStart = false;
            return;
        }

        this.dirNew = v2.normalizeSafe(msg.toMouseDir);

        this.moveLeft = msg.moveLeft;
        this.moveRight = msg.moveRight;
        this.moveUp = msg.moveUp;
        this.moveDown = msg.moveDown;
        if (this.hideAndSeekHunterReleaseLocked) {
            this.moveLeft = false;
            this.moveRight = false;
            this.moveUp = false;
            this.moveDown = false;
        }

        // same logic for `_cullingZoom`, see comment on `set zoom`
        if (this.portrait != msg.portrait) {
            this._cullingPortraitTicker = 0.5;
        }
        this.portrait = msg.portrait;
        this.touchMoveActive = msg.touchMoveActive;
        this.touchMoveDir = v2.normalizeSafe(msg.touchMoveDir);
        this.touchMoveLen = msg.touchMoveLen;
        if (this.hideAndSeekHunterReleaseLocked) {
            this.touchMoveActive = false;
            this.touchMoveDir = v2.create(0, 0);
            this.touchMoveLen = 0;
        }
        this.toMouseLen = msg.toMouseLen;

        this.shootHold = msg.shootHold;

        if (msg.shootStart) {
            this.shootStart = true;
        }

        // HACK? client for some reason sends Interact followed by Cancel on mobile
        // so we ignore the cancel request when reviving a player
        let ignoreCancel = false;

        for (let i = 0; i < msg.inputs.length; i++) {
            const input = msg.inputs[i];
            if (!this.shouldAcceptInput(input)) continue;
            switch (input) {
                case GameConfig.Input.StowWeapons:
                case GameConfig.Input.EquipMelee:
                    this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Melee);
                    break;
                case GameConfig.Input.EquipPrimary:
                    this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Primary);
                    break;
                case GameConfig.Input.EquipSecondary:
                    this.weaponManager.setCurWeapIndex(GameConfig.WeaponSlot.Secondary);
                    break;
                case GameConfig.Input.EquipThrowable:
                    if (this.curWeapIdx === GameConfig.WeaponSlot.Throwable) {
                        this.weaponManager.throwThrowable(true);
                        this.weaponManager.showNextThrowable();
                    } else {
                        this.weaponManager.setCurWeapIndex(
                            GameConfig.WeaponSlot.Throwable,
                        );
                    }
                    break;
                case GameConfig.Input.EquipPrevWeap:
                case GameConfig.Input.EquipNextWeap:
                    {
                        function absMod(a: number, n: number): number {
                            return a >= 0 ? a % n : ((a % n) + n) % n;
                        }

                        const toAdd = input === GameConfig.Input.EquipNextWeap ? 1 : -1;

                        let iterations = 0;
                        let idx = this.curWeapIdx;
                        while (iterations < GameConfig.WeaponSlot.Count * 2) {
                            idx = absMod(idx + toAdd, GameConfig.WeaponSlot.Count);
                            if (this.weapons[idx].type) {
                                break;
                            }
                        }
                        this.weaponManager.setCurWeapIndex(idx);
                    }
                    break;
                case GameConfig.Input.EquipLastWeap:
                    this.weaponManager.setCurWeapIndex(this.weaponManager.lastWeaponIdx);
                    break;
                case GameConfig.Input.EquipOtherGun:
                    // priority list of slots to swap to
                    const slotTargets = [
                        GameConfig.WeaponSlot.Primary,
                        GameConfig.WeaponSlot.Secondary,
                        GameConfig.WeaponSlot.Melee,
                    ];

                    util.removeFrom(slotTargets, this.curWeapIdx);

                    for (let i = 0; i < slotTargets.length; i++) {
                        const slot = slotTargets[i];
                        if (this.weapons[slot].type) {
                            this.weaponManager.setCurWeapIndex(slot);
                            break;
                        }
                    }
                    break;
                case GameConfig.Input.Interact: {
                    const deadBody = this.getReportableDeadBody();
                    if (
                        deadBody &&
                        this.game.playerBarn.reportAmongUsDeadBody(this, deadBody)
                    ) {
                        break;
                    }

                    const loot = this.getClosestLoot();
                    const obstacles = this.getInteractableObstacles();
                    const playerToRevive = this.getPlayerToRevive();

                    const canRevive =
                        !this.downed || (this.downed && this.hasPerk("self_revive"));

                    const interactables = [
                        playerToRevive,
                        !this.downed && loot,
                        ...obstacles,
                    ];

                    for (let i = 0; i < interactables.length; i++) {
                        const interactable = interactables[i];
                        if (!interactable) continue;
                        if (interactable.__type === ObjectType.Player && canRevive) {
                            this.revive(playerToRevive);
                            ignoreCancel = true;
                        } else if (
                            interactable.__type === ObjectType.Loot &&
                            !this.downed
                        ) {
                            this.interactWith(interactable);
                        } else {
                            this.interactWith(interactable);
                        }
                    }
                    break;
                }
                case GameConfig.Input.Revive: {
                    const playerToRevive = this.getPlayerToRevive();
                    this.revive(playerToRevive);
                    break;
                }
                case GameConfig.Input.Loot: {
                    const loot = this.getClosestLoot();
                    if (loot) {
                        this.interactWith(loot);
                    }
                    break;
                }
                case GameConfig.Input.Use: {
                    const deadBody = this.getReportableDeadBody();
                    if (
                        deadBody &&
                        this.game.playerBarn.reportAmongUsDeadBody(this, deadBody)
                    ) {
                        break;
                    }

                    const obstacles = this.getInteractableObstacles();
                    for (let i = 0; i < obstacles.length; i++) {
                        obstacles[i].interact(this);
                    }
                    break;
                }
                case GameConfig.Input.Reload:
                    if (this.actionType !== GameConfig.Action.Revive) {
                        this.weaponManager.scheduledReload = true;
                    }
                    break;
                case GameConfig.Input.Cancel:
                    if (ignoreCancel) {
                        break;
                    }
                    this.cancelAction();
                    break;
                case GameConfig.Input.EquipNextScope: {
                    const scopeIdx = SCOPE_LEVELS.indexOf(this.scope);

                    for (let i = scopeIdx + 1; i < SCOPE_LEVELS.length; i++) {
                        const nextScope = SCOPE_LEVELS[i];

                        if (!this.invManager.has(nextScope as InventoryItem)) continue;
                        this.scope = nextScope;
                        this.inventoryDirty = true;
                        break;
                    }
                    break;
                }
                case GameConfig.Input.EquipPrevScope: {
                    const scopeIdx = SCOPE_LEVELS.indexOf(this.scope);

                    for (let i = scopeIdx - 1; i >= 0; i--) {
                        const prevScope = SCOPE_LEVELS[i];

                        if (!this.invManager.has(prevScope as InventoryItem)) continue;
                        this.scope = prevScope;
                        this.inventoryDirty = true;
                        break;
                    }
                    break;
                }
                case GameConfig.Input.SwapWeapSlots: {
                    this.weaponManager.swapWeaponSlots();
                    break;
                }
                case GameConfig.Input.ActivateStreak: {
                    this.activateStreak(msg.streakIdx);
                    break;
                }
            }
        }

        // no exceptions for any perks or roles
        if (this.downed) return;

        if (!this.invManager.isValid(msg.useItem) || !this.invManager.has(msg.useItem))
            return;
        const def = GameObjectDefs[msg.useItem];
        switch (def.type) {
            case "heal":
                this.useHealingItem(msg.useItem);
                break;
            case "boost":
                this.useBoostItem(msg.useItem);
                break;
            case "scope":
                if (this.invManager.has(msg.useItem)) {
                    this.scope = msg.useItem;
                    this.inventoryDirty = true;
                }
                break;
        }
    }

    getClosestLoot(): Loot | undefined {
        const objs = this.game.grid.intersectCollider(
            collider.createCircle(this.pos, this.rad + 5),
        );

        let closestLoot: Loot | undefined;
        let closestDist = Number.MAX_VALUE;

        for (let i = 0; i < objs.length; i++) {
            const loot = objs[i];
            if (loot.__type !== ObjectType.Loot) continue;
            if (loot.destroyed) continue;
            if (loot.isSkin) continue;
            if (
                util.sameLayer(loot.layer, this.layer) &&
                (loot.ownerId == 0 || loot.ownerId == this.__id)
            ) {
                const pos = loot.pos;
                const rad = this.isMobile
                    ? this.rad + loot.rad * GameConfig.player.touchLootRadMult
                    : this.rad + loot.rad;
                const toPlayer = v2.sub(this.pos, pos);
                const distSq = v2.lengthSqr(toPlayer);
                if (distSq < rad * rad && distSq < closestDist) {
                    closestDist = distSq;
                    closestLoot = loot;
                }
            }
        }

        return closestLoot;
    }

    getReportableDeadBody(): DeadBody | undefined {
        if (
            !this.game.map.amongUsMode ||
            this.dead ||
            this.downed ||
            this.disconnected ||
            this.spectatorOnly ||
            this.game.playerBarn.isAmongUsMeetingLocked
        ) {
            return undefined;
        }

        return this.game.deadBodyBarn.getReportableDeadBody(
            this.pos,
            this.rad,
            this.layer,
        );
    }

    getInteractableObstacles(): Obstacle[] {
        const objs = this.game.grid.intersectCollider(
            collider.createCircle(this.pos, this.rad + 5),
        );

        let obstacles: Array<{ pen: number; obstacle: Obstacle }> = [];

        for (let i = 0; i < objs.length; i++) {
            const obstacle = objs[i];
            if (obstacle.__type !== ObjectType.Obstacle) continue;
            if (!obstacle.dead && util.sameLayer(obstacle.layer, this.layer)) {
                if (obstacle.interactionRad > 0) {
                    const res = collider.intersectCircle(
                        obstacle.collider,
                        this.pos,
                        obstacle.interactionRad + this.rad,
                    );
                    if (res) {
                        obstacles.push({
                            pen: res.pen,
                            obstacle,
                        });
                    }
                }
            }
        }
        return obstacles.sort((a, b) => a.pen - b.pen).map((o) => o.obstacle);
    }

    interactWith(obj: GameObject): void {
        switch (obj.__type) {
            case ObjectType.Loot:
                this.pickupLoot(obj);
                break;
            case ObjectType.Obstacle:
                obj.interact(this);
                break;
        }
    }

    getPlayerStatus() {
        const players: Player[] = this.game.map.amongUsMode
            ? this.game.playerBarn.players
            : this.game.modeManager.getPlayerStatusPlayers(this)!;
        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        return players.map((p) => {
            if (isAmongUsMiniGame(this.game.miniGame) || this.game.map.amongUsMode) {
                return {
                    hasData: true,
                    pos: p.pos,
                    dir: p.dir,
                    visible: p === this,
                    dead: p.dead,
                    downed: p.downed,
                    disconnected: p.disconnected,
                    role: p.role,
                    outfit: p.outfit,
                };
            }

            const hiddenByDebug = p.isInvisibleTo(this);
            const hideAndSeekVisible =
                hideAndSeekSettings && this.arenaTeam
                    ? this.arenaTeam === hideAndSeekSettings.hiderTeam ||
                      p.arenaTeam === this.arenaTeam
                    : false;
            const arenaShowsAllPlayers =
                this.game.arenaPrivate && !isBattleRoyaleMapName(this.game.mapName);
            const visible =
                this.game.arenaPrivate && hideAndSeekSettings && this.arenaTeam
                    ? hideAndSeekVisible
                    : arenaShowsAllPlayers ||
                      (!hiddenByDebug &&
                          (p.teamId === this.teamId || p.timeUntilHidden > 0));
            return {
                hasData:
                    (arenaShowsAllPlayers && visible) ||
                    (!hiddenByDebug && visible) ||
                    (!hiddenByDebug && p.playerStatusDirty) ||
                    (hiddenByDebug && p.teamId === this.teamId),
                pos: p.pos,
                visible,
                dead: p.dead,
                downed: p.downed,
                role: p.role,
            };
        });
    }

    getFreeGunSlot(obj: Loot) {
        const gunSlots = [GameConfig.WeaponSlot.Primary, GameConfig.WeaponSlot.Secondary];

        // first loop to find dual wieldable guns
        for (const slot of gunSlots) {
            const slotDef = GameObjectDefs[this.weapons[slot].type] as GunDef | undefined;

            if (slotDef?.dualWieldType && obj.type === this.weapons[slot].type) {
                return {
                    slot,
                    isDual: true,
                    cause: net.PickupMsgType.Success,
                };
            }
        }

        // second loop to find empty slots
        for (const slot of gunSlots) {
            if (this.weapons[slot].type === "") {
                return {
                    slot,
                    isDual: false,
                    cause: net.PickupMsgType.Success,
                };
            }
        }

        // if none are found use active weapon if its a gun
        if (GameConfig.WeaponType[this.curWeapIdx] === "gun") {
            const newGunDef = GameObjectDefs[obj.type] as GunDef;
            return {
                slot: this.curWeapIdx,
                isDual: false,
                cause:
                    this.activeWeapon === obj.type ||
                    newGunDef.dualWieldType === this.weapons[this.curWeapIdx].type
                        ? net.PickupMsgType.AlreadyOwned
                        : net.PickupMsgType.Success,
            };
        }

        return {
            slot: null,
            isDual: false,
            cause: net.PickupMsgType.Full,
        };
    }

    pickupTicker = 0;
    pickupLoot(obj: Loot) {
        if (obj.destroyed) return;

        const def = GameObjectDefs[obj.type];
        if (
            def.type === "gun" &&
            isHideAndSeekHider(this.game.miniGame, this.arenaTeam)
        ) {
            return;
        }
        if (this.game.disableAirstrikes && obj.type === "strobe") return;
        if (this.game.disablePerks && def.type === "perk") return;

        if (
            (this.actionType == GameConfig.Action.UseItem && def.type != "gun") ||
            this.actionType == GameConfig.Action.Revive
        )
            return;

        if (this.pickupTicker > 0) return;
        this.pickupTicker = 0.1;
        let amountLeft = 0;
        let lootToAdd = obj.type;
        const pickupMsg = new net.PickupMsg();
        pickupMsg.item = obj.type;
        pickupMsg.type = net.PickupMsgType.Success;

        switch (def.type) {
            case "ammo":
            case "scope":
            case "heal":
            case "boost":
            case "throwable":
                {
                    const itemType = obj.type;
                    if (!this.invManager.isValid(itemType)) break;

                    const result = this.invManager.give(itemType, obj.count);

                    if (result.added <= 0) {
                        if (def.type === "scope") {
                            pickupMsg.type = net.PickupMsgType.AlreadyOwned;
                        } else {
                            pickupMsg.type = net.PickupMsgType.Full;
                        }
                    }

                    amountLeft = result.remaining;
                }
                break;
            case "melee":
                if (this.weapons[GameConfig.WeaponSlot.Melee].type === obj.type) {
                    pickupMsg.type = net.PickupMsgType.AlreadyEquipped;
                    amountLeft = 1;
                    break;
                }
                this.weaponManager.dropMelee();
                this.weaponManager.setWeapon(GameConfig.WeaponSlot.Melee, obj.type, 0);
                break;
            case "gun":
                {
                    amountLeft = 0;

                    const freeGunSlot = this.getFreeGunSlot(obj);
                    pickupMsg.type = freeGunSlot.cause;
                    let newGunIdx = freeGunSlot.slot;

                    if (newGunIdx === null) {
                        this.pickupTicker = 0;
                        return;
                    }

                    const oldWeapDef = GameObjectDefs[this.weapons[newGunIdx].type] as
                        | GunDef
                        | undefined;
                    if (
                        oldWeapDef &&
                        (oldWeapDef.noDrop || !this.weaponManager.canDropFlare(newGunIdx))
                    ) {
                        this.pickupTicker = 0;
                        return;
                    }

                    if (
                        freeGunSlot.cause === net.PickupMsgType.AlreadyOwned &&
                        !this.game.map.aprilFoolsMode
                    ) {
                        amountLeft = 1;
                        break;
                    }

                    this.pickupTicker = 0.2;

                    let gunType = obj.type;

                    if (def.dualWieldType && freeGunSlot.isDual) {
                        gunType = def.dualWieldType;

                        // cancel reload when going from single to dual
                        if (this.curWeapIdx === newGunIdx && this.isReloading()) {
                            this.cancelAction();

                            if (this.weapons[newGunIdx].ammo <= 0) {
                                this.weaponManager.scheduledReload = true;
                            }
                        }
                    }

                    if (this.game.map.aprilFoolsMode) {
                        gunType = this.game.getRandomAprilFoolsGunType(gunType);
                        pickupMsg.item = obj.type;
                    }

                    const pickedGunDef = GameObjectDefs[gunType] as GunDef;

                    if (obj.isPreloadedGun) {
                        this.invManager.giveAndDrop(
                            pickedGunDef.ammo as InventoryItem,
                            pickedGunDef.ammoSpawnCount,
                        );
                    }

                    // replaces the gun

                    let newAmmo = 0;

                    if (oldWeapDef) {
                        newAmmo =
                            oldWeapDef.dualWieldType === gunType
                                ? this.weapons[newGunIdx].ammo
                                : 0;

                        // inverted logic, there is only 1 case where the old gun should not drop
                        // when youre holding a pistol, and you pick up the same single pistol from the ground
                        // it should turn it into its dual pistol version and drop nothing
                        const shouldDrop = !(
                            (
                                oldWeapDef.dualWieldType && // verifies it's a dual wieldable pistol
                                this.weapons[newGunIdx].type == obj.type
                            ) // verifies the old gun and new gun are the same
                        );
                        if (shouldDrop) {
                            this.weaponManager.dropGun(newGunIdx);
                        }
                    }

                    this.weaponManager.setWeapon(newGunIdx, gunType, newAmmo);
                    this.setDisplayWeaponType(
                        newGunIdx,
                        this.game.map.aprilFoolsMode ? obj.type : gunType,
                    );

                    // always select primary slot if melee is selected
                    if (
                        !freeGunSlot.isDual &&
                        this.curWeapIdx === GameConfig.WeaponSlot.Melee
                    ) {
                        this.weaponManager.setCurWeapIndex(newGunIdx); // primary
                    }
                }
                break;
            case "helmet":
            case "chest":
            case "backpack":
                {
                    const objLevel = this.getGearLevel(obj.type);
                    const thisType = this[def.type];
                    const thisDef = GameObjectDefs[thisType];
                    const thisLevel = this.getGearLevel(thisType);
                    amountLeft = 1;

                    // role helmets and perk helmets can't be dropped in favor of another helmet, they're the "highest" tier
                    if (
                        def.type == "helmet" &&
                        (this.hasRoleHelmet ||
                            (thisDef && (thisDef as HelmetDef).perk) ||
                            (thisDef && (thisDef as HelmetDef).role))
                    ) {
                        amountLeft = 1;
                        lootToAdd = obj.type;
                        pickupMsg.type = net.PickupMsgType.BetterItemEquipped;
                        break;
                    }

                    if (thisType === obj.type) {
                        lootToAdd = obj.type;
                        pickupMsg.type = net.PickupMsgType.AlreadyEquipped;
                    } else if (thisLevel <= objLevel) {
                        lootToAdd = thisType;
                        this[def.type] = obj.type;
                        pickupMsg.type = net.PickupMsgType.Success;

                        // removes roles/perks associated with the dropped role/perk helmet
                        if (thisDef && thisDef.type == "helmet" && thisDef.perk) {
                            this.removePerk(thisDef.perk);
                        }

                        if (thisDef && thisDef.type == "helmet" && thisDef.role) {
                            this.removeRole();
                        }

                        // adds roles/perks associated with the picked up role/perk helmet
                        if (def.type == "helmet" && def.role) {
                            this.promoteToRole(def.role);
                        }

                        if (def.type == "helmet" && def.perk) {
                            this.addPerk(def.perk);
                        }

                        this.setDirty();
                    } else {
                        lootToAdd = obj.type;
                        pickupMsg.type = net.PickupMsgType.BetterItemEquipped;
                    }
                    if (this.getGearLevel(lootToAdd) === 0) lootToAdd = "";
                }
                break;
            case "outfit":
                if (this.role) {
                    const roleDef = GameObjectDefs[this.role] as RoleDef;
                    if (roleDef.defaultItems?.noDropOutfit) {
                        amountLeft = 1;
                        pickupMsg.type = net.PickupMsgType.BetterItemEquipped;
                        break;
                    }
                }

                if (this.outfit === obj.type) {
                    pickupMsg.type = net.PickupMsgType.AlreadyEquipped;
                    amountLeft = 1;
                    break;
                }

                amountLeft = 1;
                lootToAdd = this.outfit;
                pickupMsg.type = net.PickupMsgType.Success;
                this.setOutfit(obj.type);
                break;
            case "perk":
                let type = obj.type;

                const isMistery = type === "halloween_mystery";

                if (isMistery) {
                    type =
                        this.game.lootBarn.getLootTable("tier_halloween_mystery_perks")
                            ?.name || type;
                }

                pickupMsg.item = type;

                if (this.hasPerk(obj.type)) {
                    amountLeft = 1;
                    pickupMsg.type = net.PickupMsgType.AlreadyEquipped;
                    break;
                }

                const emoteType = `emote_${type}`;
                if (GameObjectDefs[`emote_${type}`]) {
                    this.game.playerBarn.addEmote(emoteType, this.__id);
                }

                const perkSlotType = this.perks.find(
                    (p) => p.droppable || p.replaceOnDeath === "halloween_mystery",
                )?.type;
                if (perkSlotType) {
                    amountLeft = 1;
                    lootToAdd = isMistery ? "" : perkSlotType;
                    this.removePerk(perkSlotType);
                    this.addPerk(
                        type,
                        !isMistery,
                        isMistery ? "halloween_mystery" : undefined,
                    );
                } else {
                    this.addPerk(
                        type,
                        !isMistery,
                        isMistery ? "halloween_mystery" : undefined,
                    );
                }
                this.setDirty();
                break;
        }

        const lootToAddDef = GameObjectDefs[lootToAdd] as LootDef;
        if (
            def.type !== "perk" &&
            amountLeft > 0 &&
            lootToAdd !== "" &&
            // if obj you tried picking up can't be picked up and needs to be dropped, "noDrop" is irrelevant
            (obj.type == lootToAdd || !(lootToAddDef as ChestDef).noDrop)
        ) {
            const dir = v2.neg(this.dir);
            this.game.lootBarn.addLootWithoutAmmo(
                lootToAdd,
                v2.add(obj.pos, v2.mul(dir, 0.4)),
                obj.layer,
                amountLeft,
                undefined,
                dir,
            );
        }

        if (pickupMsg.type === net.PickupMsgType.Success) {
            this.pickedUpLoot = true;
        }

        obj.destroy();
        this.msgsToSend.push({
            type: net.MsgType.Pickup,
            msg: pickupMsg,
        });
    }

    // in original game, only called on snowball or potato collision
    dropRandomLoot(): void {
        if (isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;

        // all possible droppable loot held by the player
        // 4 categories: inventory, weapons, armor, perks
        const playerLootTypes: string[] = [];

        for (const [type, count] of Object.entries(this.inventory)) {
            if (count == 0) continue;
            if (type == "1xscope") continue;
            playerLootTypes.push(type);
        }

        for (let i = 0; i < this.weapons.length; i++) {
            if (GameConfig.WeaponType[i] == "throwable") continue;
            const weapon = this.weapons[i];
            if (!weapon.type) continue;
            if (weapon.type == "fists") continue;
            playerLootTypes.push(weapon.type);
        }

        for (let i = 0; i < this.perks.length; i++) {
            const perk = this.perks[i];
            if (!perk.droppable) continue;
            playerLootTypes.push(perk.type);
        }

        for (const armor of [this.helmet, this.chest] as const) {
            if (!armor) continue;
            if ((GameObjectDefs[armor] as ChestDef | HelmetDef).noDrop) continue;
            playerLootTypes.push(armor);
        }

        if (playerLootTypes.length == 0) return;

        const item = playerLootTypes[util.randomInt(0, playerLootTypes.length - 1)];
        const weapIdx = this.weapons.findIndex((w) => w.type == item);

        const dropMsg = new net.DropItemMsg();
        dropMsg.item = item;
        dropMsg.weapIdx = weapIdx;
        this.dropItem(dropMsg);
    }

    /** just used in potato mode, swaps oldWeapon with a random weapon of the same type (mosin -> m9) */
    randomWeaponSwap(params: DamageParams): void {
        if (this.dead) return;
        const oldWeapon = params.weaponSourceType || params.gameSourceType;
        if (!oldWeapon) return;

        const oldWeaponDef = GameObjectDefs[oldWeapon] as
            | GunDef
            | ThrowableDef
            | MeleeDef;

        if (oldWeaponDef.noPotatoSwap) return;
        const weaponDefs = WeaponTypeToDefs[oldWeaponDef.type];
        // necessary for type safety since Object.entries() is not type safe and just returns "any"
        const enumerableDefs = Object.entries(weaponDefs) as [
            string,
            GunDef | ThrowableDef | MeleeDef,
        ][];

        const filterCb: ([_type, def]: [
            string,
            GunDef | ThrowableDef | MeleeDef,
        ]) => boolean = this.hasPerk("rare_potato")
            ? ([_type, def]) =>
                  !def.noPotatoSwap && def.quality == PerkProperties.rare_potato.quality
            : ([_type, def]) => !def.noPotatoSwap;

        const weaponChoices = enumerableDefs.filter(filterCb);
        const [chosenWeaponType, chosenWeaponDef] =
            weaponChoices[util.randomInt(0, weaponChoices.length - 1)];

        let index;
        if (this.activeWeapon === oldWeapon) {
            index = this.curWeapIdx;
        } else {
            index = this.weaponManager.weapons.findIndex((w) => w.type == oldWeapon);
        }

        if (index == -1) {
            // defaults if we can't figure out what slot was used to "trigger" the weapon swap
            switch (oldWeaponDef.type) {
                case "gun":
                    // arbitrary choice
                    index = GameConfig.WeaponSlot.Primary;
                    break;
                case "melee":
                    index = GameConfig.WeaponSlot.Melee;
                    break;
                case "throwable":
                    index = GameConfig.WeaponSlot.Throwable;
                    break;
            }
        }

        const slotDef = GameObjectDefs[this.weapons[index].type] as
            | GunDef
            | MeleeDef
            | ThrowableDef;
        if (slotDef && slotDef.noPotatoSwap) return;

        if (index === this.curWeapIdx && this.isReloading()) {
            this.cancelAction();
        }

        this.weaponManager.setWeapon(
            index,
            chosenWeaponType,
            chosenWeaponDef.type == "gun"
                ? this.weaponManager.getAmmoStats(chosenWeaponDef).maxClip
                : 0,
        );

        if ("switchDelay" in chosenWeaponDef) {
            this.weaponManager.weapons[index].cooldown = chosenWeaponDef.switchDelay;
        }

        if (chosenWeaponDef.type == "gun") {
            const ammo = math.max(
                chosenWeaponDef.ammoSpawnCount - chosenWeaponDef.maxClip,
                0,
            );

            this.invManager.give(chosenWeaponDef.ammo as InventoryItem, ammo);

            if (index === this.curWeapIdx) {
                this.shotSlowdownTimer = 0;
            }
        } else if (
            chosenWeaponDef.type == "throwable" &&
            this.invManager.isValid(chosenWeaponType)
        ) {
            const bagSpace = this.invManager.getMaxCapacity(chosenWeaponType) ?? 0;

            this.invManager.give(chosenWeaponType, math.max(Math.floor(bagSpace / 3), 1));
            this.inventoryDirty = true;
        }

        this.setDirty();

        this.game.playerBarn.addEmote("emote_loot", this.__id, chosenWeaponType);
    }

    dropLoot(type: string, count = 1, useCountForAmmo?: boolean) {
        this.mobileDropTicker = 3;
        this.game.lootBarn.addLoot(
            type,
            this.pos,
            this.layer,
            count,
            useCountForAmmo,
            10,
            v2.neg(this.dir),
            undefined,
            "player",
        );
    }

    dropArmor(item: string): boolean {
        const armorDef = GameObjectDefs[item];
        if (armorDef.type != "chest" && armorDef.type != "helmet") return false;
        if (this[armorDef.type] !== item) return false;
        if (armorDef.noDrop) return false;

        if (armorDef.type == "helmet" && armorDef.role && this.role == armorDef.role) {
            this.removeRole();
            this.hasRoleHelmet = false;
        }

        if (armorDef.type == "helmet" && armorDef.perk && this.hasPerk(armorDef.perk)) {
            this.removePerk(armorDef.perk);
        }

        this.dropLoot(item, 1);
        this[armorDef.type] = "";
        this.setDirty();
        return true;
    }

    dropBackPackCopy(item: string): boolean {
        const armorDef = GameObjectDefs[item];
        if (armorDef.type != "backpack") return false;
        if (this[armorDef.type] !== item) return false;
        if (armorDef.level == 0) return false;

        this.dropLoot(item, 1);
        return true;
    }

    splitUpLoot(item: string, amount: number) {
        const dropCount = Math.floor(amount / 60);
        for (let i = 0; i < dropCount; i++) {
            this.dropLoot(item, 60);
        }
        if (amount % 60 !== 0) {
            this.dropLoot(item, amount % 60);
        }
    }

    customDropItem(dropMsg: net.DropItemMsg): void {
        if (isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;

        const itemDef = GameObjectDefs[dropMsg.item] as LootDef;
        switch (itemDef.type) {
            case "gun":
                if (isItemInLoadout(dropMsg.item, "gun")) break;
                this.weaponManager.dropGun(dropMsg.weapIdx);
                break;
            case "melee":
                if (isItemInLoadout(dropMsg.item, "melee")) break;
                this.weaponManager.dropMelee();
                break;
        }

        const reloading = this.isReloading();
        this.cancelAction();

        if (reloading && this.weapons[this.curWeapIdx].ammo == 0) {
            this.weaponManager.tryReload();
        }
    }
    dropItem(dropMsg: net.DropItemMsg): void {
        if (this.dead) return;
        if (isHideAndSeekHider(this.game.miniGame, this.arenaTeam)) return;

        const battleRoyaleMode = isBattleRoyaleMapName(this.game.mapName);
        if (this.game.map.perkMode && !this.role && !battleRoyaleMode) return;

        const itemDef = GameObjectDefs[dropMsg.item] as LootDef;
        if (!itemDef) return;

        dropMsg.weapIdx = math.clamp(dropMsg.weapIdx, 0, GameConfig.WeaponSlot.Count - 1);

        switch (itemDef.type) {
            case "chest":
            case "helmet": {
                this.dropArmor(dropMsg.item);
                break;
            }
            case "gun":
                if (this.weaponManager.canDropFlare(dropMsg.weapIdx)) {
                    this.weaponManager.dropGun(dropMsg.weapIdx);
                }
                break;
            case "melee":
                this.weaponManager.dropMelee();
                break;
            case "perk": {
                const perkSlotType = this.perks.find(
                    (p) => (p.droppable || battleRoyaleMode) && p.type === dropMsg.item,
                )?.type;
                if (perkSlotType && perkSlotType === dropMsg.item) {
                    this.dropLoot(dropMsg.item);
                    this.removePerk(dropMsg.item);
                    this.setDirty();
                }
                break;
            }
        }

        if (this.invManager.isValid(dropMsg.item)) {
            this.dropInventoryItem(dropMsg.item);
        }

        const reloading = this.isReloading();
        this.cancelAction();

        if (reloading && this.weapons[this.curWeapIdx].ammo === 0) {
            this.weaponManager.scheduledReload = true;
        }
    }

    dropInventoryItem(item: InventoryItem) {
        const itemDef = GameObjectDefs[item];

        if (!this.invManager.has(item)) return;
        const inventoryCount = this.invManager.get(item);

        switch (itemDef.type) {
            case "ammo": {
                let amountToDrop = math.max(1, Math.floor(inventoryCount / 2));

                if (itemDef.minStackSize && inventoryCount <= itemDef.minStackSize) {
                    amountToDrop = math.min(itemDef.minStackSize, inventoryCount);
                } else if (inventoryCount <= 5) {
                    amountToDrop = math.min(5, inventoryCount);
                }

                this.splitUpLoot(item, amountToDrop);
                this.invManager.take(item, amountToDrop);
                break;
            }
            case "scope": {
                this.dropLoot(item, 1);
                this.invManager.take(item, 1);
                break;
            }
            case "heal":
            case "boost": {
                let amountToDrop = math.max(1, Math.floor(inventoryCount / 2));

                this.invManager.take(item, amountToDrop);

                this.dropLoot(item, amountToDrop);
                break;
            }
            case "throwable": {
                if (this.weaponManager.cookingThrowable) break;

                const amountToDrop = Math.max(1, Math.floor(inventoryCount / 2));
                this.splitUpLoot(item, amountToDrop);

                this.invManager.take(item, amountToDrop);
                break;
            }
        }
    }

    setLoadout(loadout: net.JoinMsg["loadout"], useDefaultUnlocks?: boolean) {
        const battleRoyaleMode = isBattleRoyaleMapName(this.game.mapName);
        const defaltUnlocks = UnlockDefs.unlock_default.unlocks;
        /**
         * Checks if an item is present in the player's loadout
         */
        const isItemInLoadout = (item: string, category: string) => {
            if (useDefaultUnlocks && !defaltUnlocks.includes(item)) return false;

            const def = GameObjectDefs[item];
            if (!def || def.type !== category) return false;

            return true;
        };

        if (
            isItemInLoadout(loadout.outfit, "outfit") &&
            loadout.outfit !== "outfitBase"
        ) {
            this.loadout.outfit = loadout.outfit;
            this.setOutfit(loadout.outfit);
        }

        if (isItemInLoadout(loadout.melee, "melee")) {
            this.loadout.melee = loadout.melee;
            this.meleeSkin = loadout.melee;
            this.weapons[GameConfig.WeaponSlot.Melee].type = loadout.melee;
        }

        if (isItemInLoadout(loadout.heal, "heal_effect")) {
            this.loadout.heal = loadout.heal;
        }
        if (isItemInLoadout(loadout.boost, "boost_effect")) {
            this.loadout.boost = loadout.boost;
        }
        if (isItemInLoadout(loadout.death_effect, "death_effect")) {
            this.loadout.death_effect = loadout.death_effect;
        }

        const emotes = loadout.emotes;
        for (let i = 0; i < emotes.length; i++) {
            const emote = emotes[i];
            if (i > GameConfig.EmoteSlot.Count) break;

            if (emote === "" || !isItemInLoadout(emote, "emote")) {
                continue;
            }

            this.loadout.emotes[i] = emote;
        }

        // Only allow perks if the current map supports perkMode
        if (
            !battleRoyaleMode &&
            loadout.perk &&
            loadout.perk !== "" &&
            isItemInLoadout(loadout.perk, "perk") &&
            (this.game.map.perkMode || !!this.game.map.mapDef.gameMode.allowLoadoutPerks)
        ) {
            this.addPerk(loadout.perk, false);
        }

        // Set chosen streak from loadout
        if (!battleRoyaleMode && loadout.streak && DamageStreakDefs[loadout.streak]) {
            this.chosenStreakType = loadout.streak;
        } else {
            this.chosenStreakType = DefaultStreakType;
        }

        // Normal mode: Initialize primary weapon
        if (!battleRoyaleMode && isItemInLoadout(loadout.primary, "gun")) {
            const slot = GameConfig.WeaponSlot.Primary;
            this.weapons[slot].type = this.game.map.aprilFoolsMode
                ? this.game.getRandomAprilFoolsGunType(loadout.primary)
                : loadout.primary;
            const gunDef = GameObjectDefs[this.weapons[slot].type] as GunDef;
            this.weapons[slot].ammo = gunDef.maxClip;
            this.setDisplayWeaponType(
                slot,
                this.game.map.aprilFoolsMode ? loadout.primary : this.weapons[slot].type,
            );
        }

        // Normal mode: Initialize secondary weapon
        if (!battleRoyaleMode && isItemInLoadout(loadout.secondary, "gun")) {
            const slot = GameConfig.WeaponSlot.Secondary;
            this.weapons[slot].type = this.game.map.aprilFoolsMode
                ? this.game.getRandomAprilFoolsGunType(loadout.secondary)
                : loadout.secondary;

            // Disable dual spas in normal mode
            if (
                this.weapons[GameConfig.WeaponSlot.Primary].type === "spas12" &&
                this.weapons[slot].type === "spas12"
            ) {
                this.weapons[slot].type = "mosin";
            }

            if (
                this.weapons[GameConfig.WeaponSlot.Primary].type === "bugle" &&
                this.weapons[slot].type === "bugle"
            ) {
                this.weapons[slot].type = "mosin";
            }

            const gunDef = GameObjectDefs[this.weapons[slot].type] as GunDef;
            this.weapons[slot].ammo = gunDef.maxClip;
            this.setDisplayWeaponType(
                slot,
                this.game.map.aprilFoolsMode
                    ? loadout.secondary
                    : this.weapons[slot].type,
            );
        }

        // Add "inspiration" perk if using "bugle"
        if (
            !battleRoyaleMode &&
            (this.weapons[GameConfig.WeaponSlot.Primary].type == "bugle" ||
                this.weapons[GameConfig.WeaponSlot.Secondary].type == "bugle")
        ) {
            this.addPerk("inspiration", false);
        }

        const weaponOverride = getPrivateLobbyMiniGameWeaponOverride(
            this.game.miniGame,
            this.arenaTeam,
        );
        if (weaponOverride) {
            const slot = GameConfig.WeaponSlot.Primary;
            if (weaponOverride.primary !== undefined) {
                this.weapons[slot].type = weaponOverride.primary;
                this.weapons[slot].ammo = weaponOverride.primary
                    ? (GameObjectDefs[weaponOverride.primary] as GunDef).maxClip
                    : 0;
                this.weapons[slot].cooldown = 0;
                this.setDisplayWeaponType(slot, weaponOverride.primary);
                this.loadout.primary = weaponOverride.primary;
            }

            if (weaponOverride.secondary !== undefined) {
                const secondary = this.weapons[GameConfig.WeaponSlot.Secondary];
                secondary.type = weaponOverride.secondary;
                secondary.ammo = weaponOverride.secondary
                    ? (GameObjectDefs[weaponOverride.secondary] as GunDef).maxClip
                    : 0;
                secondary.cooldown = 0;
                this.setDisplayWeaponType(
                    GameConfig.WeaponSlot.Secondary,
                    weaponOverride.secondary,
                );
                this.loadout.secondary = weaponOverride.secondary;
            }
        }

        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        if (hideAndSeekSettings && this.arenaTeam === hideAndSeekSettings.hiderTeam) {
            this.hideAndSeekPropSwitchesLeft = hideAndSeekSettings.propSwitchLimit;
            this.syncHideAndSeekPropSwitchAmmo();
            for (const throwableType of Object.keys(ThrowableDefs)) {
                this.invManager.set(throwableType as InventoryItem, 0);
            }
            this.invManager.set(
                hideAndSeekSettings.hiderBlindThrowable as InventoryItem,
                hideAndSeekSettings.hiderBlindThrowableCount,
            );
            this.weaponManager.showNextThrowable();
            this.hideAndSeekNoiseTicker = hideAndSeekSettings.hiderNoiseInterval;
            this.streakReady = false;
            this.streakDirty = true;
        } else if (
            hideAndSeekSettings &&
            this.arenaTeam === hideAndSeekSettings.seekerTeam
        ) {
            for (const item of hideAndSeekSettings.seekerRemovedSpawnItems) {
                this.invManager.set(item, 0);
            }
            for (const [item, amount] of Object.entries(
                hideAndSeekSettings.seekerSpawnItems,
            )) {
                this.invManager.set(item as InventoryItem, amount);
            }
        }

        if (this.game.disableAirstrikes) {
            this.invManager.set("strobe", 0);
            if (this.weapons[GameConfig.WeaponSlot.Throwable].type === "strobe") {
                this.weaponManager.showNextThrowable();
            }
        }
    }

    emoteFromMsg(msg: net.EmoteMsg) {
        if (this.dead) return;
        if (this.game.map.perkMode && !this.role) return;
        if (this.emoteHardTicker > 0) return;

        const emoteMsg = msg as net.EmoteMsg;

        const emoteIdx = this.loadout.emotes.indexOf(emoteMsg.type);
        const emoteDef = GameObjectDefs[emoteMsg.type];

        if (emoteMsg.isPing) {
            if (this.debug.teleportToPings) {
                v2.set(this.pos, msg.pos);
                this.setPartDirty();
                this.game.grid.updateObject(this);
            }

            if (emoteDef.type !== "ping") {
                return;
            }
            if (emoteDef.mapEvent) {
                return;
            }

            this.game.playerBarn.addMapPing(emoteMsg.type, emoteMsg.pos, this.__id);
        } else {
            if (emoteDef.type !== "emote") {
                return;
            }

            if (!emoteDef.teamOnly && (emoteIdx < 0 || emoteIdx > 3)) {
                return;
            }

            if (emoteDef.teamOnly) {
                this.game.playerBarn.addEmote(emoteMsg.type, this.__id);
            } else {
                this.emoteFromSlot(emoteIdx);
            }
        }

        this.emoteCounter++;
        if (this.emoteCounter >= GameConfig.player.emoteThreshold) {
            this.emoteHardTicker =
                this.emoteHardTicker > 0
                    ? this.emoteHardTicker
                    : GameConfig.player.emoteHardCooldown * 1.5;
        }
    }

    processEditMsg(msg: net.EditMsg) {
        if (!Config.debug.allowEditMsg || !this.canUseDeveloper) return;

        if (msg.loadNewMap) {
            this.game.map.regenerate(msg.newMapSeed);
        }

        this.debug.zoomEnabled = msg.zoomEnabled;

        this.debug.zoom = msg.zoom;

        this.debug.speedEnabled = msg.speedEnabled;
        this.debug.speed = math.clamp(msg.speed, 1, 10000);

        // only accept ground or underground
        if (msg.toggleLayer) {
            this.layer = this.layer > 0 ? 0 : 1;
            this.setDirty();
        }

        this.debug.noClip = msg.noClip;
        this.debug.teleportToPings = msg.teleportToPings;
        const invisibleChanged = this.debug.invisible !== msg.invisible;
        this.debug.invisible = msg.invisible;
        this.debug.godMode = msg.godMode;
        this.debug.infiniteThrowables = msg.infiniteThrowables;
        this.debug.throwFast = msg.throwFast;
        this.debug.shootFast = msg.shootFast;
        this.debug.punchFast = msg.punchFast;

        if (invisibleChanged) {
            this.playerStatusDirty = true;
        }

        this.debug.moveObjMode.enabled = msg.moveObjs;

        if (msg.drawExplosionDecal) {
            this.game.decalBarn.addDecal(
                "decal_frag_explosion",
                msg.explosionDecalPos,
                this.layer,
                util.randomInt(0, 255),
            );
        }

        if (msg.spawnLootType) {
            const def = GameObjectDefs[msg.spawnLootType];
            if (def && "lootImg" in def) {
                let count = 1;
                if (this.invManager.isValid(msg.spawnLootType)) {
                    count = this.invManager.getMaxCapacity(msg.spawnLootType);
                }
                this.game.lootBarn.addLoot(
                    msg.spawnLootType,
                    this.pos,
                    this.layer,
                    count,
                    false,
                    0,
                );
            }
        }

        if (msg.promoteToRole) {
            if (msg.promoteToRoleType) {
                const def = GameObjectDefs[msg.promoteToRoleType];
                if (def.type === "role") {
                    this.promoteToRole(msg.promoteToRoleType);
                }
            } else if (this.role) {
                this.removeRole();
            }
        }
    }

    doAction(
        actionItem: string,
        actionType: number,
        duration: number,
        targetId: number = 0,
    ) {
        if (this.actionDirty) {
            // action already in progress
            return;
        }

        this.action.targetId = targetId;
        this.action.duration = duration;
        this.action.time = 0;

        this.actionDirty = true;
        this.actionItem = actionItem;
        this.actionType = actionType;
        this.actionSeq++;
        this.setDirty();
    }

    cancelAction(): void {
        if (this.actionType === GameConfig.Action.None) {
            return;
        }

        // If player is reviving a player and this is called, cancel their action
        if (this.playerBeingRevived) {
            const revivedPlayer = this.playerBeingRevived;
            this.playerBeingRevived = undefined;
            if (revivedPlayer == this.revivedBy) {
                this.revivedBy = undefined;
            } else {
                revivedPlayer.revivedBy = undefined;
                revivedPlayer.cancelAction();
                this.cancelAnim();
            }
        }

        // If player is being revived and this is called, cancel the reviver's action
        if (this.revivedBy) {
            const revivingPlayer = this.revivedBy;
            this.revivedBy = undefined;
            if (revivingPlayer.playerBeingRevived) {
                revivingPlayer.playerBeingRevived = undefined;
                revivingPlayer.cancelAction();
                revivingPlayer.cancelAnim();
            }
        }

        this.action.duration = 0;
        this.action.targetId = 0;
        this.action.time = 0;

        this.actionItem = "";
        this.actionType = GameConfig.Action.None;
        this.actionSeq++;
        this.actionDirty = false;
        this.setDirty();
    }

    freeze(frozenOri: number, duration: number): void {
        this.frozenTicker = duration;
        this.frozen = true;
        this.frozenOri = frozenOri;
        this.setDirty();
    }

    initLastBreath(): void {
        this.game.bulletBarn.fireBullet({
            dir: this.dir,
            pos: this.pos,
            bulletType: "bullet_invis",
            gameSourceType: "bugle",
            layer: this.layer,
            damageMult: 1,
            damageType: GameConfig.DamageType.Player,
            playerId: this.__id,
            shotAlt: true,
            shotFx: true,
        });

        const affectedPlayers = this.game.modeManager.getNearbyAlivePlayersContext(
            this,
            60,
        );

        for (const player of affectedPlayers) {
            player.lastBreathActive = true;
            player._lastBreathTicker = 5;

            player.giveHaste(GameConfig.HasteType.Inspire, 5);
            if (player.teamId == 1 && player.__id != this.__id) {
                this.game.playerBarn.addEmote("emote_bugle_final_red", player.__id);
            }
            if (player.teamId == 2 && player.__id != this.__id) {
                this.game.playerBarn.addEmote("emote_bugle_final_blue", player.__id);
            }
            player.recalculateScale();
        }
    }

    playBugle(): void {
        this.bugleTickerActive = true;
        this._bugleTicker = 8;

        const affectedPlayers = this.game.modeManager.getNearbyAlivePlayersContext(
            this,
            30,
        );

        for (const player of affectedPlayers) {
            player.giveHaste(GameConfig.HasteType.Inspire, 3);
            if (player.teamId == 1 && player.__id != this.__id) {
                this.game.playerBarn.addEmote("emote_bugle_inspiration_red", player.__id);
            }
            if (player.teamId == 2 && player.__id != this.__id) {
                this.game.playerBarn.addEmote(
                    "emote_bugle_inspiration_blue",
                    player.__id,
                );
            }
        }
    }

    incrementFat() {
        this.fatTicker = 2.5;
        if (this.fatModifier > 0.6) return;
        this.fatModifier += 0.06;
        this.recalculateScale();
    }

    giveHaste(type: HasteType, duration: number): void {
        this.hasteType = type;
        this.hasteSeq++;
        this._hasteTicker = duration;
        this.setDirty();
    }

    playAnim(type: Anim, duration: number): void {
        this.animType = type;
        this.animSeq++;
        this.setDirty();
        this._animTicker = duration;
    }

    cancelAnim(): void {
        this.animType = GameConfig.Anim.None;
        this.animSeq++;
        this._animTicker = 0;
        this.setDirty();
    }

    emoteFromSlot(slot: EmoteSlot) {
        let emote = this.loadout.emotes[slot];

        if (!emote) return;

        if (this.game.map.potatoMode) {
            emote = "emote_potato";
        }

        this.game.playerBarn.addEmote(emote, this.__id);
    }

    recalculateScale() {
        let scale = 1;
        for (let i = 0; i < this.perks.length; i++) {
            const perk = this.perks[i].type;
            const perkProps = PerkProperties[perk as keyof typeof PerkProperties];
            if (typeof perkProps === "object" && "scale" in perkProps) {
                scale += perkProps.scale as number;
            }
        }

        if (this.lastBreathActive) {
            scale += PerkProperties.final_bugle.scaleOnDeath;
        }

        scale += this.fatModifier;

        scale = math.clamp(
            scale,
            net.Constants.PlayerMinScale,
            net.Constants.PlayerMaxScale,
        );

        if (scale === this.scale) return;

        this.scale = scale;

        this.collider.rad = this.rad;

        this.bounds = collider.createAabbExtents(
            v2.create(0, 0),
            v2.create(
                GameConfig.player.maxVisualRadius * this.scale,
                GameConfig.player.maxVisualRadius * this.scale,
            ),
        );

        this.setDirty();
    }

    recalculateMinBoost() {
        this.minBoost = 0;
        for (let i = 0; i < this.perks.length; i++) {
            const perk = this.perks[i].type;
            const perkProps = PerkProperties[perk as keyof typeof PerkProperties];
            if (typeof perkProps === "object" && "minBoost" in perkProps) {
                this.minBoost = math.max(perkProps.minBoost as number, this.minBoost);
            }
        }
    }

    recalculateSpeed(hasTreeClimbing: boolean): void {
        if (this.debug.speedEnabled) {
            this.speed = this.debug.speed;
        } else if (this.actionType == GameConfig.Action.Revive) {
            // prevents self reviving players from getting an unnecessary speed boost
            if (this.action.targetId && !(this.downed && this.hasPerk("self_revive"))) {
                // player reviving
                this.speed = GameConfig.player.downedMoveSpeed + 2; // not specified in game config so i just estimated
            } else {
                // player being revived
                this.speed = GameConfig.player.downedRezMoveSpeed;
            }
        } else if (this.downed) {
            this.speed = GameConfig.player.downedMoveSpeed;
        } else {
            this.speed = GameConfig.player.moveSpeed;
        }

        // if melee is selected increase speed
        const weaponDef = GameObjectDefs[this.activeWeapon] as
            | GunDef
            | MeleeDef
            | ThrowableDef;
        if (this.weaponManager.meleeAttacks.length == 0) {
            let equipSpeed = weaponDef.speed.equip;
            if (this.hasPerk("small_arms") && weaponDef.type == "gun") {
                equipSpeed = 1;
            }

            this.speed += equipSpeed;
        }

        if (this.shotSlowdownTimer > 0 && weaponDef.speed.attack !== undefined) {
            this.speed += weaponDef.speed.attack;
        }

        // if player is on water decrease speed
        const isOnWater = this.game.map.isOnWater(this.pos, this.layer);
        if (isOnWater) {
            this.speed -= hasTreeClimbing
                ? -PerkProperties.tree_climbing.waterSpeedBoost
                : GameConfig.player.waterSpeedPenalty;
        }

        // increase speed when adrenaline is above 50%
        if (this.boost >= 50) {
            this.speed += GameConfig.player.boostMoveSpeed;
        }

        if (this.animType === GameConfig.Anim.Cook) {
            this.speed -= GameConfig.player.cookSpeedPenalty;
        }

        if (this.hasteType != GameConfig.HasteType.None) {
            this.speed += GameConfig.player.hasteSpeedBonus;
        }

        if (this.frozen) {
            this.speed -= GameConfig.player.frozenSpeedPenalty;
        }

        const hasFieldMedic = this.hasPerk("field_medic");
        // decrease speed if shooting or popping adren or heals
        // field_medic perk doesn't slow you down while you heal
        if (
            this.shotSlowdownTimer > 0 ||
            (!hasFieldMedic && this.actionType == GameConfig.Action.UseItem)
        ) {
            this.speed *= 0.5;
        }

        if (hasFieldMedic && this.actionType == GameConfig.Action.UseItem) {
            this.speed += PerkProperties.field_medic.speedBoost;
        }

        // melee_runner perk: increase movement speed by multiplier while holding a melee weapon
        if ((weaponDef as any).type === "melee" && this.hasPerk("melee_runner")) {
            const mult = PerkProperties.melee_runner.meleeSpeedMult as number;
            if (mult && mult > 0) this.speed *= mult;
        }

        // low HP surge perk
        if (this.lowHpSurgeTicker > 0 && this.hasPerk("low_hp_surge")) {
            const mult = (PerkProperties.low_hp_surge as any)?.speedMult ?? 1.3;
            if (mult && mult > 0) this.speed *= mult;
        }

        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        if (hideAndSeekSettings && this.arenaTeam === hideAndSeekSettings.seekerTeam) {
            this.speed *= hideAndSeekSettings.seekerSpeedMultiplier;
        }

        const infectedSettings = getInfectedSettings(this.game.miniGame);
        if (infectedSettings && this.arenaTeam === infectedSettings.zombieTeam) {
            this.speed *= infectedSettings.zombieSpeedMultiplier;
        }

        this.speed = math.clamp(this.speed, 1, 10000);
    }

    logPlayerIp() {
        const game = this.game;
        try {
            const logData: IpLogsTableInsert = {
                ip: this.ip,
                findGameIp: this.findGameIp,
                encodedIp: this.encodedIp,
                findGameEncodedIp: this.findGameEncodedIp,
                mapId: game.map.mapId,
                region: Config.gameServer.thisRegion,
                username: this.name,
                userId: this.userId,
                teamMode: game.teamMode,
                gameId: game.id,
            };

            // we don't await
            logIpToDiscord(logData.username, logData.encodedIp);
        } catch (err) {
            game.logger.error(`Failed to fetch API save game:`, err);
        }
    }

    sendMsg(type: net.MsgType, msg: net.AbstractMsg, bytes = 128): void {
        const stream = new net.MsgStream(new ArrayBuffer(bytes));
        stream.serializeMsg(type, msg);
        this.sendData(stream.getBuffer());
    }

    sendData(buffer: Uint8Array): void {
        this.game.sendSocketMsg(this.socketId, buffer);
    }

    usePulseItem(item: InventoryItem): void {
        const itemDef = GameObjectDefs[item];
        if (!itemDef || itemDef.type !== "boost") return;
        if (!this.inventory[item]) return;

        this.cancelAction();
        this.doAction(item, GameConfig.Action.UseItem, itemDef.useTime);
    }
}
