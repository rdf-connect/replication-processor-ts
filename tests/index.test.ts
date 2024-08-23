import { readReplication, writeReplication } from "../src";
import { SimpleStream } from "@rdfc/js-runner";
import { describe, expect, test, vi } from "vitest";
import jsonfile from "jsonfile";

describe("replication-processor", () => {
    test("ReadReplication", async () => {
        const readFileMock = vi.spyOn(jsonfile, "readFile");
        readFileMock.mockResolvedValue([
            "Hello, World!",
            "This is a second message",
            "Goodbye.",
        ]);

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

        expect(output).toHaveLength(3);
        expect(output[0]).toBe("Hello, World!");
        expect(output[1]).toBe("This is a second message");
        expect(output[2]).toBe("Goodbye.");

        expect(readFileMock).toHaveBeenCalledTimes(1);
        expect(readFileMock).toHaveBeenCalledWith("test.json");
        readFileMock.mockRestore();
    });

    test("WriteReplication", async () => {
        const writeFileMock = vi.spyOn(jsonfile, "writeFile");

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

        expect(writeFileMock).toHaveBeenCalledTimes(1);
        expect(writeFileMock).toHaveBeenCalledWith("test.json", [
            "Hello, World!",
            "This is a second message",
            "Goodbye.",
        ]);
        writeFileMock.mockRestore();
    });
});
