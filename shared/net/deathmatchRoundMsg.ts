import { type ArenaTeam, ArenaTeamIds } from "../defs/miniGame";
import type { AbstractMsg, BitStream } from "./net";

export class DeathmatchRoundMsg implements AbstractMsg {
    firstTo = 1;
    roundNumber = 1;
    roundOver = false;
    matchOver = false;
    nextRoundIn = 0;
    winner: ArenaTeam | undefined;
    teams: { team: ArenaTeam; teamId: number; wins: number }[] = [];

    serialize(s: BitStream) {
        s.writeUint8(this.firstTo);
        s.writeUint16(this.roundNumber);
        s.writeBoolean(this.roundOver);
        s.writeBoolean(this.matchOver);
        s.writeUint8(Math.ceil(this.nextRoundIn));
        s.writeUint8(this.winner ? ArenaTeamIds.indexOf(this.winner) + 1 : 0);
        s.writeArray(this.teams, 8, ({ team, teamId, wins }) => {
            s.writeUint8(ArenaTeamIds.indexOf(team));
            s.writeUint8(teamId);
            s.writeUint8(wins);
        });
    }

    deserialize(s: BitStream) {
        this.firstTo = s.readUint8();
        this.roundNumber = s.readUint16();
        this.roundOver = s.readBoolean();
        this.matchOver = s.readBoolean();
        this.nextRoundIn = s.readUint8();
        this.winner = ArenaTeamIds[s.readUint8() - 1];
        this.teams = s.readArray(8, () => ({
            team: ArenaTeamIds[s.readUint8()],
            teamId: s.readUint8(),
            wins: s.readUint8(),
        }));
    }
}
