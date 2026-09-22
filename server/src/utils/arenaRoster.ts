import { randomInt } from "node:crypto";
import type { ArenaTeam } from "../../../shared/defs/miniGame";

interface LobbyPlayer {
    isLeader: boolean;
    inGame: boolean;
}

interface ArenaRoster<P extends LobbyPlayer> {
    players: P[];
    data: { arena: boolean; findingGame: boolean; maxPlayers: number };
    arenaTeams: Map<P, ArenaTeam>;
    arenaSpectators: Set<P>;
    battleRoyaleTeams: Map<P, string>;
    isBattleRoyaleArena(): boolean;
    getActiveArenaTeams(): ArenaTeam[];
    getArenaTeamCapacity(): number;
    getBattleRoyaleTeamCapacity(): number;
    generateBattleRoyaleTeamCode(): string;
}

function shuffled<T>(values: T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** One owner-only lobby mutation; never move rosters during a running match. */
export function applyArenaRosterAction<P extends LobbyPlayer>(
    room: ArenaRoster<P>,
    actor: P,
    action: "spectateAll" | "shuffleTeams",
): boolean {
    if (
        !room.data.arena ||
        !actor.isLeader ||
        !room.players.includes(actor) ||
        room.data.findingGame ||
        room.players.some((player) => player.inGame)
    )
        return false;

    room.arenaTeams.clear();
    room.battleRoyaleTeams.clear();
    room.arenaSpectators.clear();
    for (const player of room.players) room.arenaSpectators.add(player);
    if (action === "spectateAll") return true;

    const players = shuffled(room.players);
    if (room.isBattleRoyaleArena()) {
        const entrants = players.slice(0, room.data.maxPlayers);
        const teamCount = Math.ceil(entrants.length / room.getBattleRoyaleTeamCapacity());
        const codes: string[] = [];
        entrants.forEach((player, i) => {
            const team = i % teamCount;
            codes[team] ??= room.generateBattleRoyaleTeamCode();
            room.battleRoyaleTeams.set(player, codes[team]);
            room.arenaSpectators.delete(player);
        });
    } else {
        const teams = shuffled(room.getActiveArenaTeams());
        players
            .slice(0, teams.length * room.getArenaTeamCapacity())
            .forEach((player, i) => {
                room.arenaTeams.set(player, teams[i % teams.length]);
                room.arenaSpectators.delete(player);
            });
    }
    return true;
}
