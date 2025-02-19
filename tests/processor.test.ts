import { describe, expect, test } from "vitest";
import { extractProcessors, extractSteps, Source } from "@rdfc/js-runner";

const pipeline = `
        @prefix js: <https://w3id.org/conn/js#>.
        @prefix ws: <https://w3id.org/conn/ws#>.
        @prefix : <https://w3id.org/conn#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
        @prefix sh: <http://www.w3.org/ns/shacl#>.

        <> owl:imports <./node_modules/@rdfc/js-runner/ontology.ttl>, <./processor.ttl>.

        [ ] a :Channel;
            :reader <incoming>.
        [ ] a :Channel;
            :writer <outgoing>.
        <incoming> a js:JsReaderChannel.
        <outgoing> a js:JsWriterChannel.

        [ ] a js:WriteReplication;
            js:incoming <incoming>;
            js:append false;
            js:savePath "test.json";
            js:max 0.

        [ ] a js:ReadReplication;
            js:outgoing <outgoing>;
            js:savePath "test.json".
    `;

describe("processor", () => {
    test("ReadReplication definition", async () => {
        expect.assertions(5);

        const source: Source = {
            value: pipeline,
            baseIRI: process.cwd() + "/config.ttl",
            type: "memory",
        };

        // Parse pipeline into processors.
        const {
            processors,
            quads,
            shapes: config,
        } = await extractProcessors(source);

        // Extract the ReadReplication processor.
        const env = processors.find((x) =>
            x.ty.value.endsWith("ReadReplication"),
        )!;
        expect(env).toBeDefined();

        const args = extractSteps(env, quads, config);
        expect(args.length).toBe(1);
        expect(args[0].length).toBe(2);

        const [[outgoing, savePath]] = args;
        expect(outgoing.ty.value).toBe(
            "https://w3id.org/conn/js#JsWriterChannel",
        );
        expect(savePath).toBe("test.json");
    });

    test("WriteReplication definition", async () => {
        expect.assertions(7);

        const source: Source = {
            value: pipeline,
            baseIRI: process.cwd() + "/config.ttl",
            type: "memory",
        };

        // Parse pipeline into processors.
        const {
            processors,
            quads,
            shapes: config,
        } = await extractProcessors(source);

        // Extract the WriteReplication processor.
        const env = processors.find((x) =>
            x.ty.value.endsWith("WriteReplication"),
        )!;
        expect(env).toBeDefined();

        const args = extractSteps(env, quads, config);
        expect(args.length).toBe(1);
        expect(args[0].length).toBe(4);

        const [[incoming, append, savePath, max]] = args;
        expect(incoming.ty.value).toBe(
            "https://w3id.org/conn/js#JsReaderChannel",
        );
        expect(append).toBe(false);
        expect(savePath).toBe("test.json");
        expect(max).toBe(0);
    });
});
