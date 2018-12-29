# Changelog

## Version 0.2.0 - released December 28, 2018

- Geometry: Labeled polygon angles
- Internal: Image storage refactor
- Internal: Rollbar support
- Internal: Cypress integration tests

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 318,419 bytes | 391% |
| index.js | 2,937,057 bytes | 28.3% |

## Version 0.1.3 - released December 7, 2018

- Fix polygon selection bug in four-up view
- Fix for some point drags failing to save
- Fix for some polygon drag bugs

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 64,876 bytes | 0.0% |
| index.js | 2,288,515 bytes | 0.0% |

## Version 0.1.2 - released November 20, 2018

- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 64,876 bytes | 0.0% |
| index.js | 2,289,028 bytes | 0.0% |

## Version 0.1.1 - released November 20, 2018

- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 64,876 bytes | 0.0% |
| index.js | 2,288,722 bytes | 0.0% |

## Version 0.1.0 - released November 19, 2018

- DrawTool: Support background image
- Geometry: polygon rotation
- Geometry: Fix polygon (and other) selection issues
- Geometry: All selected objects drag together
- Geometry: Shape set in a graph for Rep-tiles unit
- Add ability to publish Learning Logs
- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 64,876 bytes | 8.9% |
| index.js | 2,288,591 bytes | 2.6% |

## Version 0.0.9 - released November 1, 2018

- Tile drag feedback
- Sync selection on geometry
- Add drawing tool
- Copy and paste geometry features
- Adding migration tools and first migration
- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 59,586 bytes | 52.0% |
| index.js | 2,230,580 bytes | 1.6% |

## Version 0.0.8 - released October 25, 2018

- Styling left nav canvas buttons [#161403821]
- Implement selection of points [#160969495] - clicking on a single point selects it - ctrl/shift/cmd-click to select multiple points - backspace/delete keys delete selected points [#161272021]
- Support deleting points with toolbar red-X [#161272021]
- Adding 4-up messages to unshared group content

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 39,212 bytes | 3.6% |
| index.js | 2,195,223 bytes | -14.7% |

## Version 0.0.7 - released October 19, 2018

- Add null test before handleCreatePolygon() [#161349320]
- Prevent geometry background images from being dragged [#161343613]
- Remove previous image when dropping image on geometry [#161343613]
- The group view in the header now matches 4-up group view [#161358684]
- Adding a drag handle in the upper left of each tile

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 37,835 bytes | 2.1% |
| index.js | 2,573,839 bytes | 0.0% |

## Version 0.0.6 - released October 18, 2018

- Fixed problem display in teacher dashboard [#161252954]
- Fix scaled geometry clicks [#161234989] - fixes clicks, drags, double-clicks in four-up and other scaled views
- Disable dragging to read-only geometry tool instances [#161287045]
- Fix comparison workspace [#161270806][#161270843]
- Publications only show in comparison view [#161331884]
- Published documents should be read-only [#161328541]
- Don't allow drops on read-only canvases [#161272097]
- Auto-select and scroll to new tile rows [#161151927]
- Adds remote endpoint to log messages
- Full support for image upload
- Updates to UI including editability icons, group styling and new icons with hover behavior

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 37,068 bytes | 6.4% |
| index.js | 2,572,874 bytes | 0.2% |

## Version 0.0.5 - released October 16, 2018

- Spike: add image to geometry in curriculum [#161137053] - add support for images to geometry tool
- Support multiple tiles per row [#160634560] - drop tile at left or right edge of row (w/in 20px) to add tile to row - sized components (e.g. geometry tool) carry their size with them - deleting/removing a tile from a row resizes if there are no more sized components - tiles in row stretch to fill vertical height of row - drag handlers revert to using `clientY` rather than `pageY` since `pageY` reflects page scroll not element scroll
- Adjust default geometry tool height and grid size [#160864536]
- Image upload functionality (#105)
- Support dragging image tool to geometry to overlay image [#160604676] - image drop zone is central area more than 25 pixels from edge (to avoid conflict with tile drop zones) - only works for simple URLs (e.g. curriculum images) - no image upload support yet

### Asset Sizes

| File | Size | % Change from 0.0.3 |
|---|---|---|
| index.css | 34,385 bytes | 190% |
| index.js | 2,565,366 bytes | 72% |

## Version 0.0.4 - released October 15, 2018

- Added static supports to workspaces [#160359307]
- Added db#getOrCreateDocumentListener helper
- Moved the Open button in left nav to below document content [#160530029]
- Add ability to create Geometry tool [#159979566]
- Clicks on board create points [#159979616]
- [With Dave] Support dragging tool tiles [#159979496]
- Added inital learning logs, plus styling and 2-up view [#159980496] [#160073076] [#160179071] [#160529990]
- Support tool selection [#160300212]
- Add delete tool which deletes the currently selected tile [#160407213]
- Fix bleed-through of geometry labels onto other layers (e.g. learning log) [#160686040] - create stacking context in tool-tile such that tool-specific z-indexes are contained - "what happens in tool tiles, stays in tools tiles"
- Enabled rename of learning logs [#160073076]
- Replaced yarn with npm [#160686153]
- Fix delete of text tool [[#160702405]] - text tool no longer deselects tile on loss of focus - text tool still selects on tile on focus
- Fix TypeError: Cannot read property 'uid' of undefined [#160687074]
- Fixed area below My Work tab prevents clicking content [#160688301]
- Bring test code coverage back up [#160687173]
- Guarantee unique IDs for geometry components [#160686176]
- GeometryTool renders in 4-up view [#160686176] GeometryTool resizes when appropriate [#160688141] - the 4-up issue turned out to be a resize issue
- GeometryTool synchronizes changes received from Firebase [#160686305]
- Added static image tool [#160574813]
- More styling changes [#160179071]
- fix geometry tool drag image [#160767277]
- Save/synchronize dragged point locations [#160815181] - handle point drag events - synchronize point location to model on drop - add uuids for synchronizing updates
- Implement double-click on free point to connect free points into polygon [#160575042]
- Fix drop on empty canvas [#160767277]
- Added teacher authentication [#160798757]
- Added QA mode [#160736716]
- Add/improve geometry tool unit tests [#160687622]
- Fixed learning log title wrapping [#160797339]
- Fixed missing 2-up button [#160826065]
- Fixed non-unique offerId per problem in dev mode [#160796641]
- Added non-javascript dialogs for alert/confirm/prompt [#160839797]
- Massive refactor of documents out of workspaces [#160896259]
- Fix group assumptions in createDocumentFromSectionDocument and createDocumentFromLearningLog [#160978892]
- Added groups to teacher dashboard [#160575177]
- Add "extraWorkspace"/"Extra Workspace" to section enumeration Replace Unicode escape for angle character ("&#x2220;") with UTF-8 angle character ("∠")
- Allow placing point at origin [#160993969]
- Move layout information from tiles to document content [#160937149] - introduce rows of tiles into layout - migrate legacy content - fix asset paths in developer builds [#160691920]
- Implement drag-reorder of tile rows [#160937149] - dragging row within a document reorders by default - dragging row between documents copies - dragging row within document with option key copies - cursor feedback indicates expected drop result
- Refactor element creation; add onCreate callback - set `hasInnerPoints` attribute to enable dragging of polygons [#161034052]
- Fix geometry resizing [#160688141] - fix geometry scaling in My Work and Learning Log thumbnails - maintain consistent grid size and tick spacing
- Support drag-resize of height of geometry tiles [#161129942] - tiles opt-in to user-resizability -- only geometry tool supports it for now - row can only be resized when all tiles within it support resize - fix computational error in geometry scaling calculations

## Version 0.0.3 - released September 12, 2018

- Added active section and active LL tab [#160284706]
- Genericize document model [#160175815] - add layout object to tiles to support arbitrary layout paradigms - update curriculum to match document model
- Added open workspace button [#160358488]
- Added demo mode [#160288085]
- Enable basic creation/editing of text tool objects in user documents [#159979476]
- Added content for "My Work" tab [#160359729]

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 11,863 bytes | 67.8% |
| index.js | 1,495,031 bytes | 30.1% |

## Version 0.0.2 - released September 5, 2018

- Refactor stores [#160188594] - moves `stores` into separate module - @inject stores into all components that need them
- Configure jest for unit tests instead of mocha/chai [#160203405]
- Added Firebase setup and authentication and start of schema document [#160170658]
- Initial steps towards a DocumentModel [#160175815]
- Implement JSXGraph spike [#159979530]
- Add problem title to document title [#160283247]

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 7,068 bytes | 0.04% |
| index.js | 1,149,144 bytes | 63.8% |

## Version 0.0.1 - released August 30, 2018

- Set up Travis CI and deploy to S3 [#160077604]
- Added basic component styling and animation [#159965961]
- Added canvas to workspace [#159979368]
- Curriculum/Investigation/Problem/Section models and problem url parameter [#159979340]
- Adding access for unauthenticated users [#159966202]

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 7,041 bytes | n/a |
| index.js | 703,783 bytes | n/a |

