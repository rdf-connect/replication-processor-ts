import { Readable } from "stream";
import { createReadStream, createWriteStream } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import {
    toPath,
    type ReadReplication,
    type ReadReplicationArgs,
    type WriteReplication,
    type WriteReplicationArgs,
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

    test("WriteReplication falls back to its default values", async () => {
        const helper = new ProcHelper<WriteReplication>();

        await helper.importFile(resolve("./processor.ttl"));
        await helper.importInline(
            resolve("./pipeline.ttl"),
            `
        @prefix rdfc: <https://w3id.org/rdf-connect#>.

        <http://example.org/writer> a rdfc:WriteReplication;
            rdfc:incoming <incoming>;
            rdfc:savePath "test.txt".
    `,
        );
        helper.getConfig("WriteReplication");

        const proc = <WriteReplication & WriteReplicationArgs>(
            await helper.getProcessor("http://example.org/writer")
        );

        expect(proc.savePath).toBe("test.txt");
        expect(proc.append).toBe(false);
        expect(proc.max).toBe(0);
    });

    test("rdfc:savePath can be written as an IRI", async () => {
        const iriPipeline = `
        @prefix rdfc: <https://w3id.org/rdf-connect#>.

        <http://example.org/writer> a rdfc:WriteReplication;
            rdfc:incoming <incoming>;
            rdfc:savePath <./my%20data.txt>.

        <http://example.org/reader> a rdfc:ReadReplication;
            rdfc:outgoing <outgoing>;
            rdfc:savePath <./my%20data.txt>.
    `;

        const writeHelper = new ProcHelper<WriteReplication>();
        await writeHelper.importFile(resolve("./processor.ttl"));
        await writeHelper.importInline(resolve("./pipeline.ttl"), iriPipeline);
        writeHelper.getConfig("WriteReplication");

        const writer = <WriteReplication & WriteReplicationArgs>(
            await writeHelper.getProcessor("http://example.org/writer")
        );
        await writer.init();
        expect(createWriteStream).toHaveBeenLastCalledWith(
            resolve("./my data.txt"),
            { flags: "w" },
        );

        const readHelper = new ProcHelper<ReadReplication>();
        await readHelper.importFile(resolve("./processor.ttl"));
        await readHelper.importInline(resolve("./pipeline.ttl"), iriPipeline);
        readHelper.getConfig("ReadReplication");

        const reader = <ReadReplication & ReadReplicationArgs>(
            await readHelper.getProcessor("http://example.org/reader")
        );
        await reader.init();
        expect(createReadStream).toHaveBeenLastCalledWith(
            resolve("./my data.txt"),
        );
    });

    test("toPath keeps paths and turns file: URLs into paths", () => {
        expect(toPath("test.txt")).toBe("test.txt");
        expect(toPath("/tmp/out.txt")).toBe("/tmp/out.txt");
        expect(toPath("file:///tmp/my%20data/out.txt")).toBe(
            "/tmp/my data/out.txt",
        );
    });
});
