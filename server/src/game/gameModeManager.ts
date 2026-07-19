import type { AmongUsRole } from "../../../shared/defs/amongUsRoleDefs";
import { TeamColor } from "../../../shared/defs/maps/factionDefs";
import { GameConfig, TeamMode } from "../../../shared/gameConfig";
import { ObjectType } from "../../../shared/net/objectSerializeFns";
import type { PlayerStatus } from "../../../shared/net/updateMsg";
import { collider } from "../../../shared/utils/collider";
import { util } from "../../../shared/utils/util";
import { v2 } from "../../../shared/utils/v2";
import { isBattleRoyaleMapName } from "../battleroyale/helpers";
import type { Game } from "./game";
import type { DamageParams } from "./objects/gameObject";
import type { Player } from "./objects/player";
import {
    getHideAndSeekSettings,
    getInfectedSettings,
    isHideAndSeekHider,
    isHideAndSeekSeeker,
    isInfectedHuman,
    isInfectedZombie,
} from "./privateLobbyMiniGames";

enum GameMode {
    /** default solos, any map besides factions */
    Solo,
    /** default duos or squads, any map besides factions */
    Team,
    /** irrelevant to gamemode type, always the mode if faction map is selected */
    Faction,
}

export class GameModeManager {
    readonly game: Game;
    readonly mode: GameMode;
    readonly isSolo: boolean;
    readonly revivesEnabled: boolean;

    constructor(game: Game) {
        this.game = game;

        this.mode = [
            game.teamMode == TeamMode.Solo && !game.map.factionMode,
            game.teamMode != TeamMode.Solo && !game.map.factionMode,
            game.map.factionMode,
        ].findIndex((isMode) => isMode);

        this.isSolo = this.mode === GameMode.Solo;
        this.revivesEnabled =
            game.teamMode != TeamMode.Solo && isBattleRoyaleMapName(game.mapName);
    }

    aliveCount(): number {
        switch (this.mode) {
            case GameMode.Solo:
                return this.game.playerBarn.livingPlayers.length;
            case GameMode.Team:
                return this.game.playerBarn.getAliveGroups().length;
            case GameMode.Faction:
                return this.game.playerBarn.getAliveTeams().length;
        }
    }

    // so the game doesn't start when there's only 2 players and one can of them can despawn which would end the game
    // instead it will await 10 seconds for the second player to not be able to despawn before starting
    cantDespawnAliveCount(): number {
        switch (this.mode) {
            case GameMode.Solo:
                return this.game.playerBarn.livingPlayers.filter((p) => !p.canDespawn())
                    .length;
            case GameMode.Team:
                return this.game.playerBarn.getAliveGroups().filter((group) => {
                    return group.players.filter((p) => !p.canDespawn()).length > 0;
                }).length;
            case GameMode.Faction:
                return this.game.playerBarn.getAliveTeams().filter((team) => {
                    return team.players.filter((p) => !p.canDespawn()).length;
                }).length;
        }
    }

    // used when saving the game match data
    getPlayersSortedByRank(): Array<{ player: Player; rank: number }> {
        const players = [...this.game.playerBarn.matchPlayers];

        if (this.game.map.amongUsMode && this.game.amongUsWinningRole) {
            const winningRole = this.game.amongUsWinningRole;
            return players
                .sort((a, b) => {
                    const aRank = this.getAmongUsRank(a, winningRole);
                    const bRank = this.getAmongUsRank(b, winningRole);
                    if (aRank !== bRank) return aRank - bRank;
                    return b.killedIndex - a.killedIndex;
                })
                .map((player) => ({
                    player,
                    rank: this.getAmongUsRank(player, winningRole),
                }));
        }

        switch (this.mode) {
            case GameMode.Solo: {
                return players
                    .sort((a, b) => {
                        return b.killedIndex - a.killedIndex;
                    })
                    .map((player, idx) => {
                        return {
                            player,
                            rank: idx + 1,
                        };
                    });
            }
            case GameMode.Team:
            case GameMode.Faction: {
                // the logic is basically the exact same for both
                // just uses team instead of group on faction...

                const getRankKey = (player: Player) =>
                    this.mode === GameMode.Faction ? player.teamId : player.groupId;
                const groupsByRankKey = new Map<number, Player[]>();

                for (const player of players) {
                    const rankKey = getRankKey(player);
                    const groupPlayers = groupsByRankKey.get(rankKey);
                    if (groupPlayers) {
                        groupPlayers.push(player);
                    } else {
                        groupsByRankKey.set(rankKey, [player]);
                    }
                }

                // calculate each group killed index
                // by basing it on the last player to die killed index
                const groups = Array.from(groupsByRankKey.values()).map(
                    (groupPlayers) => {
                        return {
                            killedIndex:
                                groupPlayers.sort((a, b) => {
                                    return b.killedIndex - a.killedIndex;
                                })[0].killedIndex ?? Infinity,
                            players: groupPlayers,
                        };
                    },
                );

                groups.sort((a, b) => b.killedIndex - a.killedIndex);

                let data: Array<{ player: Player; rank: number }> = [];

                for (let i = 0; i < groups.length; i++) {
                    for (const player of groups[i].players) {
                        data.push({
                            player,
                            rank: i + 1,
                        });
                    }
                }

                return data;
            }
        }
    }

    /** true if game needs to end */
    handleGameEnd(): boolean {
        if (this.game.dominationManager.enabled) {
            if (!this.game.started) return false;
            if (this.game.dominationManager.hasReachedScoreLimit()) {
                const winner = this.game.dominationManager.getWinningTeamId();
                if (winner) return this.game.dominationManager.endWithWinner(winner);
            }
            if (
                this.game.gas.finalCloseStarted ||
                this.game.startedTime >=
                    (this.game.dominationManager.settings?.matchDuration ?? 600)
            ) {
                return this.game.dominationManager.endWithWinner(
                    this.game.dominationManager.getWinningTeamId(),
                );
            }
            return false;
        }

        if (this.game.kingOfTheHillManager.enabled) {
            if (!this.game.started) return false;
            if (this.game.kingOfTheHillManager.hasReachedScoreLimit()) {
                const winningTeamId = this.game.kingOfTheHillManager.getWinningTeamId();
                if (winningTeamId) {
                    return this.game.kingOfTheHillManager.endWithWinner(winningTeamId);
                }
            }
            if (
                this.game.gas.finalCloseStarted ||
                this.game.startedTime >=
                    (this.game.kingOfTheHillManager.settings?.matchDuration ?? 600)
            ) {
                const winningTeamId = this.game.kingOfTheHillManager.getWinningTeamId();
                return this.game.kingOfTheHillManager.endWithWinner(winningTeamId);
            }
            return false;
        }

        if (this.game.captureTheFlagManager.enabled) {
            if (!this.game.started) return false;
            if (this.game.captureTheFlagManager.hasReachedScoreLimit()) {
                const winningTeamId = this.game.captureTheFlagManager.getWinningTeamId();
                if (winningTeamId) {
                    return this.game.captureTheFlagManager.endWithWinner(winningTeamId);
                }
            }
            if (
                this.game.gas.finalCloseStarted ||
                this.game.startedTime >=
                    (this.game.captureTheFlagManager.settings?.matchDuration ?? 600)
            ) {
                const winningTeamId = this.game.captureTheFlagManager.getWinningTeamId();
                return this.game.captureTheFlagManager.endWithWinner(winningTeamId);
            }
            return false;
        }

        const hideAndSeekSettings = getHideAndSeekSettings(this.game.miniGame);
        if (hideAndSeekSettings) {
            if (!this.game.started) return false;

            const hiders = this.game.playerBarn.players.filter(
                (p) =>
                    !p.dead &&
                    !p.disconnected &&
                    isHideAndSeekHider(this.game.miniGame, p.arenaTeam),
            );
            const seekers = this.game.playerBarn.players.filter(
                (p) =>
                    !p.dead &&
                    !p.disconnected &&
                    isHideAndSeekSeeker(this.game.miniGame, p.arenaTeam),
            );

            if (hiders.length === 0 && seekers.length > 0) {
                for (const player of seekers) {
                    player.addGameOverMsg(seekers[0].teamId);
                }
                return true;
            }

            if (seekers.length === 0 && hiders.length > 0) {
                for (const player of this.game.playerBarn.players) {
                    player.addGameOverMsg(hiders[0].teamId);
                }
                return true;
            }

            if (this.game.hideAndSeekHidersWon && hiders.length > 0) {
                for (const player of this.game.playerBarn.players) {
                    player.addGameOverMsg(hiders[0].teamId);
                }
                return true;
            }

            return false;
        }

        const infectedSettings = getInfectedSettings(this.game.miniGame);
        if (infectedSettings) {
            if (!this.game.started) return false;

            const humans = this.game.playerBarn.players.filter(
                (p) =>
                    !p.dead &&
                    !p.disconnected &&
                    isInfectedHuman(this.game.miniGame, p.arenaTeam),
            );
            const zombies = this.game.playerBarn.players.filter(
                (p) =>
                    !p.disconnected && isInfectedZombie(this.game.miniGame, p.arenaTeam),
            );

            if (humans.length === 0 && zombies.length > 0) {
                for (const player of zombies) {
                    player.addGameOverMsg(zombies[0].teamId);
                }
                return true;
            }

            if (this.game.infectedHumansWon && humans.length > 0) {
                for (const player of this.game.playerBarn.players) {
                    player.addGameOverMsg(humans[0].teamId);
                }
                return true;
            }

            return false;
        }

        if (this.game.map.amongUsMode) {
            if (!this.game.started) return false;
            if (!this.game.playerBarn.amongUsRolesAssigned) return false;

            const living = this.game.playerBarn.players.filter(
                (player) => !player.dead && !player.disconnected,
            );
            const impostors = living.filter(
                (player) => player.amongUsRole === "impostor",
            );
            const crewmates = living.filter(
                (player) => player.amongUsRole !== "impostor",
            );

            if (impostors.length === 0 && crewmates.length > 0) {
                return this.endAmongUsGame("crewmate");
            }

            if (impostors.length > 0 && crewmates.length <= impostors.length) {
                return this.endAmongUsGame("impostor");
            }

            return false;
        }

        if (!this.game.started || this.aliveCount() > 1) return false;
        switch (this.mode) {
            case GameMode.Solo: {
                const winner = this.game.playerBarn.livingPlayers[0];
                winner.addGameOverMsg(winner.teamId);
                return true;
            }
            case GameMode.Team: {
                const winner = this.game.playerBarn.getAliveGroups()[0];
                for (const player of winner.getAlivePlayers()) {
                    player.addGameOverMsg(winner.id);
                }
                return true;
            }
            case GameMode.Faction: {
                const winner = this.game.playerBarn.getAliveTeams()[0];
                for (const player of winner.livingPlayers) {
                    player.addGameOverMsg(winner.id);
                }
                return true;
            }
        }
    }

    private endAmongUsGame(winningRole: AmongUsRole): true {
        this.game.amongUsWinningRole = winningRole;
        for (const player of this.game.playerBarn.players) {
            const won = this.getAmongUsRank(player, winningRole) === 1;
            player.addGameOverMsg(won ? player.teamId : 0, { gameOver: true });
        }
        return true;
    }

    private getAmongUsRank(player: Player, winningRole: AmongUsRole): 1 | 2 {
        return (
            winningRole === "crewmate"
                ? player.amongUsRole !== "impostor"
                : player.amongUsRole === winningRole
        )
            ? 1
            : 2;
    }

    isGameStarted(): boolean {
        if (this.game.arenaPrivate && this.game.arenaStartLockTimer > 0) {
            return false;
        }
        if (
            this.game.captureTheFlagManager.enabled ||
            this.game.kingOfTheHillManager.enabled ||
            this.game.dominationManager.enabled
        ) {
            let redAlive = false;
            let blueAlive = false;
            for (const player of this.game.playerBarn.livingPlayers) {
                if (player.disconnected || player.spectatorOnly) continue;
                if (
                    player.arenaTeam === "A" ||
                    (!player.arenaTeam && player.teamId === 1)
                ) {
                    redAlive = true;
                } else if (
                    player.arenaTeam === "B" ||
                    (!player.arenaTeam && player.teamId === 2)
                ) {
                    blueAlive = true;
                }
                if (redAlive && blueAlive) return true;
            }
            return false;
        }
        if (this.game.map.amongUsMode) {
            return this.game.trueAliveCount >= this.game.amongUsImpostorCount * 2 + 1;
        }
        if (this.game.arenaPrivate) {
            return this.aliveCount() > 1;
        }
        return this.cantDespawnAliveCount() > 1;
    }

    updateAliveCounts(aliveCounts: number[]): void {
        if (
            this.game.captureTheFlagManager.enabled ||
            this.game.kingOfTheHillManager.enabled ||
            this.game.dominationManager.enabled
        ) {
            let redAlive = 0;
            let blueAlive = 0;
            for (const player of this.game.playerBarn.livingPlayers) {
                if (player.disconnected || player.spectatorOnly) continue;
                if (
                    player.arenaTeam === "A" ||
                    (!player.arenaTeam && player.teamId === 1)
                ) {
                    redAlive++;
                } else if (
                    player.arenaTeam === "B" ||
                    (!player.arenaTeam && player.teamId === 2)
                ) {
                    blueAlive++;
                }
            }
            aliveCounts.push(redAlive, blueAlive);
            return;
        }

        switch (this.mode) {
            case GameMode.Solo:
            case GameMode.Team:
                aliveCounts.push(this.game.aliveCount);
                break;
            case GameMode.Faction:
                const numFactions = this.game.map.mapDef.gameMode.factions!;
                for (let i = 0; i < numFactions; i++) {
                    aliveCounts.push(this.game.playerBarn.teams[i].livingPlayers.length);
                }
                break;
        }
    }

    /**
     * Solos: all living players in game wrapped in outer array
     *
     * Duos/Squads: 2D array of living players in each group
     *
     * Factions: 2D array of living players on each team
     */
    getAlivePlayersContext(): Player[][] {
        switch (this.mode) {
            case GameMode.Solo:
                return [this.game.playerBarn.livingPlayers];
            case GameMode.Team:
                return this.game.playerBarn.groups.map((g) => g.livingPlayers);
            case GameMode.Faction:
                return this.game.playerBarn.teams.map((t) => t.livingPlayers);
        }
    }

    getPlayerStatusPlayers(player: Player): Player[] {
        if (this.game.arenaPrivate) {
            return this.game.playerBarn.players;
        }
        switch (this.mode) {
            case GameMode.Solo:
                return [];
            case GameMode.Team:
                return player.group!.players;
            case GameMode.Faction:
                return this.game.playerBarn.players;
        }
    }

    getPlayerAlivePlayersContext(player: Player): Player[] {
        switch (this.mode) {
            case GameMode.Solo:
                return !player.dead ? [player] : [];
            case GameMode.Team:
                return player.group!.livingPlayers;
            case GameMode.Faction:
                return player.team!.livingPlayers;
        }
    }

    /** includes passed in player */
    getNearbyAlivePlayersContext(player: Player, range: number): Player[] {
        const alivePlayersContext = this.getPlayerAlivePlayersContext(player);

        // probably more efficient when there's 4 or less players in the context (untested)
        if (alivePlayersContext.length <= 4) {
            return alivePlayersContext.filter(
                (p) =>
                    !!util.sameLayer(player.layer, p.layer) &&
                    v2.lengthSqr(v2.sub(player.pos, p.pos)) <= range * range,
            );
        }

        return this.game.grid
            .intersectCollider(collider.createCircle(player.pos, range))
            .filter(
                (obj): obj is Player =>
                    obj.__type == ObjectType.Player &&
                    player.teamId === obj.teamId &&
                    !obj.dead && // necessary since player isnt deleted from grid on death
                    !!util.sameLayer(player.layer, obj.layer) &&
                    v2.lengthSqr(v2.sub(player.pos, obj.pos)) <= range * range,
            );
    }

    getGameoverPlayers(player: Player): Player[] {
        switch (this.mode) {
            case GameMode.Solo:
                return this.game.playerBarn.matchPlayers;
            case GameMode.Team:
                return this.game.playerBarn.matchPlayers;
            case GameMode.Faction:
                const redLeader = this.game.playerBarn.teams[TeamColor.Red - 1].leader;
                const blueLeader = this.game.playerBarn.teams[TeamColor.Blue - 1].leader;
                const highestKiller = this.game.playerBarn.players.reduce(
                    (highestKiller, p) => {
                        const highestKillerKills =
                            this.game.playerBarn.getTrackedKills(highestKiller);
                        const playerKills = this.game.playerBarn.getTrackedKills(p);

                        if (highestKillerKills === playerKills) {
                            return highestKiller.damageDealt > p.damageDealt
                                ? highestKiller
                                : p;
                        }

                        return highestKillerKills > playerKills ? highestKiller : p;
                    },
                );

                // if game ends before leaders are promoted, just show the player by himself
                return !redLeader || !blueLeader
                    ? [player]
                    : [player, redLeader, blueLeader, highestKiller];
        }
    }

    /**
     * gives all the players spectating the player who died a new player to spectate
     * @param player player who died
     */
    assignNewSpectate(player: Player): void {
        // This method doesn't use a mode switchcase like all the other methods in this class,
        // as the spectate logic is identitical with the sole exception of narrowing random players
        // in 50v50: random players spectated in 50v50 should be on the same team as the spectator.

        // If there are no spectators, we have no need to run any logic.
        if (player.spectatorCount === 0) return;

        // Priority list of spectate targets.
        const spectateTargets = [
            player.getAliveKiller(),
            player.group?.randomPlayer(), // undefined if no player to choose
            player.team?.randomPlayer(), // undefined if no player to choose
            player.game.playerBarn.randomPlayer(),
        ];

        const playerToSpec = spectateTargets.filter((x) => x !== undefined).shift();
        for (const spectator of player.spectators) {
            // If all group members have died, they need to be sent a game over message instead.
            if (
                player.group &&
                player.group.allDeadOrDisconnected &&
                player.group.players.includes(spectator)
            )
                continue;

            // Set remaining spectators to new player.
            spectator.spectating = playerToSpec;
        }
    }

    getPlayerStatuses(player: Player): PlayerStatus[] {
        if (this.isSolo) return [];

        const players: Player[] = this.getPlayerStatusPlayers(player)!;
        return players.map((p) => ({
            hasData: p.playerStatusDirty,
            pos: p.pos,
            visible: p.teamId === player.teamId || p.timeUntilHidden > 0,
            dead: p.dead,
            downed: p.downed,
            role: p.role,
        }));
    }
    handlePlayerDeath(player: Player, params: DamageParams): void {
        if (this.game.captureTheFlagManager.enabled) {
            this.game.captureTheFlagManager.onPlayerDeath(player);
            player.kill(params);
            player.captureTheFlagRespawnTicker = 5;
            return;
        }

        if (this.game.kingOfTheHillManager.enabled) {
            player.kill(params);
            player.captureTheFlagRespawnTicker = 5;
            return;
        }

        if (this.game.dominationManager.enabled) {
            player.kill(params);
            player.captureTheFlagRespawnTicker = 5;
            return;
        }

        if (this.isSolo) {
            player.kill(params);
        } else {
            const group = this.mode === GameMode.Faction ? player.team! : player.group!;

            const playerSource =
                params.source?.__type === ObjectType.Player
                    ? (params.source as Player)
                    : undefined;
            if (player.downed) {
                const finishedByTeammate =
                    player.downedBy &&
                    playerSource &&
                    player.downedBy.teamId === playerSource.teamId;

                const nonPlayerKill =
                    player.downedBy && params.damageType != GameConfig.DamageType.Player;

                // give kill credit to the person that downed the player if it was killed by:
                // a teammate, bleeding or non player source (airstrike, gas etc)
                if (finishedByTeammate || nonPlayerKill) {
                    params.killCreditSource = player.downedBy;
                }

                player.kill(params);
                // special case that only happens when the player has self_revive since the teammates wouldnt have previously been finished off
                if (group.checkAllDowned(player) && !group.checkSelfRevive()) {
                    // don't kill teammates if any one has self revive
                    group.killAllTeammates();
                }
                return;
            }

            const allDeadOrDisconnected = group.checkAllDeadOrDisconnected(player);
            const allDowned = group.checkAllDowned(player);
            const groupHasSelfRevive = group.checkSelfRevive();

            if (!groupHasSelfRevive && (allDeadOrDisconnected || allDowned)) {
                group.allDeadOrDisconnected = true; // must set before any kill() calls so the gameovermsgs are accurate
                player.kill(params);
                if (allDowned) {
                    group.killAllTeammates();
                }
            } else if (this.revivesEnabled) {
                player.down(params);
            } else {
                player.kill(params);
            }
        }
    }
}
