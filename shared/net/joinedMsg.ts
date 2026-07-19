import type { TeamMode } from "../gameConfig";
import type { AbstractMsg, BitStream } from "./net";

const MiniGameMaxLen = 32;

export class JoinedMsg implements AbstractMsg {
    teamMode!: TeamMode;
    playerId = 0;
    started = false;
    arenaPrivate = false;
    miniGame = "";
    arenaCountdown = 0;
    emotes: string[] = [];

    serialize(s: BitStream) {
        /* STRIP_FROM_PROD_CLIENT:START */
        s.writeUint8(this.teamMode);
        s.writeUint16(this.playerId);
        s.writeBoolean(this.started);
        s.writeBoolean(this.arenaPrivate);
        s.writeString(this.miniGame, MiniGameMaxLen);
        s.writeUint8(this.arenaCountdown);

        s.writeArray(this.emotes, 8, (emote) => {
            s.writeGameType(emote);
        });
        /* STRIP_FROM_PROD_CLIENT:END */
    }

    deserialize(s: BitStream) {
        this.teamMode = s.readUint8();
        this.playerId = s.readUint16();
        this.started = s.readBoolean();
        this.arenaPrivate = s.readBoolean();
        this.miniGame = s.readString(MiniGameMaxLen);
        this.arenaCountdown = s.readUint8();

        this.emotes = s.readArray(8, () => {
            return s.readGameType();
        });
    }
}
