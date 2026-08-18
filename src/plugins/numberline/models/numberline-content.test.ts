import { NumberlineContentModel } from "./numberline-content";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { TileModel } from "../../../models/tiles/tile-model";
import "../numberline-registration";

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

  it("logs a NUMBERLINE_TOOL_CHANGE when points are deleted", () => {
    const content = NumberlineContentModel.create();
    const point = content.createAndSelectPoint(3, false);
    (logTileChangeEvent as jest.Mock).mockClear();
    content.deleteSelectedPoints();
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      { tileId: "", operation: "deleteSelectedPoints", change: { ids: [point.id] } });

    content.createNewPoint(1, false);
    (logTileChangeEvent as jest.Mock).mockClear();
    content.deleteAllPoints();
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      { tileId: "", operation: "deleteAllPoints", change: {} });
  });

  // Repositioning a point (drag commit) is the most common way an answer gets revised. Wrap the
  // content in a tile so the logged event carries the real tile id, not "".
  it("logs setPointXValue with the tile id when a dragged point is committed", () => {
    const content = NumberlineContentModel.create();
    const tile = TileModel.create({ content });
    const point = content.createNewPoint(1, false);
    point.setDragXValue(2.5);
    (logTileChangeEvent as jest.Mock).mockClear();
    content.setPointXValue(point);
    expect(point.xValue).toBe(2.5);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.NUMBERLINE_TOOL_CHANGE,
      { tileId: tile.id, operation: "setPointXValue", change: { id: point.id, xValue: 2.5 } });
  });

  // A drag "end" also fires on a plain selection click with no movement; that must not log.
  it("does not log setPointXValue when the point did not move", () => {
    const content = NumberlineContentModel.create();
    const point = content.createNewPoint(1, false);
    (logTileChangeEvent as jest.Mock).mockClear();
    content.setPointXValue(point);
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });
});
