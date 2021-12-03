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
These ids are used in several places. These ids are used in several places. They are defined when the tool is registered with `registerToolContentInfo`.

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

The `on*` properties are a way for the tool component tell the host things like wanting a larger height.

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
### Facet

`onRegisterToolApi` also takes a facet parameter. This is so additional sets of functions can be registered and unregistered.
Only a couple of the tool api functions are supported:
- `handleTileResize`, if this function is provided with a facet of `"layout"`, this function is given precedence over the non-facet implementation.
- `handleDocumentScroll` is called on all registered implementations, so it will be called on both the facet and non-facet implementations.

Currently the `"layout"` facet is used by `useToolBarToolApi` and `useFloatingToolbarLocation`.

## Floating Toolbar
Most tool tiles have a floating toolbar.

This is implemented by a child component of the tool component.
This child component creates a React Portal in the main document div, and sets the location of the portal using `useFloatingToolbarLocation`.

Functional tool components call `useToolbarToolApi` to setup properties to pass to this child component.

Class tool components setup the the properties themselves without the hook.

## Linked Tiles
Some tool tiles can be linked together, so they can provide multiple views of the same data. Currently this is limited to the table and geometry tiles and the means of linking them is rather ad hoc.

### Shared Selection
When tiles are linked they use the `selection` MST store to synchronize their selection. Currently only the Table and Geometry tools support this because they're the only ones that have a shared selection state.

The selection store is a map with keys of toolId and values of type `DataSetSelectionModel`. The `DataSetSelectionModel` is a map of booleans. For a table tool the ids in this map are the row ids.

The table tool component accesses the `selection` store via `useSharedSelectionStore` . This hook is called indirectly via the `useGridContext` hook. The `useGridContext` hook provides callback methods used by ReactDataGrid, the implementations of these callbacks modify the table's selection model in the `selection` store. Additionally the table tool component is an MST observer so it is re-rendered when properties in the selection models are changed by other tool components.

The geometry tool component takes a different approach. It has a child component called `GeometryContentComponent`. This is a class based component so the MST stores are injected with `@inject("stores")`, when `GeometryContentComponent` is initialized it sets the selection store on the content metadata model: `content.metadata.setSharedSelection(this.stores.selection)`. The geometry content model has a `setElementSelection` which is called when the JXGraph selects an element. If the selected element has `linkedTableId` and `linkedRowId` attributes, then the selection model is updated in the selection store.

When a table is linked to the geometry tool using the `addTableLink` action, the selection model for the table in selection store is observed for changes. When a document is loaded that has a table linked to a geometry tool the table's event are replayed so the `addTableLink` action happens again and the table is again observing the selection model.

## Tool Components
Tool components are React components that are built for each tool tile type and are conditionally rendered by `ToolTileComponent`.
Each Tool component is passed its content through a model property by the `ToolTileComponent` which wraps it.
The `content` is a MST model that is part of a document in the `documents` store.

The following tool components are defined in CLUE:

### PlaceholderToolComponent
The `PlaceholderToolComponent` is used for the Placeholder Tile, an empty placeholder tile.
- props
```typescript
interface IProps {
  model: ToolTileModelType;
}
```
- class or functional component: **class component**
- extends BaseComponent: **yes**
- uses inject/observer pattern: **no**
- stores accessed:
    - `this.stores.ui`
- floating toolbar: **no**

### DrawingToolComponent
The `DrawingToolComponent` is used for the Drawing Tile, a tile that allows users to draw images.
- props
```typescript
type IProps = IToolTileProps;
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **no**
- stores accessed: none
- floating toolbar: `ToolbarView`, setup with `useToolbarToolApi`

Note: The drawing tool requires access to a set of stamp images that are defined by the curriculum unit. One might think that these would be passed in as props or perhaps accessed via the stores, but actually they are provided to the `DrawingContent` on construction and then stored (apparently redundantly) in each tile for reasons that have been lost to the mists of time.

### GeometryToolComponent
The `GeometryToolComponent` is used for the Geometry Tile, a tile that allows users to create geometrical objects (e.g. points, polygons) and to plot points in a coordinate system.
- props
```typescript
IGeometryProps // same as IToolTileProps
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **no**
- stores accessed:
    - `useUIStore` hook
    - `this.stores.selection` in child component `GeometryContentComponent` (class component)
- floating toolbar: `GeometryToolbar`, setup with `useToolbarToolApi`

### ImageToolComponent
The `ImageToolComponent` is used for the Image Tile, a tile that allows users to display an image (e.g. PNG, JPEG, SVG, etc.).
- props
```typescript
type IProps = IToolTileProps;
```
- class or functional component: **class component**
- extends BaseComponent: **yes**
- uses inject/observer pattern: **yes**
- stores accessed:
    - `this.stores.ui`
- floating toolbar: `ImageToolbar`

### TableToolComponent
The `TableToolComponent` is used for the Table Tile, a tile that allows users to display data in a table.
- props
```typescript
IToolTileProps
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **yes, observes row selection from shared selection store**
- stores accessed:
    - `useSharedSelectionStore` hook
- floating toolbar: `TableToolbar`, setup with `useToolbarToolApi`

### TextToolComponent
The `TextToolComponent` is used for the Text Tile, a tile that allows users to enter/edit/display styled text.
- props
```typescript
IToolTileProps
```
- class or functional component: **class component**
- extends BaseComponent: **yes**
- uses inject/observer pattern: **yes**
- stores accessed:
    - `this.stores.ui`
    - `this.stores.unit`
- floating toolbar: `TextToolbarComponent`

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
- class or functional component: **class component**
- extends BaseComponent: **yes**
- uses inject/observer pattern: **yes**
- stores accessed:
    - `this.stores.ui`,
    - `this.stores.documents`,
    - `this.stores.db`.
    - Child components access stores too `hub`, `ui`, `appMode`.

## Adding a tool tile
New tool tiles can be added to a document using the `DocumentContentModel#addTile` action. For example:
```typescript
content.addTile("text")
```

The implementation of `addTile` looks up the tool content info registered by the Tool. Then uses the `defaultContent` function of the tool content info to create a content model for the tile. And finally wraps the content model in a `ToolTileModel` and adds that to the document.
