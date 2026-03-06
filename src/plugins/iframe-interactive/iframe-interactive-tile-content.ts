import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { IDefaultContentOptions } from "../../models/tiles/tile-content-info";
import { kIframeInteractiveTileType } from "./iframe-interactive-tile-types";
import stringify from "json-stringify-pretty-compact";

export function defaultIframeInteractiveContent(options?: IDefaultContentOptions): IframeInteractiveContentModelType {
  const settings = options?.appConfig?.getSetting("iframeInteractive") as Record<string, any> | undefined;
  return IframeInteractiveContentModel.create({
    url: settings?.url ?? "",
    interactiveState: settings?.interactiveState ?? {},
    authoredState: settings?.authoredState ?? {},
    maxHeight: settings?.maxHeight ?? 0,
    enableScroll: settings?.enableScroll ?? false
  });
}

export const IframeInteractiveContentModel = TileContentModel
  .named("IframeInteractiveContent")
  .props({
    type: types.optional(types.literal(kIframeInteractiveTileType), kIframeInteractiveTileType),
    url: types.optional(types.string, ""),
    // frozen() types are immutable - to update, replace the entire object
    // interactiveState: Runtime-only, populated by interactive as students interact. Always starts empty.
    interactiveState: types.optional(types.frozen(), {}),
    // authoredState: Configured by curriculum authors, same for all students
    authoredState: types.optional(types.frozen(), {}),
    // Optional: Maximum height for the tile (useful for very tall interactives)
    // If not set or 0, uses calculated height from interactive with 2000px max
    maxHeight: types.optional(types.number, 0),
    // Optional: Enable scrolling for interactives taller than maxHeight
    enableScroll: types.optional(types.boolean, false)
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: any) {
      const snapshot = {
        type: self.type,
        url: self.url,
        interactiveState: self.interactiveState,
        authoredState: self.authoredState,
        maxHeight: self.maxHeight,
        enableScroll: self.enableScroll
      };
      return stringify(snapshot, { maxLength: 200 });
    }
  }))
  .actions(self => ({
    setUrl(url: string) {
      self.url = url;
    },
    setInteractiveState(state: any) {
      // Note: frozen types are immutable, so we replace the entire object
      self.interactiveState = state;
    },
    setAuthoredState(state: any) {
      self.authoredState = state;
    },
    setMaxHeight(height: number) {
      self.maxHeight = height;
    },
    setEnableScroll(enable: boolean) {
      self.enableScroll = enable;
    }
  }));

export interface IframeInteractiveContentModelType extends Instance<typeof IframeInteractiveContentModel> {}

export function isIframeInteractiveModel(model?: any): model is IframeInteractiveContentModelType {
  return model?.type === kIframeInteractiveTileType;
}
