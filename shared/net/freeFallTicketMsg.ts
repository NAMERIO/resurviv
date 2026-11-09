import type { AbstractMsg, BitStream } from "./net";

export class FreeFallTicketMsg implements AbstractMsg {
    finderId = 0;
    recipientIds: number[] = [];

    serialize(s: BitStream) {
        /* STRIP_FROM_PROD_CLIENT:START */
        s.writeUint16(this.finderId);
        s.writeArray(this.recipientIds, 8, (id) => {
            s.writeUint16(id);
        });
        /* STRIP_FROM_PROD_CLIENT:END */
    }

    deserialize(s: BitStream) {
        this.finderId = s.readUint16();
        this.recipientIds = s.readArray(8, () => s.readUint16());
    }
}
