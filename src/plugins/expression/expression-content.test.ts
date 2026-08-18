import { defaultExpressionContent, ExpressionContentModel, logExpressionEvent } from "./expression-content";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";
import { TileModel } from "../../models/tiles/tile-model";
import "./expression-registration";

jest.mock("../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

describe("ExpressionContent", () => {
  it("has default content of area of a circle formula", () => {
    const content = defaultExpressionContent();
    expect(content.latexStr).toBe("a=\\pi r^2");
  });

  it("supports changing the text", () => {
    const content = ExpressionContentModel.create();
    content.setLatexStr("abc");
    expect(content.latexStr).toBe("abc");
  });

  // setLatexStr is wired to the mathfield's per-keystroke input event, so it must not log.
  it("does not log when setLatexStr mutates the expression", () => {
    (logTileChangeEvent as jest.Mock).mockClear();
    const content = ExpressionContentModel.create();
    content.setLatexStr("abc");
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  // The component calls logExpressionEvent on commit (blur); it carries the real tile id.
  it("logExpressionEvent logs an EXPRESSION_TOOL_CHANGE with the tile id", () => {
    const content = ExpressionContentModel.create();
    const tile = TileModel.create({ content });
    (logTileChangeEvent as jest.Mock).mockClear();
    logExpressionEvent(content, "abc");
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.EXPRESSION_TOOL_CHANGE, {
      tileId: tile.id,
      operation: "update",
      change: { latexStr: "abc" }
    });
  });

  it("is always user resizable", () => {
    const content = ExpressionContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});


