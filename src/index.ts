import { Stream, Writer } from "@rdfc/js-runner";
import { getLoggerFor } from "./utils/logUtil";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { once } from "node:events";

/**
 * The writeReplication function is a processor which simply writes the
 * incoming stream to a text file on disk. This file can then be read by
 * the readReplication processor to restore the data stream.
 *
 * @param incoming The data stream which must be written to the text file.
 * @param append Whether the data must be appended to the file or not. Default is false.
 * @param savePath The path to the text file which must be written.
 * @param max The maximum number of members to write to the file. If 0, all members are written. Default is 0.
 */
export function writeReplication(
    incoming: Stream<string>,
    append: boolean = false,
    savePath: string,
    max: number = 0,
): () => Promise<void> {
    const logger = getLoggerFor("WriteReplication");

    // Create writer to write per line to file
    const writer = createWriteStream(savePath, { flags: append ? "a" : "w" });

    let count = 0;

    incoming.on("data", async (data) => {
        const ready = writer.write(JSON.stringify(data) + "\n");
        if (!ready) {
            logger.verbose("Write buffer full, waiting for drain...");
            await once(writer, "drain");
        }

        count++;

        if (count % 1000 === 0) {
            logger.verbose(
                `Already written ${count} members to '${savePath}'...`,
            );
        }

        if (max !== 0 && count >= max) {
            logger.info(
                `Reached maximum number of members (${max}). Closing stream.`,
            );
            await incoming.end();
        }
    });

    // If a processor upstream terminates the channel, we write the data to the file.
    incoming.on("end", async () => {
        writer.end();
        logger.info(
            `Written ${count} members to '${savePath}'. Closing stream.`,
        );
    });

    return async () => {
        return;
    };
}

/**
 * The readReplication function is a processor which reads a text file on disk
 * and writes the data to the outgoing stream. This function is the counterpart
 * of the writeReplication function.
 *
 * @param outgoing The data stream into which the data from the text file is written.
 * @param savePath The path to the text file which must be read.
 */
export async function readReplication(
    outgoing: Writer<string>,
    savePath: string,
): Promise<() => Promise<void>> {
    const logger = getLoggerFor("ReadReplication");

    const fileStream = createReadStream(savePath);

    return async () => {
        const reader = createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let count = 0;
        // Push the data from the file into the outgoing stream.
        for await (const member of reader) {
            await outgoing.push(JSON.parse(member));
            count++;

            if (count % 1000 === 0) {
                logger.verbose(
                    `Already pushed ${count} members to the outgoing stream...`,
                );
            }
        }

        logger.info(
            `Pushed ${count} members to the outgoing stream. Closing stream.`,
        );

        // Close the outgoing stream to indicate that no more data will be pushed.
        await outgoing.end();
    };
}
