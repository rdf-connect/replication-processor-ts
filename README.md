# replication-processor-ts

[![Build and tests with Node.js](https://github.com/rdf-connect/replication-processor-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/rdf-connect/replication-processor-ts/actions/workflows/build-test.yml)
[![npm](https://img.shields.io/npm/v/@rdfc/replication-processor-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/replication-processor-ts)

A processor for the RDF Connect framework that writes an incoming stream to disk and later reads it into the output stream.

## Configuration

The `WriteReplication` processor can be configured using the following parameters:

- `rdfcp:input`: The data stream which must be written to the text file.
- `rdfcp:append`: Whether the data must be appended to the file or not. Default is false.
- `rdfcp:savePath` (`string` or IRI): The path to the text file which must be written.
- `rdfcp:max`: The maximum number of members to write to the file. If 0, all members are written. Default is 0.

The `ReadReplication` processor can be configured using the following parameters:

- `rdfcp:output`: The data stream into which the data from the text file is written.
- `rdfcp:savePath` (`string` or IRI): The path to the text file which must be read.

## Installation

```
npm install
npm run build
```

Or install from NPM:

```bash
npm install @rdfc/replication-processor-ts
```

## Example

An example configuration of the processor can be found in the `example` directory.

After building the processor (see above), you can run this example by executing the following commands:

```bash
cd example
npm install
npx rdfc write-pipeline.ttl
npx rdfc read-pipeline.ttl
```

To enable all debug logs, add `DEBUG=*` before the command:

```bash
DEBUG=* npx rdfc write-pipeline.ttl
DEBUG=* npx rdfc read-pipeline.ttl
```
