import { readReplication, writeReplication } from "../src";
import { SimpleStream } from "@rdfc/js-runner";
import { describe, expect, test, vi } from "vitest";
import * as fs from "fs";
import * as readline from "readline";

vi.mock("fs");
vi.mock("readline");
vi.mock("events");

describe("replication-processor", () => {
    test("ReadReplication", async () => {
        const mockedReadStream = fs.createReadStream("test.json");
        vi.mocked(readline.createInterface).mockReturnValue({
            // Mocking the async iterator
            [Symbol.asyncIterator]: vi.fn().mockReturnValue({
                next: vi
                    .fn()
                    .mockResolvedValueOnce({
                        // eslint-disable-next-line
                        value: '"Hello, World!"',
                        done: false,
                    })
                    .mockResolvedValueOnce({
                        // eslint-disable-next-line
                        value: '"This is a second message"',
                        done: false,
                    })
                    // eslint-disable-next-line
                    .mockResolvedValueOnce({ value: '"Goodbye."', done: false })
                    .mockResolvedValueOnce({ done: true }), // Signals the end of the stream
            }),
            on: vi.fn(),
            close: vi.fn(),
        } as unknown as readline.Interface);

        const outgoing = new SimpleStream<string>();

        const output: string[] = [];
        const promise = new Promise<void>((resolve) => {
            outgoing.on("data", (data) => {
                output.push(data);

                if (output.length === 3) {
                    resolve();
                }
            });
        });

        // Initialize the processor.
        const startReadReplication = await readReplication(
            outgoing,
            "test.json",
        );
        await startReadReplication();

        // Wait for the processor to finish.
        await promise;

        // Assertions
        expect(output).toHaveLength(3);
        expect(output[0]).toBe("Hello, World!");
        expect(output[1]).toBe("This is a second message");
        expect(output[2]).toBe("Goodbye.");

        expect(readline.createInterface).toHaveBeenCalledTimes(1);
        expect(readline.createInterface).toHaveBeenCalledWith({
            input: mockedReadStream,
            crlfDelay: Infinity,
        });
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
        const incoming = new SimpleStream<string>();

        // Initialize the processor.
        const startWriteReplication = writeReplication(
            incoming,
            false,
            "test.json",
            0,
        );
        await startWriteReplication();

        // Push all messages into the pipeline.
        await incoming.push("Hello, World!");
        await incoming.push("This is a second message");
        await incoming.push("Goodbye.");
        await incoming.end();

        // Assertions
        expect(written).toHaveLength(3);
        expect(written[0]).toBe('"Hello, World!"\n');
        expect(written[1]).toBe('"This is a second message"\n');
        expect(written[2]).toBe('"Goodbye."\n');

        expect(fs.createWriteStream).toHaveBeenCalledTimes(1);
        expect(fs.createWriteStream).toHaveBeenCalledWith("test.json", {
            flags: "w",
        });
    });
});
