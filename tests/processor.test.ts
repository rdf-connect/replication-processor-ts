import { Readable } from "stream";
import { describe, expect, test, vi } from "vitest";
import type {
    ReadReplication,
    ReadReplicationArgs,
    WriteReplication,
    WriteReplicationArgs,
} from "../src";
import { resolve } from "path";
import { ProcHelper } from "@rdfc/js-runner/lib/testUtils";

vi.mock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");

    return {
        ...actual,
        createReadStream: vi.fn(
            () =>
                // Simulate a file with three lines of text
                Readable.from([
                    '"Hello, World!"\n',
                    '"This is a second message"\n',
                    '"Goodbye."\n',
                ]) as unknown,
        ),
        createWriteStream: vi.fn(),
    };
});

const pipeline = `
        @prefix rdfc: <https://w3id.org/rdf-connect#>.

        <http://example.org/writer> a rdfc:WriteReplication;
            rdfc:incoming <incoming>;
            rdfc:append false;
            rdfc:savePath "test.txt";
            rdfc:max 0.

        <http://example.org/reader> a rdfc:ReadReplication;
            rdfc:outgoing <outgoing>;
            rdfc:savePath "test.txt".
    `;

describe("processor", () => {
    test("ReadReplication definition", async () => {
        const helper = new ProcHelper<ReadReplication>();

        await helper.importFile(resolve("./processor.ttl"));
        await helper.importInline(resolve("./pipeline.ttl"), pipeline);

        const config = helper.getConfig("ReadReplication");

        expect(config.location).toBeDefined();
        expect(config.clazz).toBe("ReadReplication");
        expect(config.file).toBeDefined();

        const proc = <ReadReplication & ReadReplicationArgs>(
            await helper.getProcessor("http://example.org/reader")
        );

        expect(proc.outgoing.constructor.name).toBe("WriterInstance");
        expect(proc.savePath).toBe("test.txt");

        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait a bit for the reading to complete
    });

    test("WriteReplication definition", async () => {
        const { ProcHelper } = await import("@rdfc/js-runner/lib/testUtils");
        const helper = new ProcHelper<WriteReplication>();

        await helper.importFile(resolve("./processor.ttl"));
        await helper.importInline(resolve("./pipeline.ttl"), pipeline);

        const config = helper.getConfig("WriteReplication");

        expect(config.location).toBeDefined();
        expect(config.clazz).toBe("WriteReplication");
        expect(config.file).toBeDefined();

        const proc = <WriteReplication & WriteReplicationArgs>(
            await helper.getProcessor("http://example.org/writer")
        );

        expect(proc.incoming.constructor.name).toBe("ReaderInstance");
        expect(proc.append).toBe(false);
        expect(proc.savePath).toBe("test.txt");
        expect(proc.max).toBe(0);
    });
});
