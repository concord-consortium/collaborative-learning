import http from "node:http";
import { AddressInfo } from "node:net";
import { hostedImageCheck } from "../src/execute.js";
import { sha256Bytes } from "../src/represent-image.js";
import { makeTestPng } from "./helpers.js";

/**
 * The preflight itself, against a real server. Reachability was never the guarantee: the request
 * key, the cache entry and the row's provenance all use the sha256 captured when the image was
 * rendered, so a URL that still answers 200 with *different* pixels is the case that matters.
 */
type Handler = (request: http.IncomingMessage, response: http.ServerResponse) => void;

async function serving(handler: Handler): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/shot.png`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

const png = makeTestPng(960, 1420);
const pngSha = sha256Bytes(png);

const servePng = (bytes: Buffer): Handler => (_request, response) => {
  response.writeHead(200, { "content-type": "image/png", "content-length": String(bytes.length) });
  response.end(bytes);
};

/**
 * Serves `bytes` split at `boundaries`, as separate chunks on the wire.
 *
 * Consecutive `response.write` calls are coalesced into one network packet, and the reading side
 * then sees a single chunk — which is exactly the case a single `response.end(bytes)` already
 * covers. The pause between pieces is what makes them arrive separately.
 */
const inPieces = (bytes: Buffer, boundaries: number[]): Handler => (_request, response) => {
  const edges = [0, ...boundaries, bytes.length];
  response.writeHead(200, { "content-type": "image/png", "content-length": String(bytes.length) });
  const writePiece = (index: number) => {
    const piece = bytes.subarray(edges[index], edges[index + 1]);
    // The last piece ends the response in the same turn it is written. Scheduling one more timer
    // for a bare `end()` would leave the request open after the reader already had every declared
    // byte, and `server.close()` then waits several seconds for it.
    if (index + 2 >= edges.length) {
      response.end(piece);
      return;
    }
    response.write(piece);
    setTimeout(() => writePiece(index + 1), 20);
  };
  writePiece(0);
};

async function check(handler: Handler, expected = pngSha, maxBytes?: number) {
  const server = await serving(handler);
  try {
    return await hostedImageCheck(5000, maxBytes)(server.url, expected);
  } finally {
    await server.close();
  }
}

describe("verifying a hosted image", () => {
  it("passes when the bytes are the ones that were rendered", async () => {
    expect(await check(servePng(png))).toBeNull();
  });

  it("passes when the body arrives in more than one piece", async () => {
    // The ordinary case over a real network, and the one a single `response.end(bytes)` fixture
    // cannot reach: only the leading bytes are kept for the PNG check, so a check that expects a
    // whole file in those bytes fails every hosted image whose body is split across chunks.
    expect(await check(inPieces(png, [32, 200]))).toBeNull();
  });

  it("fails when the same URL now serves different pixels", async () => {
    // A HEAD check passed here. This is the failure it could not see.
    const different = makeTestPng(960, 1420, 0x80);
    expect(sha256Bytes(different)).not.toBe(pngSha);
    const reason = await check(servePng(different));
    expect(reason).toContain("now serves different pixels");
    // Both hashes are named, so the message says what arrived as well as what was expected.
    expect(reason).toContain(sha256Bytes(different));
    expect(reason).toContain(pngSha);
  });

  it("fails when the image has been resized, even though it is still a PNG", async () => {
    expect(await check(servePng(makeTestPng(480, 700)))).toMatch(/now serves different pixels/);
  });

  it("fails on a 404", async () => {
    expect(await check((_request, response) => {
      response.writeHead(404);
      response.end("gone");
    })).toMatch(/HTTP 404/);
  });

  it("fails when what comes back is not a PNG at all", async () => {
    expect(await check((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html>503</html>");
    })).toMatch(/is not a usable PNG/);
  });

  it("refuses a body larger than the limit, from its declared length", async () => {
    expect(await check((_request, response) => {
      response.writeHead(200, { "content-type": "image/png", "content-length": "99000000" });
      response.end(png);
    }, pngSha, 1000)).toMatch(/declares 99000000 bytes, over the 1000 limit/);
  });

  it("refuses a body larger than the limit when the length was not declared", async () => {
    // The case the declared-length check cannot cover — a chunked response, or any body that simply
    // does not say how big it is. It is read in chunks and abandoned the moment it passes the limit,
    // rather than being pulled into memory in full and measured afterwards. (A response that
    // *understates* content-length needs no separate guard: the transport itself stops reading at
    // the declared length.)
    expect(await check((_request, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(png);
    }, pngSha, 10)).toMatch(/is over the 10 limit/);
  });

  it("reports a connection failure rather than throwing", async () => {
    // Nothing is listening on this port; the preflight must return a reason, not blow up the run.
    const reason = await hostedImageCheck(2000)("http://127.0.0.1:1/shot.png", pngSha);
    expect(typeof reason).toBe("string");
  });
});
