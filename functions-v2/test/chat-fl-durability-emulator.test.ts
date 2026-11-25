// Isolated project, actual Firestore transactions/drain and actual FL HTTP client. Synthetic
// endpoint implements exact-key replay; it never contacts a provider or charges model usage.
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {deleteApp, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import {acquireLock, processAndDrain} from "../src/chat/drain";
import {createFlProvider} from "../src/chat/fl-provider";
import {createRoutingProvider} from "../src/chat/routing-provider";
import {createTurnPersistence} from "../src/chat/turn-persistence";
import {flChat, FlChatArgs} from "../src/chat/fl-client";

jest.setTimeout(30000);

const app = initializeApp({projectId: "demo-clue-fl-durability"});
const db = getFirestore(app);
let server: Server;
let baseUrl: string;
let calls: {key: string; body: string; user: string}[];
let accepted: Map<string, {body: string; frames: string}>;
let generations: number;
let loseResponse: boolean;
let failStatus: number;
let failCode: string;
let beforeNextRead: (() => Promise<void>) | undefined;
let counter = 0;
const cleanupPaths: string[] = [];
const owner = {uid: "synthetic", context_id: "class", problemPath: "vibe/1/2"};
const protection = {classes: ["protected_threshold_value" as const], patternRefs: ["protected:synthetic"]};

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const key = String(req.headers["idempotency-key"]);
    calls.push({key, body, user: String(req.headers["x-user-id"])});
    if (failStatus) {
      res.writeHead(failStatus, {"Content-Type": "text/event-stream"})
        .end(failCode ? `data: ${JSON.stringify({type: "error", code: failCode})}\n\n` : "");
      return;
    }
    const prior = accepted.get(key);
    if (prior && prior.body !== body) {
      res.writeHead(409).end(); return;
    }
    if (!prior) {
      generations++;
      const frames = [
        {type: "metadata", sessionId: "synthetic-session"},
        {type: "content", part: "conversation", text: "Accepted synthetic reply."},
        ...(JSON.parse(body).prompt === "/end" ? [{type: "session_ended"}] : []),
        {type: "done", sessionId: "synthetic-session", stopReason: "end_turn"},
      ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
      accepted.set(key, {body, frames});
    }
    if (loseResponse) {
      loseResponse = false; res.destroy(); return;
    }
    res.writeHead(200, {"Content-Type": "text/event-stream"}).end(accepted.get(key)!.frames);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  calls = []; accepted = new Map(); generations = 0; loseResponse = false; failStatus = 0; failCode = "";
  beforeNextRead = undefined;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const path of cleanupPaths) await db.recursiveDelete(db.doc(path));
  await db.terminate(); await deleteApp(app);
});

async function fixture(parent: Record<string, unknown> = {}) {
  const parentRef = db.doc(`qa/synthetic/chatTutor/durability-${Date.now()}-${++counter}`);
  await parentRef.set({...owner, ...parent});
  const messagesCol = parentRef.collection("messages");
  const source = messagesCol.doc("first");
  await source.set({...owner, kind: "user", provider: "foreverlearning", text: "Original question",
    activityContext: {task_prompt: "Original task"}, createdAt: Timestamp.now()});
  const provider = (chat?: typeof flChat, endpoint = baseUrl) => createFlProvider({
    config: {baseUrl: endpoint, solutionId: "concordclue", apiKey: "synthetic-key"},
    catalogCommit: "a".repeat(40), protection, resolveUserId: () => "synthetic-user", chat,
    readDocument: async (state, message) => {
      const hook = beforeNextRead;
      beforeNextRead = undefined;
      await hook?.();
      const raw = message.rightContent || state.flContent;
      return raw ? {content: JSON.parse(raw), documentId: "document", revision: "r1", raw} : undefined;
    },
  });
  const ctx = (chat?: typeof flChat) => ({parentRef, messagesCol,
    provider: createRoutingProvider({defaultProvider: "openai", providers: {
      foreverlearning: () => provider(chat), openai: () => {
        throw Error("Wrong backend");
      },
    }}),
  });
  const reservation = async () => createTurnPersistence(source, (await source.get()).data()!);
  cleanupPaths.push(parentRef.path, (await reservation()).ref.path);
  const recoveryCtx = async (action = "retry", recoveryId?: string, chat?: typeof flChat) => {
    const delivery = (await parentRef.get()).get("delivery");
    const recoveryRef = messagesCol.doc();
    await recoveryRef.set({...owner, kind: "recovery", provider: "foreverlearning", action,
      recoveryId: recoveryId ?? delivery.id, createdAt: FieldValue.serverTimestamp()});
    return {...ctx(chat), recoveryRef};
  };
  const retryCtx = (chat?: typeof flChat) => recoveryCtx("retry", undefined, chat);
  const assistants = async () => (await messagesCol.where("kind", "==", "assistant").get()).docs;
  return {parentRef, source, messagesCol, provider, ctx, retryCtx, recoveryCtx, reservation, assistants};
}

it("persists before dispatch, survives a crash before send and deletes pending state with commit", async () => {
  const f = await fixture();
  let saved: FlChatArgs | undefined;
  await expect(processAndDrain(f.ctx(async (_config, args) => {
    expect((await (await f.reservation()).ref.get()).exists).toBe(true);
    saved = args; throw Error("Crash before send");
  }))).rejects.toThrow("Crash before send");
  expect(calls).toHaveLength(0);
  expect((await f.parentRef.get()).get("delivery")).toMatchObject({state: "unknown", code: "FL_DELIVERY_UNCONFIRMED"});
  expect(await f.assistants()).toHaveLength(0);
  expect((await f.parentRef.get()).get("flSessionId")).toBeUndefined();
  await processAndDrain(await f.retryCtx());
  expect(calls[0].body).toBe(saved!.serializedBody);
  expect(calls[0].key).toBe(saved!.context.envelope.trace.request_id);
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
  expect(await f.assistants()).toHaveLength(1);
  expect((await f.assistants())[0].get("providerRequestId")).toBe(calls[0].key);
  expect((await f.assistants())[0].get("sourceMessageId")).toBe("first");
  expect((await f.messagesCol.doc("delivery-first").get()).get("resolution")).toBe("recovered");
  expect((await f.parentRef.get()).get("lastProcessedMessageId")).toBe("first");
});

it("replays an accepted opening after disconnect, despite parent workspace changes and fresh provider", async () => {
  const f = await fixture(); loseResponse = true;
  await expect(processAndDrain(f.ctx())).rejects.toThrow();
  expect(generations).toBe(1);
  await f.parentRef.update({flContent: JSON.stringify({rowOrder: [], rowMap: {}, tileMap: {}})});
  await processAndDrain(await f.retryCtx());
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(generations).toBe(1);
  expect(await f.assistants()).toHaveLength(1);
  expect((await f.parentRef.get()).get("flSessionId")).toBe("synthetic-session");
  await processAndDrain(f.ctx());
  expect(calls).toHaveLength(2); // duplicate invocation after cursor commit does nothing
});

it("replays after FL acceptance when the local reply/cursor batch fails", async () => {
  const f = await fixture();
  const batch = db.batch();
  jest.spyOn(batch, "commit").mockRejectedValueOnce(Error("Commit unavailable"));
  let spy: jest.SpyInstance | undefined;
  try {
    await expect(processAndDrain(f.ctx(async (config, args) => {
      const result = await flChat(config, args);
      // Install after reservation has committed; transactions also construct WriteBatch objects.
      spy = jest.spyOn(db, "batch").mockReturnValueOnce(batch);
      return result;
    }))).rejects.toThrow("Commit unavailable");
  } finally {
    spy?.mockRestore();
  }
  expect((await (await f.reservation()).ref.get()).exists).toBe(true);
  expect(await f.assistants()).toHaveLength(0);
  await processAndDrain(await f.retryCtx());
  expect(calls[1]).toEqual(calls[0]); expect(generations).toBe(1);
  expect(await f.assistants()).toHaveLength(1);
});

it("concurrent reservations select one snapshot and the conversation lock permits one drain", async () => {
  const f = await fixture();
  const a = await f.reservation(); const b = await f.reservation();
  const values = await Promise.all([a.reserve(async () => ({id: "a"})), b.reserve(async () => ({id: "b"}))]);
  expect(values[0]).toEqual(values[1]);
  await a.ref.delete(); // the fixture above is not an FL request
  const locks = await Promise.all([acquireLock(f.parentRef, owner), acquireLock(f.parentRef, owner)]);
  expect(locks.filter(Boolean)).toHaveLength(1);
  await processAndDrain(f.ctx());
  expect(calls).toHaveLength(1); expect(generations).toBe(1);
});

it("rejects changed source content and target before any replacement dispatch", async () => {
  const f = await fixture();
  await expect(processAndDrain(f.ctx(async () => {
    throw Error("Before send");
  }))).rejects.toThrow();
  const data = (await f.source.get()).data()!;
  await expect(f.provider(undefined, "http://127.0.0.1:1").processTurn(
    (await f.parentRef.get()).data()!, data, await f.reservation())).rejects.toThrow("target changed");
  await f.source.update({text: "Changed question"});
  await expect(processAndDrain(await f.retryCtx())).rejects.toThrow("conflicts with its source");
  expect(calls).toHaveLength(0);
});

it("records a reservation whose target changed as blocked, not as a reply to check for", async () => {
  const f = await fixture();
  await expect(processAndDrain(f.ctx(async () => {
    throw Error("Before send");
  }))).rejects.toThrow();
  expect((await f.parentRef.get()).get("delivery.state")).toBe("unknown");
  const moved = {...await f.retryCtx(), provider: createRoutingProvider({defaultProvider: "openai",
    providers: {foreverlearning: () => f.provider(undefined, "http://127.0.0.1:1"), openai: () => f.provider()}})};
  await expect(processAndDrain(moved)).rejects.toThrow("target changed");
  expect((await f.parentRef.get()).get("delivery"))
    .toMatchObject({state: "blocked", code: "FL_RESERVED_TARGET_CHANGED"});
  expect(calls).toHaveLength(0);
});

it("continues an old conversation and gives the next genuine message a new request identity", async () => {
  const f = await fixture({flTraceId: "old-trace", flTurn: 7, flSessionId: "existing-session"});
  await processAndDrain(f.ctx());
  expect(calls[0].key).toBe("old-trace-t8");
  expect(JSON.parse(calls[0].body).session_id).toBe("existing-session");
  await f.messagesCol.doc("second").set({...owner, kind: "user", provider: "foreverlearning",
    text: "Next genuine question", createdAt: FieldValue.serverTimestamp()});
  await processAndDrain(f.ctx());
  expect(calls[1].key).toBe("old-trace-t9");
  expect(JSON.parse(calls[1].body).session_id).toBe("synthetic-session");
  expect(generations).toBe(2); expect(await f.assistants()).toHaveLength(2);
});

it.each([422, 503])("retains the fenced request after FL status %s", async (status) => {
  const f = await fixture(); failStatus = status;
  await expect(processAndDrain(f.ctx())).rejects.toThrow(`status ${status}`);
  await expect(processAndDrain(await f.retryCtx())).rejects.toThrow(`status ${status}`);
  expect(calls[1]).toEqual(calls[0]); expect(generations).toBe(0);
  expect(await f.assistants()).toHaveLength(0);
  expect((await (await f.reservation()).ref.get()).exists).toBe(true);
});

it("fails closed on corrupted pending state without contacting FL", async () => {
  const f = await fixture();
  await expect(processAndDrain(f.ctx(async () => {
    throw Error("Before send");
  }))).rejects.toThrow();
  await (await f.reservation()).ref.update({snapshotJson: "{}"});
  await expect(processAndDrain(await f.retryCtx())).rejects.toThrow("conflicts with its source");
  expect(calls).toHaveLength(0);
});


it("refuses a snapshot that cannot be persisted before any dispatch", async () => {
  const f = await fixture();
  await expect((await f.reservation()).reserve(async () => ({text: "x".repeat(980001)})))
    .rejects.toThrow("snapshot limit");
  expect(calls).toHaveLength(0);
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
});


it("lets a failure before any reservation be retried, and the retry dispatches once", async () => {
  const f = await fixture();
  beforeNextRead = async () => {
    throw Error("Transient read failure");
  };
  await expect(processAndDrain(f.ctx())).rejects.toThrow("Transient read failure");
  expect(calls).toHaveLength(0);
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
  expect((await f.parentRef.get()).get("delivery")).toMatchObject({state: "retryable", code: "FL_NOT_DISPATCHED"});
  await processAndDrain(await f.retryCtx());
  expect(calls).toHaveLength(1);
  expect(await f.assistants()).toHaveLength(1);
  expect((await f.parentRef.get()).get("delivery")).toBeUndefined();
});

it("does not record an FL delivery for a message stamped foreverlearning in an OpenAI conversation", async () => {
  const f = await fixture({provider: "openai"});
  await expect(processAndDrain(f.ctx())).rejects.toThrow("Wrong backend");
  expect((await f.parentRef.get()).get("delivery")).toBeUndefined();
  expect((await f.messagesCol.doc("delivery-first").get()).exists).toBe(false);
});

it("keeps a source message changed before its reservation blocked, without dispatch", async () => {
  const f = await fixture();
  const changesSourceFirst = {
    processTurn: async (...turn: Parameters<ReturnType<typeof f.provider>["processTurn"]>) => {
      await f.source.update({text: "Changed question"});
      return f.provider().processTurn(...turn);
    },
  };
  await expect(processAndDrain({...f.ctx(), provider: createRoutingProvider({defaultProvider: "openai",
    providers: {foreverlearning: () => changesSourceFirst, openai: () => f.provider()}})}))
    .rejects.toThrow("source message changed");
  expect(calls).toHaveLength(0);
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
  const delivery = (await f.parentRef.get()).get("delivery");
  expect(delivery.state).toBe("blocked");
  expect(delivery.code).not.toBe("FL_NOT_DISPATCHED");
});

it("reserves and answers a turn whose attached workspace is near the browser's limit", async () => {
  const f = await fixture();
  const workspace = JSON.stringify({tiles: [{content: "\"".repeat(445_000)}]});
  expect(workspace.length).toBeGreaterThan(880_000);
  await f.source.update({rightContent: workspace});
  await processAndDrain(f.ctx());
  expect(calls).toHaveLength(1);
  expect(await f.assistants()).toHaveLength(1);
  expect((await f.parentRef.get()).get("flContent")).toBe(workspace);
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
});

it("preserves terminal failure, continues queued work/end, then starts new work only after closure", async () => {
  const f = await fixture(); failStatus = 422; failCode = "CLUE_TURN_FAILED";
  const workspace = JSON.stringify({tiles: []});
  await f.source.update({rightContent: workspace});
  await expect(processAndDrain(f.ctx())).rejects.toThrow("CLUE_TURN_FAILED");
  const failedId = calls[0].key;
  for (const [id, text] of [["second", "Next question"], ["third", "/end"], ["fourth", "After closeout"]]) {
    await f.messagesCol.doc(id).set({...owner, kind: "user", provider: "foreverlearning", text,
      createdAt: FieldValue.serverTimestamp()});
  }
  await processAndDrain(f.ctx());
  expect(calls).toHaveLength(1); // a new-message trigger cannot silently retry/skip the failed head
  failStatus = 0;
  await processAndDrain(await f.recoveryCtx("continue"));
  expect(calls.map((c) => JSON.parse(c.body).prompt)).toEqual(["Original question", "Next question", "/end"]);
  expect(calls[1].key).not.toBe(failedId);
  expect((await f.parentRef.get()).get("delivery.state")).toBe("closed");
  expect((await f.messagesCol.doc("delivery-first").get()).get("resolution")).toBe("continued");
  expect((await f.parentRef.get()).get("flContent")).toBe(workspace);
  expect(await f.assistants()).toHaveLength(2);
  await processAndDrain(f.ctx()); expect(calls).toHaveLength(3);
  await processAndDrain(await f.recoveryCtx("new_session"));
  expect(calls).toHaveLength(4);
  expect(JSON.parse(calls[3].body).prompt).toBe("After closeout");
  expect(JSON.parse(calls[3].body)).not.toHaveProperty("session_id");
  expect(calls[3].key).not.toBe(failedId);
  expect(await f.assistants()).toHaveLength(3);
  expect((await f.parentRef.get()).get("delivery")).toBeUndefined();
});

it("fences unknown work against new questions, skip/new-session controls and stale retry clicks", async () => {
  const f = await fixture(); failStatus = 503; failCode = "CLUE_TURN_UNCERTAIN";
  await expect(processAndDrain(f.ctx())).rejects.toThrow();
  const originalDelivery = (await f.parentRef.get()).get("delivery");
  await processAndDrain(await f.recoveryCtx("continue"));
  await processAndDrain(await f.recoveryCtx("new_session"));
  await processAndDrain(f.ctx()); expect(calls).toHaveLength(1);
  await expect(processAndDrain(await f.retryCtx())).rejects.toThrow();
  await processAndDrain(await f.recoveryCtx("retry", originalDelivery.id));
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(await f.assistants()).toHaveLength(0);
  failStatus = 0;
  const recovery = await f.retryCtx();
  await processAndDrain(recovery);
  await processAndDrain(recovery); // redelivery of consumed control
  expect(calls).toHaveLength(3); expect(generations).toBe(1);
});

it("records an unconfirmed-session closeout as failed without dispatch or an invented answer", async () => {
  const f = await fixture(); await f.source.update({text: "/end"});
  await expect(processAndDrain(f.ctx())).rejects.toThrow("FL_NO_CONFIRMED_SESSION_TO_CLOSE");
  expect(calls).toHaveLength(0); expect(await f.assistants()).toHaveLength(0);
  expect((await f.parentRef.get()).get("delivery.state")).toBe("failed");
  await processAndDrain(await f.recoveryCtx("continue"));
  expect((await f.parentRef.get()).get("status")).toBe("idle");
});


it("does not record a failure when another invocation has moved the cursor past a lost acknowledgement", async () => {
  const f = await fixture(); let spy: jest.SpyInstance | undefined;
  const later = f.messagesCol.doc("later");
  await later.set({...owner, kind: "assistant", userText: "Later reply",
    createdAt: Timestamp.fromMillis(Date.now() + 60_000)});
  try {
    await processAndDrain(f.ctx(async (config, args) => {
      const result = await flChat(config, args);
      const batch = db.batch(); const commit = batch.commit.bind(batch);
      jest.spyOn(batch, "commit").mockImplementationOnce(async () => {
        await commit();
        await f.parentRef.update({lastProcessedMessageId: "later",
          lastProcessedCreatedAt: (await later.get()).get("createdAt")});
        throw Error("Acknowledgement lost");
      });
      spy = jest.spyOn(db, "batch").mockReturnValueOnce(batch);
      return result;
    }));
  } finally {
    spy?.mockRestore();
  }
  expect((await f.parentRef.get()).get("delivery")).toBeUndefined();
  expect((await f.messagesCol.doc("delivery-first").get()).exists).toBe(false);
});

it("resumes queued work after support clears a blocked delivery and writes a recovery control", async () => {
  const f = await fixture();
  await f.source.update({text: "Changed"});
  const changesSourceFirst = {
    processTurn: async (...turn: Parameters<ReturnType<typeof f.provider>["processTurn"]>) => {
      await f.source.update({text: "Changed again"});
      return f.provider().processTurn(...turn);
    },
  };
  await expect(processAndDrain({...f.ctx(), provider: createRoutingProvider({defaultProvider: "openai",
    providers: {foreverlearning: () => changesSourceFirst, openai: () => f.provider()}})})).rejects.toThrow();
  expect((await f.parentRef.get()).get("delivery.state")).toBe("blocked");
  await f.messagesCol.doc("queued").set({...owner, kind: "user", provider: "foreverlearning", text: "Queued question",
    createdAt: FieldValue.serverTimestamp()});
  const source = await f.source.get();
  await f.parentRef.update({delivery: FieldValue.delete(), error: FieldValue.delete(), status: "idle",
    lastProcessedMessageId: source.id, lastProcessedCreatedAt: source.get("createdAt")});
  await processAndDrain(await f.recoveryCtx("retry", "support-resume"));
  expect(calls.map((c) => JSON.parse(c.body).prompt)).toEqual(["Queued question"]);
  expect(await f.assistants()).toHaveLength(1);
});

it("recognizes a committed local batch after its acknowledgement is lost", async () => {
  const f = await fixture(); let spy: jest.SpyInstance | undefined;
  try {
    await processAndDrain(f.ctx(async (config, args) => {
      const result = await flChat(config, args);
      const batch = db.batch(); const commit = batch.commit.bind(batch);
      jest.spyOn(batch, "commit").mockImplementationOnce(async () => {
        await commit(); throw Error("Acknowledgement lost");
      });
      spy = jest.spyOn(db, "batch").mockReturnValueOnce(batch);
      return result;
    }));
  } finally {
    spy?.mockRestore();
  }
  expect(await f.assistants()).toHaveLength(1); expect(generations).toBe(1);
  expect((await f.parentRef.get()).get("delivery")).toBeUndefined();
  expect((await (await f.reservation()).ref.get()).exists).toBe(false);
});
