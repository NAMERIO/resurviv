import { v2 } from "../utils/v2";
import type { AbstractMsg, BitStream } from "./net";

export class FreeFallTicketMsg implements AbstractMsg {
    finderId = 0;
    recipientIds: number[] = [];
    pos = v2.create(0, 0);
    layer = 0;

    serialize(s: BitStream) {
        /* STRIP_FROM_PROD_CLIENT:START */
        s.writeUint16(this.finderId);
        s.writeArray(this.recipientIds, 8, (id) => {
            s.writeUint16(id);
        });
        s.writeVec(this.pos, 0, 0, 1024, 1024, 16);
        s.writeUint8(this.layer);
        /* STRIP_FROM_PROD_CLIENT:END */
    }

    deserialize(s: BitStream) {
        this.finderId = s.readUint16();
        this.recipientIds = s.readArray(8, () => s.readUint16());
        this.pos = s.readVec(0, 0, 1024, 1024, 16);
        this.layer = s.readUint8();
    }
}
