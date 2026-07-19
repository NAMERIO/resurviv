import { type Vec2, v2 } from "../utils/v2";
import type { AbstractMsg, BitStream } from "./net";

export enum CaptureTheFlagFlagStatus {
    AtBase,
    Taken,
    Dropped,
}

export enum CaptureTheFlagEvent {
    None,
    Taken,
    Dropped,
    Returned,
    Captured,
}

export class CaptureTheFlagMsg implements AbstractMsg {
    redScore = 0;
    blueScore = 0;
    scoreLimit = 100;
    matchTimeLeft = 600;
    redFlagStatus = CaptureTheFlagFlagStatus.AtBase;
    blueFlagStatus = CaptureTheFlagFlagStatus.AtBase;
    redFlagPos: Vec2 = v2.create(0, 0);
    blueFlagPos: Vec2 = v2.create(0, 0);
    redFlagReturnTime = 0;
    blueFlagReturnTime = 0;
    droppedFlagReturnDuration = 0;
    redCarrierId = 0;
    blueCarrierId = 0;
    event = CaptureTheFlagEvent.None;
    flagTeamId = 0;
    actorTeamId = 0;
    actorPlayerId = 0;

    serialize(s: BitStream) {
        s.writeUint8(this.redScore);
        s.writeUint8(this.blueScore);
        s.writeUint8(this.scoreLimit);
        s.writeUint16(Math.ceil(this.matchTimeLeft));
        s.writeBits(this.redFlagStatus, 2);
        s.writeBits(this.blueFlagStatus, 2);
        s.writeMapPos(this.redFlagPos);
        s.writeMapPos(this.blueFlagPos);
        s.writeFloat(this.redFlagReturnTime, 0, 60, 8);
        s.writeFloat(this.blueFlagReturnTime, 0, 60, 8);
        s.writeFloat(this.droppedFlagReturnDuration, 0, 60, 8);
        s.writeUint16(this.redCarrierId);
        s.writeUint16(this.blueCarrierId);
        s.writeBits(this.event, 3);
        s.writeBits(this.flagTeamId, 2);
        s.writeBits(this.actorTeamId, 2);
        s.writeUint16(this.actorPlayerId);
    }

    deserialize(s: BitStream) {
        this.redScore = s.readUint8();
        this.blueScore = s.readUint8();
        this.scoreLimit = s.readUint8();
        this.matchTimeLeft = s.readUint16();
        this.redFlagStatus = s.readBits(2);
        this.blueFlagStatus = s.readBits(2);
        this.redFlagPos = s.readMapPos();
        this.blueFlagPos = s.readMapPos();
        this.redFlagReturnTime = s.readFloat(0, 60, 8);
        this.blueFlagReturnTime = s.readFloat(0, 60, 8);
        this.droppedFlagReturnDuration = s.readFloat(0, 60, 8);
        this.redCarrierId = s.readUint16();
        this.blueCarrierId = s.readUint16();
        this.event = s.readBits(3);
        this.flagTeamId = s.readBits(2);
        this.actorTeamId = s.readBits(2);
        this.actorPlayerId = s.readUint16();
    }
}
