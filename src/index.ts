import { Stream, Writer } from "@rdfc/js-runner";
import { getLoggerFor } from "./utils/logUtil";
import jsonfile from "jsonfile";

/**
 * The writeReplication function is a processor which simply writes the
 * incoming stream to a JSON file on disk. This file can then be read by
 * the readReplication processor to restore the data stream.
 *
 * @param incoming The data stream which must be written to the JSON file.
 * @param append Whether the data must be appended to the file or not. Default is false.
 * @param savePath The path to the JSON file which must be written.
 * @param max The maximum number of members to write to the file. If 0, all members are written. Default is 0.
 */
export function writeReplication(
    incoming: Stream<string>,
    append: boolean = false,
    savePath: string,
    max: number = 0,
): () => Promise<void> {
    const logger = getLoggerFor("WriteReplication");

    const members: string[] = [];
    let count = 0;

    incoming.on("data", async (data) => {
        members.push(data);

        count++;
        if (max !== 0 && count >= max) {
            logger.info(
                `Reached maximum number of members (${max}). Closing stream.`,
            );
            await incoming.end();
        }
    });

    // If a processor upstream terminates the channel, we write the data to the file.
    incoming.on("end", async () => {
        if (append) {
            const previousMembers = (await jsonfile
                .readFile(savePath)
                .catch(() =>
                    logger.error(`Could not read from file '${savePath}'.`),
                )) as string[];
            members.unshift(...previousMembers);
        }
        await jsonfile
            .writeFile(savePath, members)
            .catch(() =>
                logger.error(`Could not write to file '${savePath}'.`),
            );
        logger.info(
            `Written ${count} members to '${savePath}'. The file now contains ${members.length} members.`,
        );
    });

    return async () => {
        return;
    };
}

/**
 * The readReplication function is a processor which reads a JSON file on disk
 * and writes the data to the outgoing stream. This function is the counterpart
 * of the writeReplication function.
 *
 * @param outgoing The data stream into which the data from the JSON file is written.
 * @param savePath The path to the JSON file which must be read.
 */
export async function readReplication(
    outgoing: Writer<string>,
    savePath: string,
): Promise<() => Promise<void>> {
    const logger = getLoggerFor("ReadReplication");

    const members = (await jsonfile
        .readFile(savePath)
        .catch(() =>
            logger.error(`Could not read from file '${savePath}'.`),
        )) as string[];

    return async () => {
        // Push the data from the file into the outgoing stream.
        for (const member of members) {
            await outgoing.push(member);
        }

        logger.info(
            `Pushed ${members.length} members to the outgoing stream. Closing stream.`,
        );

        // Close the outgoing stream to indicate that no more data will be pushed.
        await outgoing.end();
    };
}
