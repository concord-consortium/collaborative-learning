# Collaborative Learning Tool Tiles

CLUE document content is made up of one or more tool tiles which are displayed in vertical scrolling format inside of workspaces. Each tool tile contains unique content based on the tool tile type, how the tool tile was authored, and how the user may have interacted with, modified, or added to the tool tile.

## Tool Tile Types
- Placeholder Tile: an empty placeholder tool tile
- Drawing Tool Tile: a tool tile that allows users to draw images
- Geometry Tool Tile: a tool tile that allows users to graph data
- Image Tool Tile: a tool tile that allows users to display a bitmap image
- Table Tool Tile: a tool tile that allows users to display data in a table
- Text Tool Tile: a tool tile that allows users to display text
- Dataflow Tool Tile: a tool tile that allows users to create flow programs. The Dataflow Tool Tile is only available on dataflow branches (e.g., https://github.com/concord-consortium/collaborative-learning/tree/dataflow or https://github.com/concord-consortium/collaborative-learning/tree/178982058-dataflow-tile)

Each tile type has a unique tool tile id. Here is an example of a tool tile id definition:
```
export const kPlaceholderToolID = "Placeholder";
```
These ids are used in several places. They are added as an enumerated type to `ToolTypeEnum` which is defined in `tool-types.ts` and used in `ToolTileComponent` to determine which tile type to render. Similarly, a tile specific string must also be added to `DocumentToolEnum` in `docoument.ts`:
```
export const DocumentToolEnum = types.enumeration("tool",
 ["delete", "drawing", "geometry", "image", "select", "table", "text", "dataflow", "placeholder"]);
```

## Tool Tile Models
Each tool tile requires a tool tile content model. This content model is specified as a MobX model and contains properties and actions specific to the tool tile type. Each of the tool tile content models is unioned together to make a `ToolContentUnion` type. 
```
export const ToolContentUnion = types.union(
                                  { dispatcher: toolFactory },
                                  PlaceholderContentModel,
                                  GeometryContentModel,
                                  ImageContentModel,
                                  TableContentModel,
                                  TextContentModel,
                                  DrawingContentModel,
                                  DataflowContentModel,
                                  UnknownContentModel);
```

We also specify `ToolTileModel`, a general content model which is the base content model used by all tool tiles. This model contains a `content` property of type `ToolContentUnion`. This allows us to access the `content` property of `ToolTileModel` for any tool tile, cast it to the unique content model for each tool tile, and then access properties and methods specific to that tool tile type found inside its tool tile content model.

## ToolTileComponent
`ToolTileComponent` is a React component that serves as the main container for each tool tile. Tool tile types are used in `ToolTileComponent` to determine which tool component will be rendered (a tool component is the unique React parent component created for each tool tile type). A tool component for each tool tile type is imported into `ToolTileComponent` and conditonally rendered based on the tool tile type. 
```
import GeometryToolComponent from "./geometry-tool/geometry-tool";
import TableToolComponent from "./table-tool/table-tool";
import TextToolComponent from "./text-tool";
import ImageToolComponent from "./image-tool";
import DrawingToolComponent from "./drawing-tool/drawing-tool";
import PlaceholderToolComponent from "./placeholder-tool/placeholder-tool";
import DataflowToolComponent from "./dataflow/dataflow-tool";
```

## IToolTileProps
`IToolTileProps` is an interface that specifies a general set of props used by *most* tool tiles (at present, not all tool tiles have been converted to use this interface with the lone remaining tool tile being the Dataflow tool tile). These props are passed from `ToolTileComponent` to the tool components that it renders. `IToolTileProps` is defined as follows:
```
interface IToolTileBaseProps {
  context: string;
  documentId?: string;  // permanent id (key) of the containing document
  docId: string;  // ephemeral contentId for the DocumentContent
  documentContent: HTMLElement | null;
  isUserResizable: boolean;
  scale?: number;
  widthPct?: number;
  height?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
  onResizeRow: (e: React.DragEvent<HTMLDivElement>) => void;
  onSetCanAcceptDrop: (tileId?: string) => void;
  onRequestTilesOfType: (tileType: string) => Array<{ id: string, title?: string }>;
  onRequestUniqueTitle: (tileId: string) => string | undefined;
  onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number) => void;
}

export interface IRegisterToolApiProps {
  onRegisterToolApi: (toolApi: IToolApi, facet?: string) => void;
  onUnregisterToolApi: (facet?: string) => void;
}

export interface IToolTileProps extends IToolTileBaseProps, IRegisterToolApiProps {
  toolTile: HTMLElement | null;
}
``` 

## IToolApi
A tool API allows tool components to implement one or more functions that can be called outside the tool tile. The tool API interface is defined as follows:
```
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
  exportContentAsTileJson?: (options?: ITileExportOptions) => string;
  handleDocumentScroll?: (x: number, y: number) => void;
  handleTileResize?: (entry: TileResizeEntry) => void;
}
```

A `IToolApiInterface` allows functions in the `IToolApi` to be registered, unregistered, and accessed.
```
export interface IToolApiInterface {
  register: (id: string, toolApi: IToolApi) => void;
  unregister: (id: string) => void;
  getToolApi: (id: string) => IToolApi;
  forEach: (callback: (api: IToolApi) => void) => void;
}
```

A tool API interface context, `ToolApiInterfaceContext`, is wrapped around the `Canvas` component containing the tiles. The `ToolApiInterfaceContext` is a React context created for the `IToolApiInterface`. This allows child components to access the functions in the `IToolApi`. The context is created as follows:
```
export const ToolApiInterfaceContext = createContext<IToolApiInterface | null>(null);
```

Functions to register and unregister tool API functions are passed to tool components via props from `ToolTileComponent`:
```
export interface IRegisterToolApiProps {
  onRegisterToolApi: (toolApi: IToolApi, facet?: string) => void;
  onUnregisterToolApi: (facet?: string) => void;
}
```

The tool component can then register a local implementation of the tool API functions so these functions can be called outside the component. For example:
```
this.props.onRegisterToolApi({
  exportContentAsTileJson: () => {
	return this.getContent().exportJson();
  }
});
```

When a component needs to access a function in the tool API, we can access the `ToolApiInterfaceContext`, get the tool API using `getToolApi`, and then access functions in the tool API:
```
const toolApiInterface = this.context;
const toolApi = toolApiInterface?.getToolApi(this.modelId);
toolApi?.exportContentAsTileJson?.(tileContents);
```

## Tool Components
Tool components are React components that are built for each tool tile type and are condtionally rendered by `ToolTileComponent`. The following tool components are defined in CLUE:

### PlaceholderToolComponent
The `PlaceholderToolComponent` is used for the Placeholder Tile, an empty placeholder tile.
- props
```
interface IProps {
  model: ToolTileModelType;
}
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: `this.stores.ui`

### DrawingToolComponent
The `DrawingToolComponent` is used for the Drawing Tool Tile, a tool tile that allows users to draw images.
- props
```
type IProps = IToolTileProps;
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: none

### GeometryToolComponent
The `GeometryToolComponent` is used for the Geometry Tool Tile, a tool tile that allows users to graph data.
- props
```
IGeometryProps // same as IToolTileProps
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: `useUIStore` hook

### ImageToolComponent
The `ImageToolComponent` is used for the Image Tool Tile, a tool tile that allows users to display a bitmap image.
- props
```
type IProps = IToolTileProps;
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>yes</b>
- stores accessed: `this.stores.ui`

### TableToolComponent
The `TableToolComponent` is used for the Table Tool Tile, a tool tile that allows users to display data in a table.
- props
```
IToolTileProps
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>yes, observes row selection from shared selection store</b>
- stores accessed: shared selection store?

### TextToolComponent
The `TextToolComponent` is used for the Text Tool Tile, a tool tile that allows users to display text.
- props
```
IToolTileProps
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>yes</b>
- stores accessed: `this.stores.ui`, `this.stores.unit`

### DataflowToolComponent
The `DataflowToolComponent` is used for the Dataflow Tool Tile: a tool tile that allows users to create flow programs. The Dataflow Tool Tile and `DataflowToolComponent` are only available on dataflow branches.
- props
```
interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
  height?: number;
}
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>yes</b>
- stores accessed: `this.stores.ui`, `this.stores.documents`, `this.stores.db`. Child components access stores too `hub`, `ui`, `appMode`.

## Adding a tool tile
New tool tiles are added to a document using an action in the `DocumentContentModel` such as `addPlaceholderTile` or `addGeometryTile`. For example:
```
addPlaceholderTile(sectionId?: string) {
  const placeholderContentInfo = getToolContentInfoById(kPlaceholderToolID);
  const content = placeholderContentInfo?.defaultContent(sectionId);
  return self.addTileContentInNewRow(content, { rowIndex: self.rowCount });
}
```

A new action must be created when a tool tile is added to the project.
