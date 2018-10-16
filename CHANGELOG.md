# Changelog

## Version 0.0.5 - released October 16, 2018

- Spike: add image to geometry in curriculum [#161137053] - add support for images to geometry tool
- Support multiple tiles per row [#160634560] - drop tile at left or right edge of row (w/in 20px) to add tile to row - sized components (e.g. geometry tool) carry their size with them - deleting/removing a tile from a row resizes if there are no more sized components - tiles in row stretch to fill vertical height of row - drag handlers revert to using `clientY` rather than `pageY` since `pageY` reflects page scroll not element scroll
- Adjust default geometry tool height and grid size [#160864536]
- Image upload functionality (#105)
- Support dragging image tool to geometry to overlay image [#160604676] - image drop zone is central area more than 25 pixels from edge (to avoid conflict with tile drop zones) - only works for simple URLs (e.g. curriculum images) - no image upload support yet

### Asset Sizes

| File | Size | % Increase from 0.0.3 |
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

| File | Size | % Increase from Previous Release |
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

| File | Size | % Increase from Previous Release |
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

| File | Size | % Increase from Previous Release |
|---|---|---|
| index.css | 7,041 bytes | n/a |
| index.js | 703,783 bytes | n/a |

