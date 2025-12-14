import { type AbstractMsg, type BitStream, Constants } from "./net";

export class LeaderboardMsg implements AbstractMsg {
    players: { name: string; kills: number }[] = [];

    serialize(s: BitStream) {
        s.writeArray(this.players, 16, (p) => {
            s.writeString(p.name, Constants.PlayerNameMaxLen);
            s.writeUint8(p.kills);
        });
    }

    deserialize(s: BitStream) {
        this.players = s.readArray(16, () => {
            return {
                name: s.readString(Constants.PlayerNameMaxLen),
                kills: s.readUint8(),
            };
        });
    }
}
