import { describe, expect, it } from "vitest";
import { Recorder } from "../../server/src/game/replay";
import { GameConfig, TeamMode } from "../../shared/gameConfig";
import { BitStream, ReplayMsg } from "../../shared/net/net";
import { ObjectType } from "../../shared/net/objectSerializeFns";
import { UpdateExtFlags } from "../../shared/net/replayMsg";
import { createGame } from "./gameTestHelpers";

describe("arena replay recording", () => {
    it("round-trips the initial checkpoint payload", async () => {
        const game = await createGame(TeamMode.Solo, "cobalt");
        const recorder = new Recorder(game);
        game.playerBarn.addTestPlayer({ name: "Replay Player" });

        recorder.start();
        game.objectRegister.serializeObjs();
        recorder.recordTick();
        recorder.stop();

        const replay = recorder.getBuffer();
        const headerStart = new DataView(
            replay.buffer,
            replay.byteOffset,
            replay.byteLength,
        ).getUint32(0);
        const ticks = new BitStream(
            replay.buffer,
            replay.byteOffset + 4,
            headerStart - 4,
        );

        expect(ticks.readUint32()).toBe(0);
        const payloadLength = ticks.readUint32();
        const payload = ticks.readBytes(payloadLength);
        const payloadStream = new BitStream(
            payload.buffer.slice(
                payload.byteOffset,
                payload.byteOffset + payload.byteLength,
            ),
        );
        const msg = new ReplayMsg();

        msg.deserialize(payloadStream, {
            m_getTypeById: () => ObjectType.Invalid,
        });

        expect(GameConfig.replayVersion).toBe(3);
        expect(payloadStream.byteIndex).toBe(payloadLength);
        expect(msg.partObjects).toHaveLength(0);
        expect(msg.fullObjects).toHaveLength(game.objectRegister.objects.length);
    });

    it("reads checkpoints written with split partial and full object streams", async () => {
        const game = await createGame(TeamMode.Solo, "cobalt");
        game.objectRegister.serializeObjs();

        const payload = new BitStream(new ArrayBuffer(262_144));
        payload.writeUint16(UpdateExtFlags.FullObjects);
        payload.writeUint16(game.objectRegister.objects.length);
        for (const object of game.objectRegister.objects) {
            if (!object) continue;
            payload.writeUint8(object.__type);
            payload.writeBytes(object.partialStream, 0, object.partialStream.byteIndex);
            payload.writeBytes(object.fullStream, 0, object.fullStream.byteIndex);
        }
        payload.writeUint16(0);
        payload.writeUint32(0);

        const payloadLength = payload.byteIndex;
        payload.byteIndex = 0;
        const msg = new ReplayMsg();
        msg.deserialize(payload, { m_getTypeById: () => ObjectType.Invalid }, "split");

        expect(payload.byteIndex).toBe(payloadLength);
        expect(msg.partObjects).toHaveLength(0);
        expect(msg.fullObjects).toHaveLength(game.objectRegister.objects.length);
    });
});
