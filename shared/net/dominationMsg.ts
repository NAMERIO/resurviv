import { type Vec2, v2 } from "../utils/v2";
import type { AbstractMsg, BitStream } from "./net";

export interface DominationPointNetState {
    pos: Vec2;
    ownerTeamId: 0 | 1 | 2;
    capturingTeamId: 0 | 1 | 2;
    progress: number;
    captureDuration: number;
    contested: boolean;
    resetting: boolean;
}

const createPoint = (): DominationPointNetState => ({
    pos: v2.create(0, 0),
    ownerTeamId: 0,
    capturingTeamId: 0,
    progress: 0,
    captureDuration: 5,
    contested: false,
    resetting: false,
});

export class DominationMsg implements AbstractMsg {
    redScore = 0;
    blueScore = 0;
    scoreLimit = 700;
    matchTimeLeft = 600;
    points: DominationPointNetState[] = [createPoint(), createPoint(), createPoint()];

    serialize(s: BitStream) {
        s.writeUint16(Math.floor(this.redScore));
        s.writeUint16(Math.floor(this.blueScore));
        s.writeUint16(this.scoreLimit);
        s.writeUint16(Math.ceil(this.matchTimeLeft));
        s.writeBits(this.points.length, 2);
        for (const point of this.points) {
            s.writeMapPos(point.pos);
            s.writeBits(point.ownerTeamId, 2);
            s.writeBits(point.capturingTeamId, 2);
            s.writeFloat(point.progress, 0, 8, 8);
            s.writeFloat(point.captureDuration, 0, 8, 8);
            s.writeBoolean(point.contested);
            s.writeBoolean(point.resetting);
        }
    }

    deserialize(s: BitStream) {
        this.redScore = s.readUint16();
        this.blueScore = s.readUint16();
        this.scoreLimit = s.readUint16();
        this.matchTimeLeft = s.readUint16();
        const pointCount = s.readBits(2);
        this.points = [];
        for (let i = 0; i < pointCount; i++) {
            this.points.push({
                pos: s.readMapPos(),
                ownerTeamId: s.readBits(2) as 0 | 1 | 2,
                capturingTeamId: s.readBits(2) as 0 | 1 | 2,
                progress: s.readFloat(0, 8, 8),
                captureDuration: s.readFloat(0, 8, 8),
                contested: s.readBoolean(),
                resetting: s.readBoolean(),
            });
        }
    }
}
