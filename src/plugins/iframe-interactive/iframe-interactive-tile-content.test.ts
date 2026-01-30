import { defaultIframeInteractiveContent, IframeInteractiveContentModel } from "./iframe-interactive-tile-content";
import { kIframeInteractiveTileType } from "./iframe-interactive-tile-types";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";

describe("IframeInteractiveContent", () => {
  it("has default empty url and states", () => {
    const content = defaultIframeInteractiveContent();
    expect(content.url).toBe("");
    expect(content.interactiveState).toEqual({});
    expect(content.authoredState).toEqual({});
  });

  it("has correct tile type", () => {
    const content = defaultIframeInteractiveContent();
    expect(content.type).toBe(kIframeInteractiveTileType);
  });

  it("supports setting the url", () => {
    const content = IframeInteractiveContentModel.create();
    content.setUrl("https://example.com/interactive");
    expect(content.url).toBe("https://example.com/interactive");
  });

  it("supports setting interactive state", () => {
    const content = IframeInteractiveContentModel.create();
    const newState = { answer: "42", submitted: true };
    content.setInteractiveState(newState);
    expect(content.interactiveState).toEqual(newState);
  });

  it("supports setting authored state", () => {
    const content = IframeInteractiveContentModel.create();
    const authoredState = { version: 1, questionType: "open_response" };
    content.setAuthoredState(authoredState);
    expect(content.authoredState).toEqual(authoredState);
  });

  it("replaces entire state object when updated (frozen type)", () => {
    const content = IframeInteractiveContentModel.create();
    const state1 = { value: "first" };
    const state2 = { value: "second" };

    content.setInteractiveState(state1);
    expect(content.interactiveState).toEqual(state1);

    content.setInteractiveState(state2);
    expect(content.interactiveState).toEqual(state2);
    expect(content.interactiveState).not.toBe(state1);
  });

  it("has default maxHeight of 0 (unlimited)", () => {
    const content = defaultIframeInteractiveContent();
    expect(content.maxHeight).toBe(0);
  });

  it("supports setting maxHeight", () => {
    const content = IframeInteractiveContentModel.create();
    content.setMaxHeight(1500);
    expect(content.maxHeight).toBe(1500);
  });

  it("has default enableScroll of false", () => {
    const content = defaultIframeInteractiveContent();
    expect(content.enableScroll).toBe(false);
  });

  it("supports setting enableScroll", () => {
    const content = IframeInteractiveContentModel.create();
    content.setEnableScroll(true);
    expect(content.enableScroll).toBe(true);
  });

  it("is always user resizable", () => {
    const content = IframeInteractiveContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("exports JSON with all properties", () => {
    const content = IframeInteractiveContentModel.create({
      url: "https://example.com",
      interactiveState: { value: "test" },
      authoredState: { config: "option" },
      maxHeight: 1000,
      enableScroll: true
    });

    const json = content.exportJson();
    expect(json).toContain('"type": "IframeInteractive"');
    expect(json).toContain('"url": "https://example.com"');
    expect(json).toContain('"value": "test"');
    expect(json).toContain('"config": "option"');
    expect(json).toContain('"maxHeight": 1000');
    expect(json).toContain('"enableScroll": true');
  });

  it("can be created from snapshot", () => {
    const snapshot = {
      type: "IframeInteractive" as const,
      url: "https://example.com/interactive",
      interactiveState: { answer: "42" },
      authoredState: { version: 1 },
      maxHeight: 800,
      enableScroll: false
    };

    const content = IframeInteractiveContentModel.create(snapshot);
    expect(content.url).toBe("https://example.com/interactive");
    expect(content.interactiveState).toEqual({ answer: "42" });
    expect(content.authoredState).toEqual({ version: 1 });
    expect(content.maxHeight).toBe(800);
    expect(content.enableScroll).toBe(false);
  });

  describe("settings-based default content", () => {
    it("uses settings from appConfig when provided", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          settings: {
            iframeInteractive: {
              url: "https://example.com/hurricane-model",
              interactiveState: {},
              authoredState: { questionType: "open_response" },
              maxHeight: 800,
              enableScroll: true
            }
          }
        }
      });
      const content = defaultIframeInteractiveContent({ appConfig });
      expect(content.url).toBe("https://example.com/hurricane-model");
      expect(content.interactiveState).toEqual({});
      expect(content.authoredState).toEqual({ questionType: "open_response" });
      expect(content.maxHeight).toBe(800);
      expect(content.enableScroll).toBe(true);
    });

    it("falls back to defaults when appConfig has no iframeInteractive settings", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          settings: {}
        }
      });
      const content = defaultIframeInteractiveContent({ appConfig });
      expect(content.url).toBe("");
      expect(content.interactiveState).toEqual({});
      expect(content.authoredState).toEqual({});
      expect(content.maxHeight).toBe(0);
      expect(content.enableScroll).toBe(false);
    });

    it("falls back to defaults when no options are provided", () => {
      const content = defaultIframeInteractiveContent();
      expect(content.url).toBe("");
      expect(content.interactiveState).toEqual({});
      expect(content.authoredState).toEqual({});
      expect(content.maxHeight).toBe(0);
      expect(content.enableScroll).toBe(false);
    });

    it("handles partial settings (only url provided)", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          settings: {
            iframeInteractive: {
              url: "https://example.com/interactive"
            }
          }
        }
      });
      const content = defaultIframeInteractiveContent({ appConfig });
      expect(content.url).toBe("https://example.com/interactive");
      expect(content.interactiveState).toEqual({});
      expect(content.authoredState).toEqual({});
      expect(content.maxHeight).toBe(0);
      expect(content.enableScroll).toBe(false);
    });
  });
});
