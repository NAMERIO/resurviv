import type { AbstractMsg, BitStream } from "./net";

export enum BedWarEvent {
    None,
    BedDestroyed,
}

export class BedWarMsg implements AbstractMsg {
    redBedAlive = true;
    blueBedAlive = true;
    redBedHealth = 0;
    blueBedHealth = 0;
    maxBedHealth = 0;
    event = BedWarEvent.None;
    bedTeamId = 0;
    actorTeamId = 0;
    actorPlayerId = 0;

    serialize(s: BitStream) {
        s.writeBoolean(this.redBedAlive);
        s.writeBoolean(this.blueBedAlive);
        s.writeUint16(this.redBedHealth);
        s.writeUint16(this.blueBedHealth);
        s.writeUint16(this.maxBedHealth);
        s.writeBits(this.event, 2);
        s.writeBits(this.bedTeamId, 2);
        s.writeBits(this.actorTeamId, 2);
        s.writeUint16(this.actorPlayerId);
    }

    deserialize(s: BitStream) {
        this.redBedAlive = s.readBoolean();
        this.blueBedAlive = s.readBoolean();
        this.redBedHealth = s.readUint16();
        this.blueBedHealth = s.readUint16();
        this.maxBedHealth = s.readUint16();
        this.event = s.readBits(2);
        this.bedTeamId = s.readBits(2);
        this.actorTeamId = s.readBits(2);
        this.actorPlayerId = s.readUint16();
    }
}
