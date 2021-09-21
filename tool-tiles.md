# Collaborative Learning Tools and Tiles

Nomenclature: tool:tile as application:document, i.e. the text tool (code) is responsible for creating/editing text tiles (the content).

CLUE document content is made up of one or more tiles which are displayed in rows in a vertical scrolling document or workspace. Each tile contains unique content based on the tool type, how the tile was authored, and how the user may have interacted with, modified, or added to the tile.

## Tool Tile Types
- Placeholder: an empty placeholder tile; used when a document section is empty (has no other tiles)
- Drawing: a tile that allows users to draw images (lines, shapes, etc.)
- Geometry (Graph): a tile that allows users to create geometrical objects (e.g. points, polygons) and to plot points in a coordinate system
- Image: a tile that allows users to display an image (PNG, JPEG, SVG, etc.)
- Table: a tile that allows users to display data in a table
- Text: a tile that allows users to enter/edit/display styled text
- Dataflow (dataflow branch only): a tile that allows users to create flow programs. The Dataflow Tool Tile is only available on dataflow branches (e.g., https://github.com/concord-consortium/collaborative-learning/tree/dataflow or https://github.com/concord-consortium/collaborative-learning/tree/178982058-dataflow-tile)

Each tile type has a unique tool id. Here is an example of a tool tile id definition:
```typescript
export const kPlaceholderToolID = "Placeholder";
```
These ids are used in several places. They are added as an enumerated type to `ToolTypeEnum` which is defined in `tool-types.ts` and used in `ToolTileComponent` to determine which tile type to render. Similarly, a tile specific string must also be added to `DocumentToolEnum` in `document.ts`:
```typescript
export const DocumentToolEnum = types.enumeration("tool",
 ["delete", "drawing", "geometry", "image", "select", "table", "text", "dataflow", "placeholder"]);
```

## Tool Tile Models
Each tool defines a tile content model. This content model is specified as a MobX State Tree (MST) model and contains properties and actions specific to the tool. Each of the tool tile content models is unioned together to define the `ToolContentUnion` type.
```typescript
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

We also specify `ToolTileModel`, a general content model which is the base content model used by all tool tiles. This model contains a `content` property of type `ToolContentUnion`. This allows us to access the `content` property of `ToolTileModel` for any tile, cast it to the unique content model for that tile, and then access properties and methods specific to that tile type.

## ToolTileComponent
`ToolTileComponent` is a React component that serves as the main container for each tile. Tool tile types are used in `ToolTileComponent` to determine which tool component will be rendered (a tool component is the unique React parent component created for each tool tile type). A tool component for each tool tile type is imported into `ToolTileComponent` and conditionally rendered based on the tool tile type.
```typescript
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
```typescript
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
A tool API allows tool components to implement one or more functions that can be called generically for any tile that supports the ToolApi without knowing the specific tile type. This can be thought of as the beginnings of a generic plugin API model for tiles. The tool API interface is defined as follows:
```typescript
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

A `IToolApiInterface` allows tiles to register/unregister their support of the `IToolApi` and to potentially access the `IToolApi` of other tiles.
```typescript
export interface IToolApiInterface {
  register: (id: string, toolApi: IToolApi) => void;
  unregister: (id: string) => void;
  getToolApi: (id: string) => IToolApi;
  forEach: (callback: (api: IToolApi) => void) => void;
}
```

A tool API interface context, `ToolApiInterfaceContext`, is wrapped around the `Canvas` component containing the document content (and thus the tiles). The `ToolApiInterfaceContext` is a React context created for the `IToolApiInterface`. This allows child components to access the functions in the `IToolApi`. The context is created as follows:
```typescript
export const ToolApiInterfaceContext = createContext<IToolApiInterface | null>(null);
```

Functions to register and unregister tool API functions are passed to tool components via props from `ToolTileComponent`:
```typescript
export interface IRegisterToolApiProps {
  onRegisterToolApi: (toolApi: IToolApi, facet?: string) => void;
  onUnregisterToolApi: (facet?: string) => void;
}
```

The tool component can then register a local implementation of the tool API functions so these functions can be called outside the component. For example:
```typescript
this.props.onRegisterToolApi({
  exportContentAsTileJson: () => {
	return this.getContent().exportJson();
  }
});
```

When a component needs to access a function in the tool API, we can access the `ToolApiInterfaceContext`, get the tool API using `getToolApi`, and then access functions in the tool API:
```typescript
const toolApiInterface = this.context;
const toolApi = toolApiInterface?.getToolApi(this.modelId);
toolApi?.exportContentAsTileJson?.(tileContents);
```

## Tool Components
Tool components are React components that are built for each tool tile type and are conditionally rendered by `ToolTileComponent`. The following tool components are defined in CLUE:

### PlaceholderToolComponent
The `PlaceholderToolComponent` is used for the Placeholder Tile, an empty placeholder tile.
- props
```typescript
interface IProps {
  model: ToolTileModelType;
}
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: `this.stores.ui`

### DrawingToolComponent
The `DrawingToolComponent` is used for the Drawing Tile, a tile that allows users to draw images.
- props
```typescript
type IProps = IToolTileProps;
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: none

Note: The drawing tool requires access to a set of stamp images that are defined by the curriculum unit. One might think that these would be passed in as props or perhaps accessed via the stores, but actually they are provided to the `DrawingContent` on construction and then stored (apparently redundantly) in each tile for reasons that have been lost to the mists of time.

### GeometryToolComponent
The `GeometryToolComponent` is used for the Geometry Tile, a tile that allows users to create geometrical objects (e.g. points, polygons) and to plot points in a coordinate system.
- props
```typescript
IGeometryProps // same as IToolTileProps
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>no</b>
- stores accessed: `useUIStore` hook

### ImageToolComponent
The `ImageToolComponent` is used for the Image Tile, a tile that allows users to display an image (e.g. PNG, JPEG, SVG, etc.).
- props
```typescript
type IProps = IToolTileProps;
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>yes</b>
- stores accessed: `this.stores.ui`

### TableToolComponent
The `TableToolComponent` is used for the Table Tile, a tile that allows users to display data in a table.
- props
```typescript
IToolTileProps
```
- class or functional component: <b>functional component</b>
- extends BaseComponent: <b>no</b>
- uses inject/observer pattern: <b>yes, observes row selection from shared selection store</b>
- stores accessed: `useSharedSelectionStore` hook

### TextToolComponent
The `TextToolComponent` is used for the Text Tile, a tile that allows users to enter/edit/display styled text.
- props
```typescript
IToolTileProps
```
- class or functional component: <b>class component</b>
- extends BaseComponent: <b>yes</b>
- uses inject/observer pattern: <b>yes</b>
- stores accessed: `this.stores.ui`, `this.stores.unit`

### DataflowToolComponent
The `DataflowToolComponent` is used for the Dataflow Tile: a tile that allows users to create flow programs. The Dataflow Tile and `DataflowToolComponent` are only available on dataflow branches.
- props
```typescript
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
```typescript
addPlaceholderTile(sectionId?: string) {
  const placeholderContentInfo = getToolContentInfoById(kPlaceholderToolID);
  const content = placeholderContentInfo?.defaultContent(sectionId);
  return self.addTileContentInNewRow(content, { rowIndex: self.rowCount });
}
```

A new action must be created when a tool tile is added to the project.
