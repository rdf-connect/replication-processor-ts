import { Processor, Reader, Writer } from "@rdfc/js-runner";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { once } from "node:events";

/**
 * The WriteReplication processor is a processor which simply writes the
 * incoming stream to a text file on disk. This file can then be read by
 * the ReadReplication processor to restore the data stream.
 *
 * @param incoming The data stream which must be written to the text file.
 * @param append Whether the data must be appended to the file or not. Default is false.
 * @param savePath The path to the text file which must be written.
 * @param max The maximum number of members to write to the file. If 0, all members are written. Default is 0.
 */
export type WriteReplicationArgs = {
    incoming: Reader;
    append?: boolean;
    savePath: string;
    max?: number;
};

export class WriteReplication extends Processor<WriteReplicationArgs> {
    private writer: WriteStream;
    private count: number = 0;

    async init(this: WriteReplicationArgs & this): Promise<void> {
        this.writer = createWriteStream(
            this.savePath.replace(/^file:\/\//, ""),
            { flags: this.append ? "a" : "w" },
        );
        this.max ??= 0;
    }

    async transform(this: WriteReplicationArgs & this): Promise<void> {
        for await (const data of this.incoming.strings()) {
            // TODO: remove this workaround when we can close the reader stream.
            if (this.max && this.count >= this.max) {
                // As we cannot close the reader stream yet, we just skip further processing, but consume the data.
                continue;
            }

            const ready = this.writer.write(JSON.stringify(data) + "\n");
            if (!ready) {
                this.logger.verbose("Write buffer full, waiting for drain...");
                await once(this.writer, "drain");
            }

            this.count++;

            if (this.count % 1000 === 0) {
                this.logger.verbose(
                    `Already written ${this.count} members to '${this.savePath}'...`,
                );
            }

            if (this.max && this.count >= this.max) {
                this.logger.info(
                    `Reached maximum number of members (${this.max}). (Not) Closing stream.`,
                );
                // TODO: we want to close the reader, but this is currently not supported anymore in v2.
                // await this.incoming.end();
            }
        }
    }

    async produce(this: WriteReplicationArgs & this): Promise<void> {
        // nothing
    }
}

/**
 * The readReplication function is a processor which reads a text file on disk
 * and writes the data to the outgoing stream. This function is the counterpart
 * of the writeReplication function.
 *
 * @param outgoing The data stream into which the data from the text file is written.
 * @param savePath The path to the text file which must be read.
 */
export type ReadReplicationArgs = {
    outgoing: Writer;
    savePath: string;
};

export class ReadReplication extends Processor<ReadReplicationArgs> {
    private fileStream: ReturnType<typeof createReadStream>;
    private count: number;

    async init(this: ReadReplicationArgs & this): Promise<void> {
        this.fileStream = createReadStream(
            this.savePath.replace(/^file:\/\//, ""),
        );
        this.count = 0;
        this.logger.info(
            `Initialized ReadReplication from file '${this.savePath}'.`,
        );
    }

    async transform(this: ReadReplicationArgs & this): Promise<void> {
        // nothing
    }

    async produce(this: ReadReplicationArgs & this): Promise<void> {
        this.logger.info(
            `Producing members from file '${this.savePath}' to outgoing stream...`,
        );
        const reader = createInterface({
            input: this.fileStream,
            crlfDelay: Infinity,
        });
        this.logger.info(
            `Starting to push members from file '${this.savePath}' to outgoing stream...`,
        );
        for await (const member of reader) {
            this.logger.info(member);
            await this.outgoing.string(JSON.parse(member));
            this.count++;

            if (this.count % 1000 === 0) {
                this.logger.verbose(
                    `Already pushed ${this.count} members to the outgoing stream...`,
                );
            }
        }

        this.logger.info(
            `Pushed ${this.count} members to the outgoing stream. Closing stream.`,
        );

        // Close the outgoing stream to indicate that no more data will be pushed.
        await this.outgoing.close();
    }
}
