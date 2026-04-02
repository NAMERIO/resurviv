import type { AbstractMsg, BitStream } from "./net";

export class ArenaCountdownMsg implements AbstractMsg {
    seconds = 0;
    go = false;

    serialize(s: BitStream) {
        s.writeUint8(this.seconds);
        s.writeBoolean(this.go);
    }

    deserialize(s: BitStream) {
        this.seconds = s.readUint8();
        this.go = s.readBoolean();
    }
}
