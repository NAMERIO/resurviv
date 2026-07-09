import { type Vec2, v2 } from "../utils/v2";
import type { AbstractMsg, BitStream } from "./net";

export enum KingOfTheHillPhase {
    Active,
    Countdown,
}

export class KingOfTheHillMsg implements AbstractMsg {
    redScore = 0;
    blueScore = 0;
    scoreLimit = 200;
    phase = KingOfTheHillPhase.Countdown;
    hillPos: Vec2 = v2.create(0, 0);
    previousHillPos: Vec2 = v2.create(0, 0);
    showPreviousHill = false;
    phaseTimeLeft = 0;
    phaseDuration = 10;
    matchTimeLeft = 600;
    controllingTeamId = 0;

    serialize(s: BitStream) {
        s.writeUint16(Math.floor(this.redScore));
        s.writeUint16(Math.floor(this.blueScore));
        s.writeUint16(this.scoreLimit);
        s.writeBits(this.phase, 1);
        s.writeMapPos(this.hillPos);
        s.writeBoolean(this.showPreviousHill);
        if (this.showPreviousHill) {
            s.writeMapPos(this.previousHillPos);
        }
        s.writeFloat(this.phaseTimeLeft, 0, 120, 8);
        s.writeFloat(this.phaseDuration, 0, 120, 8);
        s.writeUint16(Math.ceil(this.matchTimeLeft));
        s.writeBits(this.controllingTeamId, 2);
    }

    deserialize(s: BitStream) {
        this.redScore = s.readUint16();
        this.blueScore = s.readUint16();
        this.scoreLimit = s.readUint16();
        this.phase = s.readBits(1);
        this.hillPos = s.readMapPos();
        this.showPreviousHill = s.readBoolean();
        this.previousHillPos = this.showPreviousHill ? s.readMapPos() : v2.create(0, 0);
        this.phaseTimeLeft = s.readFloat(0, 120, 8);
        this.phaseDuration = s.readFloat(0, 120, 8);
        this.matchTimeLeft = s.readUint16();
        this.controllingTeamId = s.readBits(2);
    }
}
