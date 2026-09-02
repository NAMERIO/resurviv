import { type Vec2, v2 } from "../utils/v2";
import type { AbstractMsg, BitStream } from "./net";

export enum PlantTheBombPhase {
    Round,
    Planted,
    RoundEnd,
}

export enum PlantTheBombEvent {
    None,
    PickedUp,
    Dropped,
    Planted,
    Defused,
    Detonated,
    RoundWon,
    RoundDraw,
}

export enum PlantTheBombState {
    AtSpawn,
    Carried,
    Dropped,
    Planted,
}

export class PlantTheBombMsg implements AbstractMsg {
    redScore = 0;
    blueScore = 0;
    totalRounds = 10;
    roundNumber = 1;
    attackerTeamId: 1 | 2 = 1;
    phase = PlantTheBombPhase.Round;
    roundTimeLeft = 120;
    bombTimeLeft = 45;
    activeSite: 0 | 1 | 2 = 0;
    bombState = PlantTheBombState.AtSpawn;
    bombPos = v2.create(0, 0);
    bombCarrierId = 0;
    winningTeamId: 0 | 1 | 2 = 0;
    event = PlantTheBombEvent.None;
    actorPlayerId = 0;
    sites: [Vec2, Vec2] = [v2.create(0, 0), v2.create(0, 0)];

    serialize(s: BitStream) {
        s.writeBits(this.redScore, 4);
        s.writeBits(this.blueScore, 4);
        s.writeBits(this.totalRounds, 4);
        s.writeBits(this.roundNumber, 5);
        s.writeBits(this.attackerTeamId, 2);
        s.writeBits(this.phase, 2);
        s.writeUint16(Math.ceil(this.roundTimeLeft));
        s.writeUint16(Math.ceil(this.bombTimeLeft));
        s.writeBits(this.activeSite, 2);
        s.writeBits(this.bombState, 2);
        s.writeMapPos(this.bombPos);
        s.writeUint16(this.bombCarrierId);
        s.writeBits(this.winningTeamId, 2);
        s.writeBits(this.event, 3);
        s.writeUint16(this.actorPlayerId);
        s.writeMapPos(this.sites[0]);
        s.writeMapPos(this.sites[1]);
    }

    deserialize(s: BitStream) {
        this.redScore = s.readBits(4);
        this.blueScore = s.readBits(4);
        this.totalRounds = s.readBits(4);
        this.roundNumber = s.readBits(5);
        this.attackerTeamId = s.readBits(2) as 1 | 2;
        this.phase = s.readBits(2);
        this.roundTimeLeft = s.readUint16();
        this.bombTimeLeft = s.readUint16();
        this.activeSite = s.readBits(2) as 0 | 1 | 2;
        this.bombState = s.readBits(2);
        this.bombPos = s.readMapPos();
        this.bombCarrierId = s.readUint16();
        this.winningTeamId = s.readBits(2) as 0 | 1 | 2;
        this.event = s.readBits(3);
        this.actorPlayerId = s.readUint16();
        this.sites = [s.readMapPos(), s.readMapPos()];
    }
}
