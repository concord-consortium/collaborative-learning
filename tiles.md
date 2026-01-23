# Collaborative Learning Tiles

At one time, CLUE code included references to tools and to tiles where tools (code) were responsible for creating/editing tiles (the content) analogous to the way applications are used to create documents on the desktop. As of version 3.3, this use of "tool" is deprecated and "tile" is used preferentially throughout the code.

CLUE document content is made up of one or more tiles which are displayed in rows in a vertical scrolling document or workspace. Each tile contains unique content based on the tile type, how the tile was authored, and how the user may have interacted with, modified, or added to the tile.

## Tile Types
- Placeholder: an empty placeholder tile; used when a document section is empty (has no other tiles)
- Drawing: a tile that allows users to draw images (lines, shapes, etc.)
- Geometry (Graph): a tile that allows users to create geometrical objects (e.g. points, polygons) and to plot points in a coordinate system
- Image: a tile that allows users to display an image (PNG, JPEG, SVG, etc.)
- Table: a tile that allows users to display data in a table
- Text: a tile that allows users to enter/edit/display styled text
- Dataflow (formerly dataflow branch only): a tile that allows users to create flow programs. The Dataflow Tile was only available on dataflow branches (e.g., https://github.com/concord-consortium/collaborative-learning/tree/dataflow or https://github.com/concord-consortium/collaborative-learning/tree/178982058-dataflow-tile) but has now been made available as part of the main application.

Each tile type has a unique tile type constant. Here is an example of a tile type definition:
```typescript
export const kPlaceholderTileType = "Placeholder";
```
These type constants are used in several places. They are used when the tile is registered with `registerTileContentInfo` and `registerTileComponentInfo`.

## Tile Models
Each tile defines a content model. This content model is specified as a MobX State Tree (MST) model and contains properties and actions specific to the tile. Each of the tile content models is unioned together to define the `TileContentUnion` type.
```typescript
export const TileContentUnion = types.union(
                                  { dispatcher: tileContentFactory },
                                  PlaceholderContentModel,
                                  GeometryContentModel,
                                  ImageContentModel,
                                  TableContentModel,
                                  TextContentModel,
                                  DrawingContentModel,
                                  DataflowContentModel,
                                  UnknownContentModel);
```

We also specify `TileModel`, a general content model which is the base content model used by all tiles. This model contains a `content` property of type `TileContentUnion`. This allows us to access the `content` property of `TileModel` for any tile, cast it to the unique content model for that tile, and then access properties and methods specific to that tile type.

### TileMetadataModel

Each tile content model can use a metadata model. This is used to store information that is shared across multiple instances of a document. It is also preserved across tile content reloads.

When a tile is registered it provides a metadata MST "class". When needed the metadata is looked up in a global map from tile id to metadata instance. If a metadata instance is not found, then one is created and added for this tile id. This code is in `tile-types.ts`.

The metadata is provided to the tile content model via a `doPostCreate` action called on the tile content model.

The metadata model was introduced at a time when the response to a remote (i.e. firebase) content change was to replace the document content with a brand new `DocumentContent` instance, which meant that all local state associated with a content instance was regularly lost. We have since moved to use `applySnapshot()` in this situation, which preserves the content instance, so the metadata model should no longer be needed for that purpose.

The metadata model is also used to communicate tile-specific information useful to the tile, notably the tile's id and title. The title is now accessible via the `getTileModel()` function and the id could be stored in a volatile property and set with a simple `setTileId()` action.

In short, the notion of tile metadata may have outlived its usefulness and we should endeavor to replace its use with more appropriate mechanisms where possible.

**NOTE**: If the same tile id is used in different documents, they will share the same metadata instance. This is uncommon with user created documents in which tile ids are random strings. When a document or set of tiles is copied the tile ids are updated to new random strings. However it can happen with authored content, and there is nothing preventing multiple documents from being stored in the database with duplicate tile ids.

## TileComponent
`TileComponent` is a React component that serves as the main container for each tile. Tile types are used in `TileComponent` to determine which tile component will be rendered (a tile component is the unique React parent component created for each tile type). A tile component for each tile type is imported into `TileComponent` and conditionally rendered based on the tile type.
```typescript
import GeometryToolComponent from "./geometry/geometry-tile";
import TableToolComponent from "./table/table-tile";
import TextToolComponent from "./text-tile";
import ImageToolComponent from "./image-tile";
import DrawingToolComponent from "./drawing/drawing-tile";
import PlaceholderToolComponent from "./placeholder/placeholder-tile";
import DataflowToolComponent from "./dataflow/dataflow-tile";
```

## ITileProps
`ITileProps` is an interface that specifies a general set of props used by *most* tiles (at present, not all tiles have been converted to use this interface with the lone remaining tile being the Dataflow tile). These props are passed from `TileComponent` to the tile components that it renders. `ITileProps` is defined as follows:
```typescript
interface ITileBaseProps {
  context: string;
  documentId?: string;  // permanent id (key) of the containing document
  docId: string;  // ephemeral contentId for the DocumentContent
  documentContent: HTMLElement | null;
  isUserResizable: boolean;
  scale?: number;
  widthPct?: number;
  height?: number;
  model: TileModelType;
  readOnly?: boolean;
  onResizeRow: (e: React.DragEvent<HTMLDivElement>) => void;
  onSetCanAcceptDrop: (tileId?: string) => void;
  onRequestUniqueTitle: (tileId: string) => string | undefined;
  onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number) => void;
}

export interface IRegisterTileApiProps {
  onRegisterTileApi: (tileApi: ITileApi, facet?: string) => void;
  onUnregisterTileApi: (facet?: string) => void;
}

export interface ITileProps extends ITileBaseProps, IRegisterTileApiProps {
  tileElt: HTMLElement | null;
}
```

The `on*` properties are a way for the tool component to communicate with the host, e.g. to request a change in height.

## ITileApi
A tile API allows tile components to implement one or more functions that can be called generically for any tile that supports the ITileApi without knowing the specific tile type. This can be thought of as the beginnings of a generic plugin API model for tiles. The tile API interface is defined as follows:
```typescript
export interface ITileApi {

  isLinked?: () => boolean;
  getContentHeight?: () => number | undefined;
  exportContentAsTileJson?: (options?: ITileExportOptions) => string;
  handleDocumentScroll?: (x: number, y: number) => void;
  handleTileResize?: (entry: TileResizeEntry) => void;
}
```

A `ITileApiInterface` allows tiles to register/unregister their support of the `ITileApi` and to potentially access the `ITileApi` of other tiles.
```typescript
export interface ITileApiInterface {
  register: (id: string, tileApi: ITileApi) => void;
  unregister: (id: string) => void;
  getTileApi: (id: string) => ITileApi;
  forEach: (callback: (api: ITileApi) => void) => void;
}
```

A tile API interface context, `TileApiInterfaceContext`, is wrapped around the `Canvas` component containing the document content (and thus the tiles). The `TileApiInterfaceContext` is a React context created for the `ITileApiInterface`. This allows child components to access the functions in the `ITileApi`. The context is created as follows:
```typescript
export const TileApiInterfaceContext = createContext<ITileApiInterface | null>(null);
```

Functions to register and unregister tile API functions are passed to tile components via props from `TileComponent`:
```typescript
export interface IRegisterTileApiProps {
  onRegisterTileApi: (tileApi: ITileApi, facet?: string) => void;
  onUnregisterTileApi: (facet?: string) => void;
}
```

The tile component can then register a local implementation of the tile API functions so these functions can be called outside the component. For example:
```typescript
this.props.onRegisterTileApi({
  exportContentAsTileJson: () => {
	return this.getContent().exportJson();
  }
});
```

When a component needs to access a function in the tile API, we can access the `TileApiInterfaceContext`, get the tile API using `getTileApi`, and then access functions in the tile API:
```typescript
const tileApiInterface = this.context;
const tileApi = tileApiInterface?.getTileApi(this.modelId);
tileApi?.exportContentAsTileJson?.(tileContents);
```
### Facet

`onRegisterTileApi` also takes a facet parameter. This is so additional sets of functions can be registered and unregistered.
Only a couple of the tile api functions are supported:
- `handleTileResize`, if this function is provided with a facet of `"layout"`, this function is given precedence over the non-facet implementation.
- `handleDocumentScroll` is called on all registered implementations, so it will be called on both the facet and non-facet implementations.

Currently the `"layout"` facet is used by `useToolBarToolApi` and `useFloatingToolbarLocation`.

## Floating Toolbar
Most tiles have a floating toolbar.

This is implemented by a child component of the tile component.
This child component creates a React Portal in the main document div, and sets the location of the portal using `useFloatingToolbarLocation`.

Functional tile components call `useToolbarTileApi` to setup properties to pass to this child component.

Class tile components setup the the properties themselves without the hook.

## Linked Tiles
Some tiles can be linked together, so they can provide multiple views of the same data. Originally, this was limited to the table and geometry tiles and the means of linking them was rather ad hoc. More recently, a shared model infrastructure has been implemented to more robustly support linking content between tiles.

### Shared Selection
When tiles are linked they use the `selection` MST store to synchronize their selection. Currently only the Table and Geometry tiles support this because they're the only ones that have a shared selection state.

The selection store is a map with keys of tile id and values of type `DataSetSelectionModel`. The `DataSetSelectionModel` is a map of booleans. For a table tile the ids in this map are the row ids.

The table tile component accesses the `selection` store via `useSharedSelectionStore` . This hook is called indirectly via the `useGridContext` hook. The `useGridContext` hook provides callback methods used by `ReactDataGrid`, the implementations of these callbacks modify the table's selection model in the `selection` store. Additionally the table tile component is an MST observer so it is re-rendered when properties in the selection models are changed by other tile components.

The geometry tile component takes a different approach. It has a child component called `GeometryContentComponent`. This is a class based component so the MST stores are injected with `@inject("stores")`, when `GeometryContentComponent` is initialized it sets the selection store on the content metadata model: `content.metadata.setSharedSelection(this.stores.selection)`. The geometry content model has a `setElementSelection` which is called when the JXGraph selects an element. If the selected element has `linkedTableId` and `linkedRowId` attributes, then the selection model is updated in the selection store.

When a table is linked to a geometry tile using the `addTableLink` action, the selection model for the table in selection store is observed for changes. When a document is loaded that has a table linked to a geometry tool the table's event are replayed so the `addTableLink` action happens again and the table is again observing the selection model.

## Tile Components
Tile components are React components that are built for each tile type and are conditionally rendered by `TileComponent`.
Each Tile component is passed its content through a model property by the `TileComponent` which wraps it.
The `content` is a MST model that is part of a document in the `documents` store.

The following tile components are defined in CLUE:

### PlaceholderToolComponent
The `PlaceholderToolComponent` is used for the Placeholder Tile, an empty placeholder tile.
- props
```typescript
interface IProps {
  model: TileModelType;
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
type IProps = ITileProps;
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **no**
- stores accessed: none
- floating toolbar: `ToolbarView`, setup with `useToolbarTileApi`

Note: The drawing tile requires access to a set of stamp images that are defined by the curriculum unit. One might think that these would be passed in as props or perhaps accessed via the stores, but actually they are provided to the `DrawingContent` on construction and then stored (apparently redundantly) in each tile for reasons that have been lost to the mists of time.

### GeometryToolComponent
The `GeometryToolComponent` is used for the Geometry Tile, a tile that allows users to create geometrical objects (e.g. points, polygons) and to plot points in a coordinate system.
- props
```typescript
IGeometryProps // same as ITileProps
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **no**
- stores accessed:
    - `useUIStore` hook
    - `this.stores.selection` in child component `GeometryContentComponent` (class component)
- floating toolbar: `GeometryToolbar`, setup with `useToolbarTileApi`

### ImageToolComponent
The `ImageToolComponent` is used for the Image Tile, a tile that allows users to display an image (e.g. PNG, JPEG, SVG, etc.).
- props
```typescript
type IProps = ITileProps;
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
ITileProps
```
- class or functional component: **functional component**
- extends BaseComponent: **no**
- uses inject/observer pattern: **yes, observes row selection from shared selection store**
- stores accessed:
    - `useSharedSelectionStore` hook
- floating toolbar: `TableToolbar`, setup with `useToolbarTileApi`

### TextToolComponent
The `TextToolComponent` is used for the Text Tile, a tile that allows users to enter/edit/display styled text.
- props
```typescript
ITileProps
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
  model: TileModelType;
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

## Adding a new tile
New tiles can be added to a document using the `DocumentContentModel#addTile` action. For example:
```typescript
content.addTile("text")
```

The implementation of `addTile` looks up the tile content info registered by the tile. Then uses the `defaultContent` function of the tile content info to create a content model for the tile. And finally wraps the content model in a `TileModel` and adds that to the document.

## Adding a new tile to the codebase

To create a new tile type in CLUE, you need to implement several components that work together. Most tiles are organized as plugins in the `src/plugins/` directory.

### Quick Start: Using the Starter Tile

The fastest way to create a new tile is to copy the [starter tile](src/plugins/starter/) which provides a complete working example with all the necessary files and boilerplate code.

**Steps to use the starter tile:**

1. Copy the entire `src/plugins/starter/` folder to a new folder with your tile's name:
   ```bash
   cp -r src/plugins/starter src/plugins/your-tile
   ```

2. Rename all occurrences of `starter` and `Starter` in:
   - File contents (class names, function names, imports, etc.)
   - Filenames (e.g., `starter-tile.tsx` → `your-tile-tile.tsx`)

3. Update the icon files:
   - Open `your-tile-icon.svg` and change the "St" text to your tile's abbreviation
   - Open `your-tile-tile-id.svg` and change the "St" text similarly

4. Register your new tile in `src/register-tile-types.ts`:
   ```typescript
   "YourTile": loggedLoad("YourTile", () => [
     import(/* webpackChunkName: "YourTile" */"./plugins/your-tile/your-tile-registration")
   ]),
   ```

5. Add your tile to unit configuration(s) where it should appear in the toolbar:
   - **Best practice**: Add new tiles to specific units, not the global `src/clue/app-config.json`
   - For development/testing, add to the QA unit at `src/public/demo/units/qa/content.json`
   - Add to the `toolbar` array:
     ```json
     {"id": "YourTile", "title": "Your Tile", "isTileTool": true}
     ```
   - Only add to curriculum units that actually need this tile

The starter tile includes a simple textarea example that demonstrates the basic structure, content model with MST, and proper component setup. See the [starter tile README](src/plugins/starter/README.md) for more details.

### Manual Implementation

If you prefer to build from scratch or need to understand the components in detail, follow these steps:

#### Required Components

1. **Type definition file** (`your-tile-types.ts`)
2. **Content model** (`your-tile-content.ts`) - MST model for state management
3. **React component** (`your-tile-tile.tsx`) - The UI component
4. **Registration file** (`your-tile-registration.ts`) - Registers the tile with CLUE
5. **Assets** - Icon SVG files for toolbar and header
6. **Styling** (`your-tile.scss`) - Component styles
7. **Optional toolbar** (`your-tile-toolbar.tsx`) - Floating toolbar with tile-specific controls

### Folder Structure

Create a new folder in `src/plugins/` with this structure:
```
src/plugins/your-tile/
├── assets/
│   ├── your-tile-icon.svg        # Toolbar icon
│   └── your-tile-tile-id.svg     # Header icon (optional)
├── your-tile-types.ts
├── your-tile-content.ts
├── your-tile-tile.tsx
├── your-tile-registration.ts
├── your-tile-toolbar.tsx         # Optional
└── your-tile.scss
```

### Step-by-Step Implementation

#### 1. Define tile types (`your-tile-types.ts`)

Define constants for your tile type identifier, content type name, and default dimensions:

```typescript
export const kYourTileTileType = "YourTile";
export const kYourTileContentType = "YourTileContentModel";
export const kYourTileDefaultHeight = 320;
```

#### 2. Create the content model (`your-tile-content.ts`)

The content model extends `TileContentModel` and uses MobX State Tree (MST):

```typescript
import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kYourTileTileType, kYourTileContentType } from "./your-tile-types";

export const YourTileContentModel = TileContentModel
  .named(kYourTileContentType)
  .props({
    type: types.optional(types.literal(kYourTileTileType), kYourTileTileType),
    // Add your tile-specific properties here
    // Example: myProperty: types.optional(types.string, "")
  })
  .views(self => ({
    // Views are computed properties
    get isUserResizable() {
      return true;  // Set to false if tile should not be resizable
    }
  }))
  .actions(self => ({
    // Actions modify the model state
    // Example: setMyProperty(value: string) { self.myProperty = value; }
  }));

export type YourTileContentModelType = Instance<typeof YourTileContentModel>;

export function defaultYourTileContent(): YourTileContentModelType {
  return YourTileContentModel.create({});
}

// Type guard helper
export function isYourTileModel(model?: any): model is YourTileContentModelType {
  return model?.type === kYourTileTileType;
}
```

#### 3. Create the React component (`your-tile-tile.tsx`)

The component can be either functional (recommended) or class-based:

```typescript
import React from "react";
import { observer } from "mobx-react";
import { ITileProps } from "../../components/tiles/tile-component";
import { isYourTileModel } from "./your-tile-content";
import { TileToolbar } from "../../components/toolbar/tile-toolbar";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";

import "./your-tile.scss";
import "./your-tile-toolbar";  // If you have a toolbar

export const YourTileComponent: React.FC<ITileProps> = observer((props: ITileProps) => {
  const { model, readOnly, onRequestRowHeight } = props;
  const content = isYourTileModel(model.content) ? model.content : null;

  if (!content) return null;

  return (
    <div className="tile-content your-tile-wrapper">
      <BasicEditableTileTitle />
      <TileToolbar tileType="your-tile" readOnly={!!readOnly} tileElement={props.tileElt} />
      <div className="your-tile-content">
        {/* Your tile UI implementation here */}
      </div>
    </div>
  );
});
```

#### 4. Create the registration file (`your-tile-registration.ts`)

This file registers both the content model and the React component:

```typescript
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kYourTileTileType, kYourTileDefaultHeight } from "./your-tile-types";
import { YourTileComponent } from "./your-tile-tile";
import { defaultYourTileContent, YourTileContentModel } from "./your-tile-content";

import Icon from "./assets/your-tile-icon.svg";
import HeaderIcon from "./assets/your-tile-tile-id.svg";

registerTileContentInfo({
  type: kYourTileTileType,
  displayName: "Your Tile",  // Display name shown in UI
  modelClass: YourTileContentModel,
  defaultContent: defaultYourTileContent,
  defaultHeight: kYourTileDefaultHeight,
  // Optional properties:
  // isDataConsumer: true,  // If tile consumes data from SharedDataSet
  // consumesMultipleDataSets: (appConfig) => true,  // If multiple datasets supported
  // updateContentWithNewSharedModelIds: updateFunction,  // For handling shared model updates
});

registerTileComponentInfo({
  type: kYourTileTileType,
  Component: YourTileComponent,
  tileEltClass: "your-tile-tile",  // CSS class for the tile element
  Icon,
  HeaderIcon
});
```

#### 5. Register in the tile type registry (`src/register-tile-types.ts`)

Add your tile to the `gTileRegistration` object so it can be dynamically loaded:

```typescript
const gTileRegistration: Record<string, () => void> = {
  // ... existing tiles ...
  "YourTile": loggedLoad("YourTile", () => [
    import(/* webpackChunkName: "YourTile" */"./plugins/your-tile/your-tile-registration")
  ]),
  // ... more tiles ...
};
```

If your tile uses shared models (like SharedDataSet), include those imports too:
```typescript
"YourTile": loggedLoad("YourTile", () => [
  import(/* webpackChunkName: "YourTile" */"./plugins/your-tile/your-tile-registration"),
  import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
]),
```

### Optional Features

#### Floating Toolbar

For functional components, use the `useToolbarTileApi` hook to set up toolbar integration:

```typescript
import { useToolbarTileApi } from "../../components/toolbar/use-toolbar-tile-api";

export const YourTileComponent: React.FC<ITileProps> = observer((props) => {
  // ... other code ...

  const { getContentHeight } = useToolbarTileApi({
    id: model.id,
    enabled: true,
    // Implement ITileApi functions:
    // getContentHeight: () => number,
    // exportContentAsTileJson: (options) => string,
    // handleDocumentScroll: (x, y) => void,
    // handleTileResize: (entry) => void
  });

  // ... rest of component ...
});
```

#### Shared Models and Data Linking

If your tile needs to link with other tiles (like Table and Geometry do), use shared models:

```typescript
// In your content model:
.views(self => ({
  get sharedModel() {
    const sharedModelManager = self.tileEnv?.sharedModelManager;
    const firstSharedModel = sharedModelManager?.getTileSharedModelsByType(
      self,
      SharedDataSet
    )?.[0];
    return firstSharedModel as SharedDataSetType | undefined;
  }
}))
```

See the [shared-models.md](docs/shared-models.md) documentation for more details on linking tiles.

#### Shared Selection

Tiles that share data can synchronize their selection state using the selection store:

```typescript
import { useSharedSelectionStore } from "../../hooks/use-stores";

// In your component:
const selectionStore = useSharedSelectionStore();
const selection = selectionStore?.getDataSetSelection(dataSetId);
```

### Testing Your New Tile

1. Run `npm start` to start the development server
2. Open CLUE in your browser
3. Look for your tile in the toolbar (it should appear with your icon)
4. Add the tile to a document and verify it:
   - Renders correctly
   - Saves and loads properly
   - Responds to user interactions
   - Integrates with shared models (if applicable)
   - Resizes correctly (if resizable)

### Making Your Tile Available in the Toolbar

Both the full CLUE application and the [standalone document editor](/editor/) require tiles to be explicitly configured in a unit configuration file to appear in the toolbar. If a unit doesn't specify its own toolbar, it falls back to the global `app-config.json`, but **adding tiles to the global app-config is discouraged** as it affects all units that don't override the toolbar.

To make your new tile available:

1. **For testing during development**, use the QA unit which includes most tiles:
   ```
   http://localhost:8080/editor/?unit=./demo/units/qa/content.json
   ```

2. **To add your tile to a unit configuration**, edit the unit's `content.json` file and add your tile to the `toolbar` array:
   ```json
   {
     "toolbar": [
       {"id": "YourTile", "title": "Your Tile", "isTileTool": true},
       // ... other tiles
     ]
   }
   ```

3. **Toolbar button properties**:
   - `id`: The tile type identifier (must match `kYourTileTileType`)
   - `title`: Display name shown in the toolbar (optional, defaults to `displayName` from registration)
   - `isTileTool`: Set to `true` for tile tools, `false` for actions like undo/redo
   - `iconId`: Custom icon class (optional, defaults to the SVG icon from registration)

4. **For the main QA unit**, add your tile to [`src/public/demo/units/qa/content.json`](src/public/demo/units/qa/content.json):
   ```json
   "toolbar": [
     {"id": "Question", "title": "Question", "isTileTool": true},
     {"id": "Text", "title": "Text", "isTileTool": true},
     {"id": "YourTile", "title": "Your Tile", "isTileTool": true},
     // ... other tiles
   ]
   ```

5. **Advanced: Conditional tile availability** - You can also specify which tiles are available using the `tools` property:
   ```json
   {
     "tools": ["YourTile", "Text", "Table"],
     "toolbar": [...]
   }
   ```
   If `tools` is specified, only those tiles will be loaded. If omitted, tiles are loaded based on toolbar configuration.

### Examples to Reference

- **Simple tile**: [starter](src/plugins/starter/) - Minimal example, good starting point
- **Data consumer**: [bar-graph](src/plugins/bar-graph/) or [graph](src/plugins/graph/) - Consumes SharedDataSet
- **Complex interactions**: [geometry](src/models/tiles/geometry/) - Linked selection with tables
- **Drawing tools**: [drawing](src/plugins/drawing/) - Canvas-based tile

### Additional Documentation

- [tile-creation.md](docs/tile-creation.md) - Flowcharts showing tile creation flows
- [shared-models.md](docs/shared-models.md) - Linking tiles together
- [text-tile-plugins.md](docs/text-tile-plugins.md) - Creating text tile plugins
