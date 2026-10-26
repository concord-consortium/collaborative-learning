import { autorun } from "mobx";
import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { CcDeviceSession } from "./cc-device-session";
import { withChecksum } from "./cc-device-protocol";

const body = (line: string) => line.replace(/\*[0-9A-F]{2}$/, "");

describe("CcDeviceSession", () => {
  let write: jest.Mock;
  const bodies = () => write.mock.calls.map(c => body(c[0]));
  const lastBody = () => bodies()[bodies().length - 1];
  const make = (randomSessionId = () => 4242) => new CcDeviceSession(write, { randomSessionId });

  beforeEach(() => {
    jest.useFakeTimers();
    write = jest.fn();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens with a random session id and checksums every line", () => {
    const s = make();
    s.start();
    expect(write).toHaveBeenCalledWith(withChecksum("open session:4242 #1"));
    s.stop();
  });

  it("picks session ids from 1 to 65535, the range the protocol allows", () => {
    const random = jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.9999999999);
    [new CcDeviceSession(write), new CcDeviceSession(write)].forEach(s => { s.start(); s.stop(); });
    random.mockRestore();
    expect(bodies()).toEqual(["open session:1 #1", "open session:65535 #1"]);
  });

  it("doesn't ping until the open is acknowledged, then pings every second", () => {
    const s = make();
    s.start();
    jest.advanceTimersByTime(1500);
    expect(bodies()).toEqual(["open session:4242 #1"]);
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(2000);
    expect(bodies()).toEqual(["open session:4242 #1", "ping session:4242 #2", "ping session:4242 #3"]);
    s.stop();
  });

  it("re-sends an unanswered open after openRetryMs", () => {
    const s = make();
    s.start();
    jest.advanceTimersByTime(2000);
    expect(bodies().filter(b => b.startsWith("open"))).toHaveLength(2);
    s.stop();
  });

  it("records lastHeartbeatAt for an ok to a ping", () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    expect(s.lastHeartbeatAt).toBeUndefined();
    jest.advanceTimersByTime(1000);
    expect(lastBody()).toBe("ping session:4242 #2");
    s.receive("ok #2\r\n", []);
    expect(s.lastHeartbeatAt).toBe(Date.now());
    s.stop();
  });

  it("lastHeartbeatAt is observable", () => {
    const s = make();
    const seen: Array<number | undefined> = [];
    const dispose = autorun(() => { seen.push(s.lastHeartbeatAt); });
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(1000);
    s.receive("ok #2\r\n", []);
    dispose();
    s.stop();
    expect(seen).toEqual([undefined, Date.now()]);
  });

  it("re-opens with a new id on err nosession, once", () => {
    const ids = [1, 2];
    const s = make(() => ids.shift() as number);
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(1000);
    s.receive("err #2 nosession\r\n", []);
    expect(lastBody()).toBe("open session:2 #3");
    s.receive("err #2 nosession\r\n", []);
    expect(bodies().filter(b => b.startsWith("open"))).toHaveLength(2);
    jest.advanceTimersByTime(1000);
    expect(bodies().filter(b => b.startsWith("ping"))).toHaveLength(1);
    s.stop();
  });

  it("keeps pinging once a second, without re-opening, while pings go unanswered", () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(10000);
    expect(bodies().filter(b => b.startsWith("ping"))).toHaveLength(10);
    expect(bodies().filter(b => b.startsWith("open"))).toHaveLength(1);
    s.stop();
  });

  it("stops pinging and doesn't re-open on err othersession", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(1000);
    s.receive("err #2 othersession\r\n", []);
    const count = write.mock.calls.length;
    jest.advanceTimersByTime(5000);
    expect(write.mock.calls.length).toBe(count);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    s.stop();
  });

  it("warns on other errors", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = make();
    s.start();
    s.receive("err #1 badcmd\r\n", []);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    s.stop();
  });

  it("updates every channel with a reading's name, without rounding", () => {
    const s = make();
    const a = { channelId: "emg", value: 0 } as NodeChannelInfo;
    const b = { channelId: "emg", value: 0 } as NodeChannelInfo;
    const c = { channelId: "other", value: 0 } as NodeChannelInfo;
    s.receive("emg:12.5\r\n", [a, b, c]);
    expect([a.value, b.value]).toEqual([12.5, 12.5]);
    expect(c.value).toBe(0);
    expect(a.lastMessageReceivedAt).toBe(Date.now());
  });

  it("assembles lines split across chunks and drops bad checksums", () => {
    const s = make();
    const a = { channelId: "emg", value: 0 } as NodeChannelInfo;
    s.receive("emg:7*6", [a]);
    s.receive("2\r", [a]);
    expect(a.value).toBe(0);
    s.receive("\n", [a]);
    expect(a.value).toBe(7);
    s.receive("emg:9*00\r\n", [a]);
    expect(a.value).toBe(7);
  });

  it("ignores unknown lines and readings for unknown names", () => {
    const s = make();
    const a = { channelId: "emg", value: 0 } as NodeChannelInfo;
    expect(() => s.receive("cap sensor:emg\r\nfoo/bar:1\r\nbaz:1\r\n", [a])).not.toThrow();
    expect(a.value).toBe(0);
  });

  it("ignores a reply whose #n isn't pending", () => {
    const s = make();
    s.start();
    s.receive("ok #77\r\n", []);
    jest.advanceTimersByTime(1000);
    expect(bodies().filter(b => b.startsWith("ping"))).toHaveLength(0);
    s.stop();
  });

  it("sends close with the session id and then stops", async () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    await s.close();
    expect(lastBody()).toBe("close session:4242");
    jest.advanceTimersByTime(5000);
    expect(lastBody()).toBe("close session:4242");
  });

  it("sends close for an open that hasn't been acknowledged yet, and ignores the open's late ok", async () => {
    const s = make();
    s.start();
    await s.close();
    // The device handles the open before the close, so the open's ok arrives after close().
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(5000);
    expect(bodies()).toEqual(["open session:4242 #1", "close session:4242"]);
  });

  it("doesn't re-open on the err nosession that answers a close, which has no #n", async () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    await s.close();
    s.receive("err nosession\r\n", []);
    jest.advanceTimersByTime(5000);
    expect(bodies()).toEqual(["open session:4242 #1", "close session:4242"]);
  });

  it("stops pinging before the close write settles", () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    // A write to a stalled port may never settle.
    write.mockImplementation(() => new Promise(() => undefined));
    void s.close();
    jest.advanceTimersByTime(3000);
    expect(bodies()).toEqual(["open session:4242 #1", "close session:4242"]);
  });

  it("close without a session, before start or after othersession, just stops", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = make();
    await s.close();
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(1000);
    s.receive("err #2 othersession\r\n", []);
    await s.close();
    expect(bodies()).toEqual(["open session:4242 #1", "ping session:4242 #2"]);
    warn.mockRestore();
  });

  it("doesn't re-send an open acknowledged while it was being written", () => {
    const s = make();
    write.mockImplementation((line: string) => {
      const seq = /^open .* #(\d+)\*/.exec(line)?.[1];
      if (seq) s.receive(`ok #${seq}\r\n`, []);
    });
    s.start();
    jest.advanceTimersByTime(5000);
    expect(bodies().filter(b => b.startsWith("open"))).toHaveLength(1);
    expect(bodies().filter(b => b.startsWith("ping"))).toHaveLength(5);
    s.stop();
  });

  it("ignores a late nosession or othersession for a ping from before a re-open", () => {
    const ids = [1, 2];
    const s = make(() => ids.shift() as number);
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(2000);
    expect(bodies().slice(1)).toEqual(["ping session:1 #2", "ping session:1 #3"]);
    s.receive("err #2 nosession\r\n", []);
    expect(lastBody()).toBe("open session:2 #4");
    s.receive("ok #4\r\n", []);
    // Replies may arrive late and out of order; these answer ping #3, sent to the old session.
    s.receive("err #3 nosession\r\n", []);
    s.receive("err #3 othersession\r\n", []);
    jest.advanceTimersByTime(1000);
    expect(bodies().filter(b => b.startsWith("open"))).toHaveLength(2);
    expect(lastBody()).toBe("ping session:2 #5");
    s.stop();
  });

  it("stop writes nothing and clears the timers", () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    s.stop();
    const count = write.mock.calls.length;
    jest.advanceTimersByTime(5000);
    expect(write.mock.calls.length).toBe(count);
  });

  it("writes outputs without #n", () => {
    const s = make();
    s.sendOutput("servo", 90);
    expect(write).toHaveBeenLastCalledWith(withChecksum("servo:90"));
  });

  it("survives a write that rejects", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const failing = jest.fn().mockRejectedValue(new Error("unplugged"));
    const s2 = new CcDeviceSession(failing);
    s2.start();
    s2.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
    expect(failing.mock.calls.length).toBeGreaterThan(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    s2.stop();
  });

  it("wraps #n from 999 to 1", () => {
    const s = make();
    s.start();
    s.receive("ok #1\r\n", []);
    jest.advanceTimersByTime(999 * 1000);
    const pings = bodies().filter(b => b.startsWith("ping"));
    expect(pings[997]).toBe("ping session:4242 #999");
    expect(pings[998]).toBe("ping session:4242 #1");
    s.stop();
  });
});
