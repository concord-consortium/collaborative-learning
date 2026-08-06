import { defaultExpressionContent, ExpressionContentModel } from "./expression-content";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";

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

  it("logs an EXPRESSION_TOOL_CHANGE when the expression changes", () => {
    (logTileChangeEvent as jest.Mock).mockClear();
    const content = ExpressionContentModel.create();
    content.setLatexStr("abc");
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.EXPRESSION_TOOL_CHANGE, {
      tileId: "",
      operation: "update",
      change: { latexStr: "abc" }
    });
  });

  it("is always user resizable", () => {
    const content = ExpressionContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});


