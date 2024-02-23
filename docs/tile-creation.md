# Tile creation

How do tiles get into the document? There are several ways.

```mermaid
flowchart TD
%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%

BDCaddTileContentInNewRow[["addTileContentInNewRow\n(base-document-content.ts)\ninserts into tileMap"]]

BDCaddTileSnapshotInExistingRow[["addTileSnapshotInExistingRow\n(base-document-content.ts)\ninserts into tileMap"]]

toolbarClick{{"Toolbar button clicked"}}
TBhandleAddTile("handleAddTile\n(toolbar.tsx)\nsets unique title")
DaddTile("addTile\n(document.ts)")
BDCuserAddTile("userAddTile\n(base-document-content.ts)***")
BDCaddTile("addTile\n(base-document-content.ts)")

toolbarClick --> TBhandleAddTile --> DaddTile --> BDCuserAddTile --> BDCaddTile --> BDCaddTileContentInNewRow

toolbarDrag{{"Toolbar button drag"}}
ThandleDragNewTile("On drag:\nhandleDragNewTile\n(toolbar.tsx)\nsets unique title")
DChandleDrop("On drop:\nhandleDrop\n(document-content.ts)")
DChandleInsertNewTile("handleInsertNewTile\n(document-content.ts)")

toolbarDrag --> ThandleDragNewTile -- (dragging) --> DChandleDrop --> DChandleInsertNewTile --> BDCuserAddTile

toolbarDuplicate{{Toolbar duplicate button}}
ThandleDuplicate("handleDuplicate\n(toolbar.tsx)")
DCduplicateTiles("duplicateTiles\n(document-content.ts)")
DCcopyTiles("copyTiles\n(document-content.ts)")
updateDefaultTileTitle("updateDefaultTileTitle\n(document-content.ts)")
BDCcopyTilesIntoNewRows("copyTilesIntoNewRows\n(base-document-content.ts)\ncopies titles")

toolbarDuplicate --> ThandleDuplicate --> DCduplicateTiles --> DCcopyTiles
BDCcopyTilesIntoNewRows --> BDCaddTileContentInNewRow
DCcopyTiles --> updateDefaultTileTitle

tableIt{{"Table It! and other\nview-as buttons"}}
useConsumerTileLinking("useConsumerTileLinking")
DCaddTileAfter("addTileAfter\n(document-content.ts)")

tableIt --> useConsumerTileLinking --> DCaddTileAfter --> BDCuserAddTile

placeholder{{"Create placeholder tile"}}
BDCaddPlaceholderTile("addPlaceholderTile\n(base-document-content.ts)")
placeholder --> BDCaddPlaceholderTile --> BDCaddTileContentInNewRow

dragImage{{"Drag & Drop image"}}
DWhandleImageDrop("handleImageDrop\n(document-workspace.tsx)")
dragImage --> DWhandleImageDrop --> BDCuserAddTile

dragTile{{"Drag & Drop tile\nfrom other doc"}}
DChandleDrop("handleDrop\n(document-content.ts)")
DChandleCopyTilesDrop("handleCopyTilesDrop\n(document-content.ts)")
DChandleDragCopyTiles("handleDragCopyTiles\n(document-content.ts)")
BDCuserCopyTiles("userCopyTiles\n(base-document-content.ts)***")
BDCcopyTilesIntoExistingRow("copyTilesIntoExistingRow\n(base-document-content.ts)")

dragTile --> DChandleDrop --> DChandleCopyTilesDrop --> DChandleDragCopyTiles --> DCcopyTiles --> BDCuserCopyTiles --> BDCcopyTilesIntoNewRows & BDCcopyTilesIntoExistingRow --> BDCaddTileSnapshotInExistingRow

style toolbarClick fill:#888
style toolbarDrag fill:#888
style toolbarDuplicate fill:#888
style dragImage fill:#888
style dragTile fill:#888
style tableIt fill:#888
style placeholder fill:#888

```

Notes:

\* Uses a tile-insertion function specified by caller as a parameter. This parameter is shown by the "(param)" link in the diagram.

\** Probably should specify userCopyTiles too, for logging

\*** Logs event
