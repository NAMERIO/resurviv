import type { AbstractMsg, BitStream } from "./net";

export enum AmongUsMeetingPhase {
    None,
    Discussion,
    Voting,
    Reveal,
    Ejection,
}

export enum AmongUsMeetingReason {
    Report,
    Emergency,
}

export interface AmongUsMeetingVote {
    voterId: number;
    targetId: number;
}

export class AmongUsMeetingStateMsg implements AbstractMsg {
    sequence = 0;
    phase = AmongUsMeetingPhase.None;
    seconds = 0;
    reason = AmongUsMeetingReason.Report;
    callerId = 0;
    ejectedId = 0;
    ejectedWasImpostor = false;
    participantIds: number[] = [];
    deadParticipantIds: number[] = [];
    submittedVoterIds: number[] = [];
    votes: AmongUsMeetingVote[] = [];

    serialize(s: BitStream) {
        s.writeUint8(this.sequence);
        s.writeBits(this.phase, 3);
        s.writeUint8(this.seconds);
        s.writeBits(this.reason, 2);
        s.writeUint16(this.callerId);
        s.writeUint16(this.ejectedId);
        s.writeBoolean(this.ejectedWasImpostor);
        s.writeArray(this.participantIds, 4, (id) => s.writeUint16(id));
        s.writeArray(this.deadParticipantIds, 4, (id) => s.writeUint16(id));
        s.writeArray(this.submittedVoterIds, 4, (id) => s.writeUint16(id));
        s.writeArray(this.votes, 4, (vote) => {
            s.writeUint16(vote.voterId);
            s.writeUint16(vote.targetId);
        });
    }

    deserialize(s: BitStream) {
        this.sequence = s.readUint8();
        this.phase = s.readBits(3);
        this.seconds = s.readUint8();
        this.reason = s.readBits(2);
        this.callerId = s.readUint16();
        this.ejectedId = s.readUint16();
        this.ejectedWasImpostor = s.readBoolean();
        this.participantIds = s.readArray(4, () => s.readUint16());
        this.deadParticipantIds = s.readArray(4, () => s.readUint16());
        this.submittedVoterIds = s.readArray(4, () => s.readUint16());
        this.votes = s.readArray(4, () => ({
            voterId: s.readUint16(),
            targetId: s.readUint16(),
        }));
    }
}

export class AmongUsMeetingVoteMsg implements AbstractMsg {
    targetId = 0;

    serialize(s: BitStream) {
        s.writeUint16(this.targetId);
    }

    deserialize(s: BitStream) {
        this.targetId = s.readUint16();
    }
}

export class AmongUsMeetingChatMsg implements AbstractMsg {
    playerId = 0;
    message = "";

    serialize(s: BitStream) {
        s.writeUint16(this.playerId);
        s.writeString(this.message, 120);
    }

    deserialize(s: BitStream) {
        this.playerId = s.readUint16();
        this.message = s.readString(120);
    }
}

export class AmongUsMeetingChatSendMsg implements AbstractMsg {
    message = "";

    serialize(s: BitStream) {
        s.writeString(this.message, 120);
    }

    deserialize(s: BitStream) {
        this.message = s.readString(120);
    }
}
