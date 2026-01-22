import { ReadReplication, WriteReplication } from "../src";
import { FullProc } from "@rdfc/js-runner";
import { channel, createRunner } from "@rdfc/js-runner/lib/testUtils";
import { describe, expect, test, vi } from "vitest";
import * as fs from "fs";
import { createLogger } from "winston";
import { Readable } from "stream";

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

describe("replication-processor", () => {
    test("ReadReplication", async () => {
        const runner = createRunner();
        const [outgoingWriter, outgoingReader] = channel(runner, "outgoing");

        const output: string[] = [];
        (async () => {
            for await (const data of outgoingReader.strings()) {
                output.push(data);
            }
        })().then();

        // Initialize the processor.
        const startReadReplication = <FullProc<ReadReplication>>(
            new ReadReplication(
                {
                    outgoing: outgoingWriter,
                    savePath: "test.txt",
                },
                createLogger(),
            )
        );
        await startReadReplication.init();

        const outputPromise = Promise.all([
            startReadReplication.transform(),
            startReadReplication.produce(),
        ]);

        // Nothing to push, as ReadReplication reads from file.

        // Wait for the processor to finish.
        await outputPromise;

        // Assertions
        expect(output).toHaveLength(3);
        expect(output[0]).toBe("Hello, World!");
        expect(output[1]).toBe("This is a second message");
        expect(output[2]).toBe("Goodbye.");

        expect(fs.createReadStream).toHaveBeenCalledTimes(1);
    });

    test("WriteReplication", async () => {
        const written: string[] = [];
        // @ts-expect-error - Mocking fs.
        vi.mocked(fs.createWriteStream).mockReturnValue({
            write: vi.fn((data: string): boolean => {
                written.push(data);
                return true;
            }),
            end: vi.fn(),
        });

        const runner = createRunner();
        const [incomingWriter, incomingReader] = channel(runner, "incoming");

        // Initialize the processor.
        const startWriteReplication = <FullProc<WriteReplication>>(
            new WriteReplication(
                {
                    incoming: incomingReader,
                    append: false,
                    savePath: "test.txt",
                    max: 0,
                },
                createLogger(),
            )
        );
        await startWriteReplication.init();

        const outputPromise = Promise.all([
            startWriteReplication.transform(),
            startWriteReplication.produce(),
        ]);

        // Push all messages into the pipeline.
        await incomingWriter.string("Hello, World!");
        await incomingWriter.string("This is a second message");
        await incomingWriter.string("Goodbye.");

        await incomingWriter.close();

        // Wait for the processor to finish.
        await outputPromise;

        // Assertions
        expect(written).toHaveLength(3);
        expect(written[0]).toBe('"Hello, World!"\n');
        expect(written[1]).toBe('"This is a second message"\n');
        expect(written[2]).toBe('"Goodbye."\n');

        expect(fs.createWriteStream).toHaveBeenCalledTimes(1);
        expect(fs.createWriteStream).toHaveBeenCalledWith("test.txt", {
            flags: "w",
        });
    });
});
