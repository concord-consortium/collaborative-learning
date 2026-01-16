import { defaultInteractiveApiContent, InteractiveApiContentModel } from "./interactive-api-tile-content";
import { kInteractiveApiTileType } from "./interactive-api-tile-types";

describe("InteractiveApiContent", () => {
  it("has default empty url and states", () => {
    const content = defaultInteractiveApiContent();
    expect(content.url).toBe("");
    expect(content.interactiveState).toEqual({});
    expect(content.authoredState).toEqual({});
  });

  it("has correct tile type", () => {
    const content = defaultInteractiveApiContent();
    expect(content.type).toBe(kInteractiveApiTileType);
  });

  it("supports setting the url", () => {
    const content = InteractiveApiContentModel.create();
    content.setUrl("https://example.com/interactive");
    expect(content.url).toBe("https://example.com/interactive");
  });

  it("supports setting interactive state", () => {
    const content = InteractiveApiContentModel.create();
    const newState = { answer: "42", submitted: true };
    content.setInteractiveState(newState);
    expect(content.interactiveState).toEqual(newState);
  });

  it("supports setting authored state", () => {
    const content = InteractiveApiContentModel.create();
    const authoredState = { version: 1, questionType: "open_response" };
    content.setAuthoredState(authoredState);
    expect(content.authoredState).toEqual(authoredState);
  });

  it("replaces entire state object when updated (frozen type)", () => {
    const content = InteractiveApiContentModel.create();
    const state1 = { value: "first" };
    const state2 = { value: "second" };

    content.setInteractiveState(state1);
    expect(content.interactiveState).toEqual(state1);

    content.setInteractiveState(state2);
    expect(content.interactiveState).toEqual(state2);
    expect(content.interactiveState).not.toBe(state1);
  });

  it("has default permissions", () => {
    const content = defaultInteractiveApiContent();
    expect(content.allowedPermissions).toBe("geolocation; microphone; camera; bluetooth");
  });

  it("supports setting custom permissions", () => {
    const content = InteractiveApiContentModel.create();
    content.setAllowedPermissions("geolocation");
    expect(content.allowedPermissions).toBe("geolocation");
  });

  it("has default maxHeight of 0 (unlimited)", () => {
    const content = defaultInteractiveApiContent();
    expect(content.maxHeight).toBe(0);
  });

  it("supports setting maxHeight", () => {
    const content = InteractiveApiContentModel.create();
    content.setMaxHeight(1500);
    expect(content.maxHeight).toBe(1500);
  });

  it("has default enableScroll of false", () => {
    const content = defaultInteractiveApiContent();
    expect(content.enableScroll).toBe(false);
  });

  it("supports setting enableScroll", () => {
    const content = InteractiveApiContentModel.create();
    content.setEnableScroll(true);
    expect(content.enableScroll).toBe(true);
  });

  it("is always user resizable", () => {
    const content = InteractiveApiContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("exports JSON with all properties", () => {
    const content = InteractiveApiContentModel.create({
      url: "https://example.com",
      interactiveState: { value: "test" },
      authoredState: { config: "option" },
      allowedPermissions: "geolocation",
      maxHeight: 1000,
      enableScroll: true
    });

    const json = content.exportJson();
    expect(json).toContain('"type": "InteractiveApi"');
    expect(json).toContain('"url": "https://example.com"');
    expect(json).toContain('"value": "test"');
    expect(json).toContain('"config": "option"');
    expect(json).toContain('"allowedPermissions": "geolocation"');
    expect(json).toContain('"maxHeight": 1000');
    expect(json).toContain('"enableScroll": true');
  });

  it("can be created from snapshot", () => {
    const snapshot = {
      type: "InteractiveApi" as const,
      url: "https://example.com/interactive",
      interactiveState: { answer: "42" },
      authoredState: { version: 1 },
      allowedPermissions: "geolocation",
      maxHeight: 800,
      enableScroll: false
    };

    const content = InteractiveApiContentModel.create(snapshot);
    expect(content.url).toBe("https://example.com/interactive");
    expect(content.interactiveState).toEqual({ answer: "42" });
    expect(content.authoredState).toEqual({ version: 1 });
    expect(content.allowedPermissions).toBe("geolocation");
    expect(content.maxHeight).toBe(800);
    expect(content.enableScroll).toBe(false);
  });
});
