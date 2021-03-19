import { createContext } from "react";

export interface IToolApi {
  getTitle?: () => string | undefined;
  hasSelection?: () => boolean;
  deleteSelection?: () => void;
  getSelectionInfo?: () => string;
  setSelectionHighlight?: (selectionInfo: string, isHighlighted: boolean) => void;
  isLinked?: () => boolean;
  getLinkIndex?: (index?: number) => number;
  getLinkedTables?: () => string[] | undefined;
  getContentHeight?: () => number | undefined;
  exportContentAsTileJson?: () => string;
  handleDocumentScroll?: (x: number, y: number) => void;
  handleTileResize?: (entry: ResizeObserverEntry) => void;
}

export interface IToolApiInterface {
  register: (id: string, toolApi: IToolApi) => void;
  unregister: (id: string) => void;
  getToolApi: (id: string) => IToolApi;
  forEach: (callback: (api: IToolApi) => void) => void;
}

export type IToolApiMap = Record<string, IToolApi>;

export const ToolApiInterfaceContext = createContext<IToolApiInterface | null>(null);

// set by the canvas and used by the toolbar
export type EditableToolApiInterfaceRef = React.MutableRefObject<IToolApiInterface | null>;
export const EditableToolApiInterfaceRefContext = createContext<EditableToolApiInterfaceRef | null>(null);
