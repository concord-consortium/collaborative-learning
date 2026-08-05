import { NumberlineContentModel } from "./numberline-content";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";

jest.mock("../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

describe("NumberlineContent", () => {
  it("is always user resizable", () => {
    const content = NumberlineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("logs a NUMBERLINE_TOOL_CHANGE when a point is created", () => {
    const content = NumberlineContentModel.create();
    (logTileChangeEvent as jest.Mock).mockClear();
    content.createNewPoint(3, false);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      expect.objectContaining({ operation: "createNewPoint", tileId: "" }));
  });

  it("logs a NUMBERLINE_TOOL_CHANGE when min/max change", () => {
    const content = NumberlineContentModel.create();
    (logTileChangeEvent as jest.Mock).mockClear();
    content.setMin(-5);
    content.setMax(5);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      { tileId: "", operation: "setMin", change: { min: -5 } });
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      { tileId: "", operation: "setMax", change: { max: 5 } });
  });
});
