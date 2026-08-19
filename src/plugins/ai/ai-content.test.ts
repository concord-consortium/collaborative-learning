import { defaultAIContent, AIContentModel, kDefaultAIDescription } from "./ai-content";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";
import { TileModel } from "../../models/tiles/tile-model";
import "./ai-registration";

jest.mock("../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

describe("AIContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultAIContent();
    expect(content.prompt).toBe("");
  });

  it("supports changing the prompt", () => {
    const content = AIContentModel.create();
    content.setPrompt("New Text");
    expect(content.prompt).toBe("New Text");
  });

  it("is not user resizable", () => {
    const content = AIContentModel.create();
    expect(content.isUserResizable).toBe(false);
  });

  it("has a default description", () => {
    const content = AIContentModel.create();
    expect(content.description).toBe(kDefaultAIDescription);
  });

  it("supports changing the description", () => {
    const content = AIContentModel.create();
    content.setDescription("Custom instructions for students");
    expect(content.description).toBe("Custom instructions for students");
  });

  it("supports setting description to empty string", () => {
    const content = AIContentModel.create();
    content.setDescription("");
    expect(content.description).toBe("");
  });

  it("supports hidePrompt", () => {
    const content = AIContentModel.create();
    expect(content.hidePrompt).toBe(false);
    content.setHidePrompt(true);
    expect(content.hidePrompt).toBe(true);
    content.setHidePrompt(false);
    expect(content.hidePrompt).toBe(false);
  });

  it("requestRefresh increments refreshCount", () => {
    const content = AIContentModel.create();
    expect(content.refreshCount).toBe(0);
    content.requestRefresh();
    expect(content.refreshCount).toBe(1);
    content.requestRefresh();
    expect(content.refreshCount).toBe(2);
  });

  it("exportJson excludes refreshCount", () => {
    const content = AIContentModel.create();
    content.requestRefresh();
    content.requestRefresh();
    expect(content.refreshCount).toBe(2);
    const json = JSON.parse(content.exportJson());
    expect(json.refreshCount).toBeUndefined();
  });

  // setText is driven by the AI-response effect on load, not a student, so none of the setters log.
  it("does not log when the content setters mutate state", () => {
    const content = AIContentModel.create();
    (logTileChangeEvent as jest.Mock).mockClear();
    content.setPrompt("ask something");
    content.setText("a response");
    content.setDescription("do this");
    content.setHidePrompt(true);
    expect(logTileChangeEvent).not.toHaveBeenCalled();
  });

  // requestRefresh (the student "Update" button) logs, with the real tile id when hosted in a tile.
  it("logs an AI_TOOL_CHANGE with the tile id when the student requests a refresh", () => {
    const content = AIContentModel.create();
    const tile = TileModel.create({ content });
    (logTileChangeEvent as jest.Mock).mockClear();
    content.requestRefresh();
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.AI_TOOL_CHANGE, {
      tileId: tile.id, operation: "requestRefresh", change: { refreshCount: 1 }
    });
  });
});
