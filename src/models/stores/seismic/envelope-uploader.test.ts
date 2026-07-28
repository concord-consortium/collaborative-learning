import { encodeEnvelopeTile, decodeEnvelopeTile } from "../../../../shared/seismic/envelope-codec";
import { ENVELOPE_LAYOUT_VERSION } from "../../../../shared/seismic/envelope-config";
import {
  createEnvelopeCredentialsProvider, createEnvelopeUploader, ENVELOPE_RESOURCE_ID
} from "./envelope-uploader";

const station = { network: "AK", station: "K204", location: "00", channel: "HNZ" };
const tile = { mins: Int16Array.from([-10]), maxs: Int16Array.from([10]) };
const existingTile = { mins: Int16Array.from([-20]), maxs: Int16Array.from([5]) };
const notFound = { ok: false, status: 404, headers: { get: () => null } };
const found = {
  ok: true, status: 200,
  headers: { get: (h: string) => h === "ETag" ? '"abc"' : null },
  arrayBuffer: async () => encodeEnvelopeTile(existingTile.mins, existingTile.maxs),
};
const putOk = { ok: true, status: 200 };
const putConflict = { ok: false, status: 412 };

function makeUploader(fetchFn: jest.Mock, signFetch: jest.Mock) {
  return createEnvelopeUploader({ getCredentials: jest.fn(), fetchFn, signFetch } as any);
}

describe("createEnvelopeUploader", () => {
  it("PUTs a new tile with If-None-Match", async () => {
    const fetchFn = jest.fn().mockResolvedValue(notFound);
    const signFetch = jest.fn().mockResolvedValue(putOk);
    const uploader = makeUploader(fetchFn, signFetch);
    await uploader.uploadTile(station, 2, 56123, tile);
    const [url, init] = signFetch.mock.calls[0];
    expect(url).toContain("v2/AK_K204/00/HNZ/L2/56123");
    expect(init.method).toBe("PUT");
    expect(init.headers["If-None-Match"]).toBe("*");
    expect(init.headers["If-Match"]).toBeUndefined();
    expect([...decodeEnvelopeTile(init.body).mins]).toEqual([-10]);
    expect([...decodeEnvelopeTile(init.body).maxs]).toEqual([10]);
  });

  it("merges with an existing tile and PUTs with If-Match", async () => {
    const fetchFn = jest.fn().mockResolvedValue(found);
    const signFetch = jest.fn().mockResolvedValue(putOk);
    const uploader = makeUploader(fetchFn, signFetch);
    await uploader.uploadTile(station, 2, 56123, tile);
    const [, init] = signFetch.mock.calls[0];
    expect(init.headers["If-Match"]).toBe('"abc"');
    expect(init.headers["If-None-Match"]).toBeUndefined();
    expect([...decodeEnvelopeTile(init.body).mins]).toEqual([-20]);   // min of -10/-20
    expect([...decodeEnvelopeTile(init.body).maxs]).toEqual([10]);    // max of 10/5
    // A cached GET would produce a stale ETag, so the read must bypass the cache.
    expect(fetchFn.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("re-reads and retries once after a 412 conflict", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(found);
    const signFetch = jest.fn()
      .mockResolvedValueOnce(putConflict)
      .mockResolvedValueOnce(putOk);
    const uploader = makeUploader(fetchFn, signFetch);
    await uploader.uploadTile(station, 2, 56123, tile);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(signFetch).toHaveBeenCalledTimes(2);
    const [, secondInit] = signFetch.mock.calls[1];
    // The retry saw the now-existing tile: merged body and If-Match.
    expect(secondInit.headers["If-Match"]).toBe('"abc"');
    expect([...decodeEnvelopeTile(secondInit.body).mins]).toEqual([-20]);
  });

  it("re-reads and retries once after a 409 conflict", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(found);
    const signFetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce(putOk);
    const uploader = makeUploader(fetchFn, signFetch);
    await uploader.uploadTile(station, 2, 56123, tile);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(signFetch).toHaveBeenCalledTimes(2);
    const [, secondInit] = signFetch.mock.calls[1];
    // The retry saw the now-existing tile: merged body and If-Match.
    expect(secondInit.headers["If-Match"]).toBe('"abc"');
    expect([...decodeEnvelopeTile(secondInit.body).mins]).toEqual([-20]);
  });

  it("throws when the GET succeeds but the ETag is unreadable", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => encodeEnvelopeTile(existingTile.mins, existingTile.maxs),
    });
    const signFetch = jest.fn();
    const uploader = makeUploader(fetchFn, signFetch);
    await expect(uploader.uploadTile(station, 2, 56123, tile))
      .rejects.toThrow(/ETag not readable/);
    expect(signFetch).not.toHaveBeenCalled();
  });

  it("throws after persistent 412 conflicts", async () => {
    const fetchFn = jest.fn().mockResolvedValue(found);
    const signFetch = jest.fn().mockResolvedValue(putConflict);
    const uploader = makeUploader(fetchFn, signFetch);
    await expect(uploader.uploadTile(station, 2, 56123, tile))
      .rejects.toThrow(/conflicted/);
    expect(signFetch).toHaveBeenCalledTimes(4);
  });

  it("throws on a non-412 PUT failure without retrying", async () => {
    const fetchFn = jest.fn().mockResolvedValue(notFound);
    const signFetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    const uploader = makeUploader(fetchFn, signFetch);
    await expect(uploader.uploadTile(station, 2, 56123, tile))
      .rejects.toThrow(/upload failed: 403/);
    expect(signFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on a non-404 GET failure without PUTting", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500, headers: { get: () => null } });
    const signFetch = jest.fn();
    const uploader = makeUploader(fetchFn, signFetch);
    await expect(uploader.uploadTile(station, 2, 56123, tile))
      .rejects.toThrow(/read failed: 500/);
    expect(signFetch).not.toHaveBeenCalled();
  });
});

describe("createEnvelopeCredentialsProvider", () => {
  const baseTime = new Date("2026-07-27T12:00:00Z").getTime();
  const credentials = {
    accessKeyId: "AKIA", secretAccessKey: "secret", sessionToken: "token",
    // Expires one hour after baseTime.
    expiration: new Date(baseTime + 60 * 60 * 1000),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests credentials for the versioned envelope resource", async () => {
    expect(ENVELOPE_RESOURCE_ID).toBe(`v${ENVELOPE_LAYOUT_VERSION}`);
    jest.spyOn(Date, "now").mockReturnValue(baseTime);
    const getCredentials = jest.fn().mockResolvedValue(credentials);
    const createClient = jest.fn().mockReturnValue({ getCredentials });
    const getJwt = jest.fn().mockResolvedValue("jwt-1");
    const provider = createEnvelopeCredentialsProvider({ getJwt, env: "staging", createClient });
    const result = await provider();
    expect(result).toEqual(expect.objectContaining({
      accessKeyId: "AKIA", secretAccessKey: "secret", sessionToken: "token",
    }));
    expect(createClient).toHaveBeenCalledWith("jwt-1", "staging");
    expect(getCredentials).toHaveBeenCalledWith(`v${ENVELOPE_LAYOUT_VERSION}`);
  });

  it("caches credentials across calls until near expiry", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseTime);
    const getCredentials = jest.fn().mockResolvedValue(credentials);
    const createClient = jest.fn().mockReturnValue({ getCredentials });
    const getJwt = jest.fn().mockResolvedValue("jwt-1");
    const provider = createEnvelopeCredentialsProvider({ getJwt, createClient });

    await provider();
    await provider();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getCredentials).toHaveBeenCalledTimes(1);

    // Within 5 minutes of expiry: a new client is created and credentials re-fetched.
    nowSpy.mockReturnValue(baseTime + 56 * 60 * 1000);
    await provider();
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(getCredentials).toHaveBeenCalledTimes(2);
  });
});
