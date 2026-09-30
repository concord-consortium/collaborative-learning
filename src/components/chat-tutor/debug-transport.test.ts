import { DebugTransport } from "./debug-transport";
import { ChatTurn } from "./transport";
import { UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION } from "../../../shared/unit-summary-types";

function makeTransport(getUnitContext?: () => string | undefined) {
  const transport = new DebugTransport({
    getLeftContext: () => "{}",
    getUnitContext,
    getRightSummary: () => undefined,
  });
  let latest: ChatTurn[] = [];
  transport.subscribe(turns => { latest = turns; }, () => undefined);
  return { transport, turns: () => latest };
}

function segmentTexts(turn: ChatTurn, kind: "note" | "payload"): string[] {
  return (turn.debugSegments ?? []).filter(s => s.kind === kind).map(s => s.text);
}

describe("DebugTransport unit-context segments", () => {
  it("with a unit context available, the opening dry run and the first send both attach the " +
     "instruction and a THE UNIT payload", async () => {
    const { transport, turns } = makeTransport(() => "This problem (1.1): digest one.");

    const openingTurn = turns()[0];
    expect(segmentTexts(openingTurn, "payload")).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(segmentTexts(openingTurn, "payload")).toContain("This problem (1.1): digest one.");

    await transport.sendUserMessage("hi");
    const sendTurn = turns().at(-1)!;
    expect(segmentTexts(sendTurn, "payload")).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(segmentTexts(sendTurn, "payload")).toContain("This problem (1.1): digest one.");
  });

  it("with no unit context, the instruction is still present but THE UNIT is the unavailable note",
    async () => {
      const { transport, turns } = makeTransport(() => undefined);

      const openingTurn = turns()[0];
      expect(segmentTexts(openingTurn, "payload")).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
      expect(segmentTexts(openingTurn, "note").some(t => t.includes("THE UNIT unavailable"))).toBe(true);

      await transport.sendUserMessage("hi");
      const sendTurn = turns().at(-1)!;
      expect(segmentTexts(sendTurn, "payload")).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
      expect(segmentTexts(sendTurn, "note").some(t => t.includes("THE UNIT not attached"))).toBe(true);
    });

  it("after LEFT is installed, a later send attaches neither the instruction nor THE UNIT", async () => {
    const { transport, turns } = makeTransport(() => "digest");

    await transport.sendUserMessage("first message installs LEFT");
    await transport.sendUserMessage("second message");

    const secondSendTurn = turns().at(-1)!;
    expect(segmentTexts(secondSendTurn, "payload")).not.toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(segmentTexts(secondSendTurn, "payload")).not.toContain("digest");
    expect(secondSendTurn.text).not.toContain("THE UNIT");
  });
});
