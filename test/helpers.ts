import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { writeFile } from "node:fs/promises";

export const signal = () => new AbortController().signal;
export async function mockProvider(
  handler: (
    body: Record<string, unknown>,
    response: ServerResponse,
    request: IncomingMessage,
  ) => Promise<void> | void,
) {
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      await handler(
        JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>,
        response,
        request,
      );
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No mock server address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
export function answer(response: ServerResponse, content: string, finishReason = "stop") {
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  );
}
function crc32(data: Buffer) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
export function png(red: number, green: number, blue: number): Buffer {
  const chunk = (tag: string, data: Buffer) => {
    const type = Buffer.from(tag),
      length = Buffer.alloc(4),
      checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32, 0);
  header.writeUInt32BE(32, 4);
  header[8] = 8;
  header[9] = 2;
  const rows: Buffer[] = [];
  for (let y = 0; y < 32; y++) {
    const row = Buffer.alloc(1 + 32 * 3);
    for (let x = 0; x < 32; x++) {
      row[1 + x * 3] = red;
      row[2 + x * 3] = green;
      row[3 + x * 3] = blue;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function imageFile(directory: string, color = [255, 0, 0]) {
  const file = path.join(directory, `image-${color.join("-")}.png`);
  await writeFile(file, png(color[0]!, color[1]!, color[2]!));
  return file;
}
