# Changelog

## Version 3.1.0 - Oct 18, 2022

Version 3.1.0 contains quite a few individual tile improvements and bug fixes as well as some larger changes to allow generating and viewing the history of a document and more visibility of comments.

### Features/Improvements
History Playback feature:
- Work includes serialization, playback, auth, etc.
- [#183340035](https://www.pivotaltracker.com/story/show/183340035),[#182819773](https://www.pivotaltracker.com/story/show/182819773), [#182819773](https://www.pivotaltracker.com/story/show/182819773) #1423, [#183340035](https://www.pivotaltracker.com/story/show/183340035), [#183291286](https://www.pivotaltracker.com/story/show/183291286), [#183469204](https://www.pivotaltracker.com/story/show/183469204) 

Comments:
- Show all document and tile comments in a list
-  [#182565408](https://www.pivotaltracker.com/story/show/182565408), [#183182651](https://www.pivotaltracker.com/story/show/183182651), [#183455931](https://www.pivotaltracker.com/story/show/183455931) #1406, #1404 [#182565408](https://www.pivotaltracker.com/story/show/182565408), #1422 [#183182552](https://www.pivotaltracker.com/story/show/183182552), #1428 [#183447406](https://www.pivotaltracker.com/story/show/183447406), [#182565433](https://www.pivotaltracker.com/story/show/182565433)

Tiles:
- Delete Confirmation for Data tiles: #1391 [#183040970](https://www.pivotaltracker.com/story/show/183040970) [#182799776](https://www.pivotaltracker.com/story/show/182799776) [#183064080](https://www.pivotaltracker.com/story/show/183064080)
- Titles for Drawing tiles: #1392 [#182774317](https://www.pivotaltracker.com/story/show/182774317)
- Table text Wrapping: #1388 [#182601230](https://www.pivotaltracker.com/story/show/182601230), #1411, #1416, #1424
- Paste images from clipboard: #1399 [#182812871](https://www.pivotaltracker.com/story/show/182812871), #1405 [#183327120](https://www.pivotaltracker.com/story/show/183327120)
- Log text of text tiles:  #1396 [#182564260] (https://www.pivotaltracker.com/story/show/182564260)
- Colors for variable cards: #1403 [#181735790](https://www.pivotaltracker.com/story/show/181735790)
- Logging for data flow tool: #1419 [#183169893](https://www.pivotaltracker.com/story/show/183169893)
- Variable chip sizing: #1418[#182352893](https://www.pivotaltracker.com/story/show/182352893)
- Diagram tile toolbar: #1443

Other:
- Nav Panel open by default #1390 #1389 [#183081515](https://www.pivotaltracker.com/story/show/183081515)

Curriculum Enhancements:
- #1397 Bio4ArtNewStories
- #1410 Bio4 personal
- #1421 Stretching and Shrinking

### Bug Fixes
- Fix MST Issue with DataSets [#183523506](https://www.pivotaltracker.com/story/show/183523506)
- Reduce size of bundle [#183101883](https://www.pivotaltracker.com/story/show/183101883)
- Dataflow error handling #1412
- Slate bug fix #1414
- Delete keys captured when tile deleted [#183359479](https://www.pivotaltracker.com/story/show/183359479)
- Don't show File menu if My work doesn't exist #1427 [#183316063](https://www.pivotaltracker.com/story/show/183316063)
- Drawing selection bugs #1430 [#183235265](https://www.pivotaltracker.com/story/show/183235265), #1433 [#183457276](https://www.pivotaltracker.com/story/show/183457276)
- Handle corrupt documents #1432 [#183356700](https://www.pivotaltracker.com/story/show/183356700)
- MST dataset fixes [#183523506](https://www.pivotaltracker.com/story/show/183523506)

### Asset Sizes
|        File                                                                           |    Size   |
|---------------------------------------------------------------------------------------|-----------|
| vendor-main.2048c2e8.js                                                               |      2.1M |
| Geometry.2acdd728.js                                                                  |      886K |
| Dataflow.7b0fe82c.js                                                                  |      735K |
| common-Diagram-SharedVariables.ae94f7b3.js                                            |      611K |
| index.2f810b939d662c464cda.js                                                         |      397K |
| SharedVariables.e47d7d7d.js                                                           |       86K |
| Table.d5e285a4.js                                                                     |       84K |
| common-DataCard-Diagram-SharedVariables-Drawing-Geometry-Image-Table-Text.1c62df70.js |       51K |
| common-SharedVariables-Drawing.96107f60.js                                            |       33K |
| common-Dataflow-Geometry.0bd31c83.js                                                  |       26K |
| Drawing.f47d1726.js                                                                   |       26K |
| DataCard.797d1870.js                                                                  |       18K |
| Text.7e4ddd5d.js                                                                      |       16K |
| Image.a3400d7c.js                                                                     |       16K |
| Diagram.0ce29ffe.js                                                                   |      9.6K |
| Starter.b26bfa75.js                                                                   |      1.2K |
| SharedDataSet.98119794.js                                                             |      254B |

|        File                   |    Size   |
|-------------------------------|-----------|
| main.f4a598b6.css             |      162K |
| Dataflow.5351851e.css         |       32K |
| Diagram.d44044a2.css          |       11K |
| Table.779f3837.css            |       10K |
| Geometry.9119587f.css         |       10K |
| DataCard.4b49ee7d.css         |      8.4K |
| Image.b5870984.css            |      6.3K |
| Drawing.030947a3.css          |      5.2K |
| Text.32b9f6a4.css             |      4.5K |
| SharedVariables.427c48a1.css  |      696B |
| Starter.3c909986.css          |      207B |

## Version 3.0.0 - August 26, 2022

### Features/Improvements

Version 3.0.0 includes some major internal architecture changes to support some major new features like improved sharing of data between tiles, document-wide undo/redo and the ability to navigate the complete history of a user document. All of the new features aren't available in all contexts just yet, but they're on their way. In addition to these major architectural improvements, there are also some new tiles and a smattering of other new features and bug fixes.

Shared models and Undo/Redo/History Infrastructure
([#181033824] [#181745054] [#182203554] [#182203557] [#182346146] [#182402361] [#182551006] [#182459997] [#182460044] [#182326302] [#182326341] [#182941998])
(#1225 #1246 #1255 #1259 #1263 #1285 #1299 #1308 #1309 #1338 #1350 #1352 #1353 #1354 #1356 #1362 #1365 #1367 #1368 #1376)
- Drawing tile [#181207721] [#182203548] [#182237673] [#182460256] #1271 #1275 #1282 #1306 #1311 #1312
- Geometry tile [#182203544] [#182203548] [#182460232] #1291 #1319 #1340 #1358 #1370
- Image tile [#182460260] #1274 #1291 #1346
- Image map #1292 #1297 #1304
- Table tile [#182203552] #1319 #1340 #1357 #1364 #1377
- Text tile [#182028466] [#182460254] #1359

New Data Card tile #1361 #1380
([#182799755] [#182799758] [#182799768] [#182799773] [#182799754] [#182799764])

New Dataflow tile with grabber support
([#182197258] [#182265390] [#182459969] [#182460058] [#182460089] [#182488560] [#182835713] [#182773371])
(#1296 #1298 #1301 #1302 #1305 #1310 #1316 #1322 #1323 #1324 #1325 #1326 #1329 #1335 #1337 #1339 #1342 #1343 #1344 #1345 #1351)

Diagram View tile #1252 #1258 #1261 #1264 #1265 #1287
([#181214875] [#181611282] [#181616180] [#181628131] [#181645369] [#181671155])
Variable chips in text tiles [#181159095]  [#181315816] [#181611112] [#181671784] #1257
Variable chips in drawing tiles [#182054852] [#182055451] [#182054713] [#182056140] #1262 #1266 #1267 #1270 #1272 #1273

Enhanced unit/problem configuration options [#182942119] #1280 #1363 #1372
Allow hiding of My Work panel/browser [#182402091] #1281
Tile title improvements [#182589896] #1291 #1314
Logging improvements #1284
Improved teacher view of student groups work [#182429861] #1328
Teachers default view is workspace rather than references [#182812862] #1332
Improved workspace/reference divider [#182567472] #1331 #1373
Show multiple versions of published documents [#181363573] #1334 #1374
Upload image to drawing tile [#182774303] #1336

Curriculum Enhancements
- Bio4Community #1327 #1375
- Brainwaves #1320 #1341 #1347
- M2Studio #1294 #1375
- MothEd #1231 #1286 #1295 #1330 #1347 #1355
- Stretching and Shrinking #1366

### Known Issues

Table/geometry linking is not fully functional (yet)
Table expressions are not fully functional (yet)

### Bugs Fixed

Fix duplicate keys warning from redundant publication thumbnails (#1293)
Copy/paste/delete selection of images in text tile [#181315816]

### Asset Sizes

|        File                   |    Size   | % Change from Previous Release |
|-------------------------------|-----------|--------------------------------|
| cc.diagram-view.css           |     8,572 | +63.8%                         |
| cc.diagram-view.js            |   477,836 | - 3.0%                         |
| cc.react-components.js        |    58,847 | + 0.3%                         |
| cc.slate-editor.css           |     3,545 |                                |
| cc.slate-editor.js            |   437,392 | + 2.0%                         |
| main.css                      |   233,752 | +34.6%                         |
| main.js                       | 2,405,729 | +97.6%                         |
| vendor-main.css               |    16,584 | -93.6%                         |
| vendor-main.js                | 1,735,978 | + 3.1%                         |
| total .css w/o diagram view   |   253,881 | -41.4%                         |
| total .js w/o diagram view    | 4,647,805 | +17.0%                         |

## Version 2.2.0 (Internal Release) - April 3, 2022

### Features/Improvements
- Set Tiles/Plugins by Unit [#180424338](https://www.pivotaltracker.com/story/show/180424338)
- Refactor app, unit, investigation, problem configuration [#181034371](https://www.pivotaltracker.com/story/show/181034371) #1199
- Configurable Problem Tab [#181190677](https://www.pivotaltracker.com/story/show/181190677)
- Updated text tile icons [#181363539](https://www.pivotaltracker.com/story/show/181363539) #1223
- Teacher support docs and regular published docs moved to "Teacher Documents" section in My Class tab. [#180635406](https://www.pivotaltracker.com/story/show/180635406) [#181364663](https://www.pivotaltracker.com/story/show/181364663)
- Teachers choose where to publish supports "just this class" or "all my classes" [#181364692](https://www.pivotaltracker.com/story/show/181364692) #1233
- Each publish shows a new document and users can "soft" delete their own published documents [#181363573](https://www.pivotaltracker.com/story/show/181363573)
- Text Toolbar can be customized by the author: [#181345429](https://www.pivotaltracker.com/story/show/181345429)
- New Diagram tool, only loaded when configured [#181175873](https://www.pivotaltracker.com/story/show/181175873) [#181214875](https://www.pivotaltracker.com/story/show/181214875)
- Dynamic Tile loading, javascript is now broken up into several files [#181214875](https://www.pivotaltracker.com/story/show/181214875)
- M2Studio configurations [#181193209](https://www.pivotaltracker.com/story/show/181193209)
- Remove 'editability' icon/badge from document canvas
- Add "destroy..." option to the file menu when the appMode is "dev"
- Ability to automatically assign students to groups
- Simplify the `tile` and `id` properties of tile info to just an `id`
- Improved typescript typing of ToolContentModel

### Bugs Fixed
- Table expression parse errors [#181360571](https://www.pivotaltracker.com/story/show/181360571)

### Asset Sizes

|        File                     |    Size   | % Change from Previous Release |
|---------------------------------|-----------|--------------------------------|
| cc.diagram-view.a1906313.css    |     5,233 |                                |
| cc.diagram-view.a1906313.js     |   492,381 |                                |
| cc.jsxgraph.70963f6e.js         |   583,971 |                                |
| cc.react-components.c414cd1e.js |    58,695 |                                |
| cc.slate-editor.c2cc7fb9.js     |   428,891 |                                |
| main.c0daccfe.css               |   173,696 | -60% compared to index.css     |
| main.c0daccfe.js                | 1,217,226 | -70% compared to index.js      |
| vendor-main.544d75c3.css        |   259,910 |                                |
| vendor-main.544d75c3.js         | 1,683,173 |                                |
| total .js w/o diagram view      | 3,971,956 | -1.7% compared to index.hs     |
| total .css w/o diagram view     |   433,606 | 0.1% compared to index.css     |

## Version 2.1.3 - released February 22, 2022

### Features/Improvements
- Stretching and Shrinking content updates #1214
- Moving Straight Ahead content updates #1214 #1216
- Section information, time zone and activityUrl are now logged [179924865] [180680837] [#180680858] #1179 #1183 #1191
- Improved captions of network documents [#180876987] [#181124146] #1185 #1189 #1197
- Improved network status logging #1201
- Improved drag preview image [180876905] #1205

### Bugs Fixed
- Geometry: handle axis bounds changes more efficiently #1165
- Geometry: Adjust X axis bounds to leave room for Y axis labels [#180817314] #1166
- Table: Handle expression evaluation exceptions #1168
- Fixed bug which could result in showing the wrong teacher guide #1169 #1170
- Fixed promise-handling bug in creation of planning documents [#181124054] #1187
- Fixed display and copy of images in published supports [#180873340] [#181147217] #1174 #1175 #1176 #1180 #1190
- Fixed display of images for networked teachers #1195
- Limit of one returned problem/planning document #1196
- Fixed bugs that could result in documents not saving #1200
- Fixed unread supports indicator #1203
- Fixed drag of unselected tiles [181260137] #1206
- Fixed bug in dragging tiles from curriculum content #1208

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 433,155 bytes | -0.2% |
| index.js | 4,043,774 bytes | 0.2% |

## Version 2.1.2 - released January 5, 2022

### Bugs Fixed
- Fix sub-tab colors [#180731966] #1158
- Fix divider click behavior [#180731992] #1159
- Text: Fix bugs with multiple editor instances on a page [#180648279]
- Geometry: fix axis dialog contention [#180769939] #1161
- Geometry: Fix axis ticks crash [#180805779] #1162

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 433,814 bytes | 3.0% |
| index.js | 4,035,502 bytes | 0.1% |

## Version 2.1.1 - released December 13, 2021

### Bugs Fixed
- Fixed bug which could prevent some documents from saving correctly in some circumstances #1148
- Other stability improvements #1147

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 420,985 bytes | 0.0% |
| index.js | 4,032,012 bytes | 0.0% |

## Version 2.1.0 - released December 8, 2021

### Features/Improvements
- Comparing and Scaling content updates and new teacher guide #1133
- Stretching and Shrinking content updates #1133
- Under-the-hood: update dependencies #1100 #1128 #1129 #1131 #1137
- Under-the-hood: refactor tool code #1113 #1115 #1118 #1125 #1127

### Bugs Fixed
- Show planning document title in Resources [#180463778] #1130
- Show "Network User" for caption of published documents viewed via teacher network [#180484449] #1130
- Extra points on a graph are created on duplication of a figure created from a linked table [#180496888] #1132
- Don't log in demo mode [#180522053] #1134
- Deserialize document content rather than recreating it #1138
- Eliminate redundant loading of local document contents #1139
- Only load teacher guide content for teachers #1141
- Fix height of multi-tile rows with image tiles #1143

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 420,985 bytes | -3.9% |
| index.js | 4,029,162 bytes | -3.3% |

## Version 2.0.0 - released November 2, 2021

### Features/Improvements
- Resources/Workspace sections can be expanded to use all available space [#178762398] [#178762390]
- Improved styling in resources section [#178797434] [#178952901]
- New planning document for each problem for teachers [#178762434] [#179427590]
- Networked teachers can
  - view list of their own and other teachers' classes in the network [#179154344] [#179185017] [#179755300]
  - view teacher documents in their own and other teachers' classes in the network [#179154370] [#178762441] [#179346951] [#179154386]
  - view published student documents in their own and other teachers' classes in the network [#179154370] [#179298013] [#178762452] [#179154386]
  - comment on their own and other teachers' documents in the network [#178762407] [#178762418] [#179652167]
  - comment on curriculum materials with others teachers in the network [#179346905] [#179361057]
  - comment on individual tiles of curriculum materials or teachers' documents in the network [#179458436] [#178762420]
  - delete their own comments from comment threads [#179599780]

### Bugs Fixed
- Preview launch from portal works as expected [#179152641]
- Drag preview image when dragging tiles is now a thumbnail image of appropriate size [#179030964]
- Non-production versions of CLUE log to staging log server [#179924872]

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 438,136 bytes | -3.1% |
| index.js | 4,167,820 bytes | -13.3% |

## Version 2.0.0-pre.1 - released October 8, 2021

### Features/Improvements
- Networked teachers can view list of other teachers' classes in the network
- Networked teachers can view documents in other teachers' classes in the network
- Networked teachers can comment on their own and other teachers' documents in the network
- ...
- More details with the official 2.0.0 release

### Bugs Fixed
- Will be listed with the official 2.0.0 release

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 452,138 bytes | 8.3% |
| index.js | 4,806,669 bytes | 1.7% |

## Version 1.9.0 - released July 7, 2021

### Features/Improvements
- Add confirmation dialog for tile deletion [#177614012] (#968)
- Drawing tile JSON export [#178336893] (#976)
- Geometry tile JSON export [#176874271] (#973)
- Geometry tile comments JSON export [#178324795] (#977)
- Image tile JSON export [#176874262] (#975)
- Document JSON export [#176874236] (#978)
- Update dependencies (#979) (#981)

### Bugs Fixed
- Don't show link button when linking is disabled (#970)
- Fix tooltips for superscript/subscript in text toolbar [#178148677] (#971)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 417,598 bytes | 6.7% |
| index.js | 4,728,056 bytes | 3.0% |

## Version 1.8.4 - released May 17, 2021

### Features/Improvements
- Log presentation of network status alerts [#178163876] (#967)

### Bugs Fixed
- Validate students in teacher dashboard [#178165267] (#964)
- Don't log DELETE_TILE when specified tile doesn't exist [#178162887] (#965)
- Geometry: Update toolbar on selection change [#178148390] [#178166203] (#966)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 391,321 bytes | 0.0% |
| index.js | 4,588,222 bytes | 0.0% |

## Version 1.8.3 - released May 10, 2021

### Features/Improvements
- Fix handling of table formulas referencing column names with spaces [#178097891] (#959)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 391,321 bytes | 0.0% |
| index.js | 4,587,947 bytes | 0.0% |

## Version 1.8.2 - released April 1, 2021

### Features/Improvements
- Network status monitoring/alerting (#953)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 391,321 bytes | 0.1% |
| index.js | 4,587,574 bytes | 0.0% |

## Version 1.8.1 - released March 31, 2021

### Features/Improvements
- Additional logging improvements (#951)

### Bugs Fixed
- Geometry: Fix click on Y axis label (#950)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 390,895 bytes | 0.0% |
| index.js | 4,586,117 bytes | 0.0% |

## Version 1.8.0 - released March 30, 2021

### Features/Improvements
- Geometry: link/unlink table using dialog [#174765829](https://www.pivotaltracker.com/story/show/174765829) (#942)
- Geometry: add label line tool to toolbar [#175618736](https://www.pivotaltracker.com/story/show/175618736) (#940)
- Geometry: default axes accommodate larger Y values [#177087799](https://www.pivotaltracker.com/story/show/177087799) (#941)
- Table: unlink graph using link/unlink dialog [#176834983](https://www.pivotaltracker.com/story/show/176834983) (#933)
- Table: import/export improvements [#176874316](https://www.pivotaltracker.com/story/show/176874316) (#936)
- Can resize tile heights from corner of tile [#175081175](https://www.pivotaltracker.com/story/show/175081175) (#938)
- Switch to GitHub Actions for CI builds and deployment (#948)

### Bugs Fixed
- Fix table/graph title incrementing [#177273772](https://www.pivotaltracker.com/story/show/177273772) (#939)
- Support for images copied from multi-class supports [#175500575](https://www.pivotaltracker.com/story/show/175500575) (#944)
- Deleted workspace is removed from navigation [#176756250](https://www.pivotaltracker.com/story/show/176756250) (#934)
- Add logging of monitoring/unmonitoring user documents (#943)
- Add logging of document change counts (#947)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 390,726 bytes | 0.3% |
| index.js | 4,585,489 bytes | 0.2% |

## Version 1.7.0 - released February 26, 2021

### Features/Improvements
- Additional Moving Straight Ahead Teacher Content
- Uses @concord-consortium/slate-editor library
- Update `browserslist` configuration

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 389,494 bytes | 0.0% |
| index.js | 4,574,452 bytes | 10.3% |

## Version 1.6.0 - released February 7, 2021

### Features/Improvements
- New Table design supports multiple columns
- Graph tile supports linking multi-column tables
- Teacher-only curriculum content (solutions)
- Support for separate teacher guide content
- Smaller bundle size

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 389,427 bytes | -22.5% |
| index.js | 4,148,062 bytes | -16.4% |

## Version 1.5.4 - released January 12, 2021

### Features/Improvements
- Content updates (Comparing and Scaling)

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,372 bytes | 0.0% |
| index.js | 4,964,293 bytes | 0.0% |

## Version 1.5.3 - released December 16, 2020

### Features/Improvements
- Content updates

### Bugs Fixed
- Fixed teacher class switcher menu

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,372 bytes | 0.0% |
| index.js | 4,964,293 bytes | 0.0% |

## Version 1.5.2 - released December 1, 2020

### Features/Improvements
- Draw toolbar styling improvements
- Content updates

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,372 bytes | -2.9% |
| index.js | 4,964,769 bytes | 0.3% |

## Version 1.5.1 - released November 8, 2020

### Bugs Fixed
- Fix text toolbar initial location bug

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 517,550 bytes | 0.0% |
| index.js | 4,950,629 bytes | 0.0% |

## Version 1.5.0 - released November 7, 2020

### Features/Improvements
- Combined Problem and Extra Workspaces under single Workspaces tab
- Text, Drawing, Geometry, and Image tools have "floating" toolbars that show only when the tile is selected
- Improved appearance of teacher's publish support icon
- Teacher's problem menu shows problem subtitles
- Teacher's class menu handles multiple assignments of the same problem

### Bugs Fixed
- Fixed drawing tool update bug
- Fixed display of images in cross-class teacher supports
- Dragging a tile selects the tile first
- Student names/initials are now more legible

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 517,550 bytes | 2.5% |
| index.js | 4,950,264 bytes | 1.3% |

## Version 1.4.1 - released October 13, 2020

### Features/Improvements
- Edit button in document title bar
- Supports tab defaults to Teacher Supports subtab

### Bugs Fixed
- Fix publishing teacher supports to multiple classes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 505,055 bytes | 0.2% |
| index.js | 4,888,343 bytes | 0.0% |

## Version 1.4.0 - released October 7, 2020

### Features/Improvements
- New curriculum content
- Show tile drag border and drag icon on hover
- Tile drag border color reflects editability
- Add new teacher supports indicator badge

### Bugs Fixed
- Fix File menu rendering issue
- Fix text tile selection in curriculum content
- Fix bug which prevented dragging multiple tiles from curriculum content
- Fix table/geometry link icon appearance

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 503,854 bytes | -0.4% |
| index.js | 4,887,087 bytes | -1.3% |

## Version 1.3.1 - released September 21, 2020

### Bugs Fixed
- Document browser opens to section of current document initially
- Current document is highlighted in document browser
- Show full name when hovering over initials in four-up view
- Fix issues with class/problem menus in teacher dashboard

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 505,932 bytes | 0.1% |
| index.js | 4,950,977 bytes | 0.0% |

## Version 1.3.0 - released September 15, 2020

### Features
- Enhanced workspace navigation
- Curriculum content can now be viewed side-by-side with user workspace
- Reference/comparison workspace always to left of user workspace
- New File menu on user workspace
- Simplified teacher dashboard interface
- New curriculum modules
- Improved logging

### Bugs Fixed
- Teachers starring documents now works as expected

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 505,656 bytes | 0.6% |
| index.js | 4,952,616 bytes | 0.6% |

## Version 1.2.2 - released August 28, 2020

- More informative message upon publishing a teacher support
- Improved image tile auto-sizing

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,710 bytes | 0.0% |
| index.js | 4,921,173 bytes | 0.0% |

## Version 1.2.1 - released August 25, 2020

- Fix bug which affected class visibility of some teacher supports

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,710 bytes | 0.0% |
| index.js | 4,921,038 bytes | 0.0% |

## Version 1.2.0 - released August 24, 2020

- Teacher supports visible across multiple classes
- New 8th grade curriculum units
- Improved image tile auto-sizing
- Fix bug which could result in lost work

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,710 bytes | -3.0% |
| index.js | 4,920,924 bytes | 18.8% |

## Version 1.1.2 - released March 12, 2020

- MSA tables format numbers to two decimal places
- Add infrastructure for authorable settings

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 518,038 bytes | 0.0% |
| index.js | 4,142,635 bytes | 0.1% |

## Version 1.1.1 - released February 19, 2020

- Log user role
- Fix tile drags to existing row
- Fix table selection bug
- Fix geometry drag bug
- Fix representation of linked points in group view
- Prevent tile drop on section headers
- Limit tile drags to a single source

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 518,038 bytes | 0.0% |
| index.js | 4,137,028 bytes | 0.0% |

## Version 1.1.0 - released February 10, 2020

- User-editable table title row
- User axis annotations
- Fix tile drags from curriculum
- Fix drawing tool stamps
- Fix preview button launch from portal
- Update dependencies

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 518,038 bytes | 3.5% |
| index.js | 4,136,179 bytes | -6.0% |

## Version 1.1.0-pre.1 - released January 30, 2020

- Moving Straight Ahead content changes
- Allow author- and user-setting of axis labels
- Make movable line comment authorable
- Support sequential link colors for linked tables/geometries
- Limit polygons to points from a single table (or no table)
- Order documents from newest to oldest
- Add confirmation dialog before publishing
- Put up dialog on authentication error which redirects back to portal
- Support portal launch via Preview button
- Dependency updates

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 500,384 bytes | -0.3% |
| index.js | 4,398,158 bytes | 0.5% |

## Version 1.0.3 - released December 12, 2019

- Bug fixes
- Dependency updates

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 502,376 bytes | 0.5% |
| index.js | 4,376,662 bytes | 0.2% |

## Version 1.0.2 - released November 22, 2019

- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 499,791 bytes | 0.0% |
| index.js | 4,365,952 bytes | 0.0% |

## Version 1.0.1 - released November 20, 2019

- Improved teacher dashboard logging
- Curriculum content updates

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 499,791 bytes | 0.0% |
| index.js | 4,365,755 bytes | 0.0% |

## Version 1.0.0 - released November 19, 2019

- Document supports selection of multiple tiles
- Drag/drop multiple tiles in document
- Teacher can publish document as support
- Teacher dashboard styling improvements
- Teacher can send "sticky notes" to individual students/groups

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 499,791 bytes | 1.8% |
| index.js | 4,365,192 bytes | 2.2% |

## Version 0.10.0 - released November 8, 2019

- Support linked selection for linked geometry/table points
- Add table menu item to unlink table from geometry tiles
- Styles toolbar in text tool
- Support labeling of polygon edges
- Investigation 0 tutorial content
- Numerous bug-fixes and minor enhancements

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 490,734 bytes | 11.8% |
| index.js | 4,271,431 bytes | 1.0% |

## Version 0.9.0 - released October 30, 2019

- Workspace documents for each problem have separate sections with section headers
- Improved tile placement heuristic for documents with sections
- Teacher dashboard shows student progress through sections
- Styled text in authored curriculum content
- Stretching & Shrinking curriculum updates
- Auto-size table columns on column label changes
- Auto-scale geometry tile axes when a table is linked
- Request taller geometry row on image drag if necessary
- Geometry: arrow keys nudge selected points
- Linked geometry/table icons

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 439,006 bytes | 4.1% |
| index.js | 4,229,500 bytes | 2.5% |

## Version 0.8.0 - released October 23, 2019

- User documents associated with problems rather than sections
- Users can create personal document workspaces
- Users can rename/delete personal documents and learning logs
- Teacher dashboard
- Teacher switch classes & problems
- Teacher workspace
- Rich-content supports
- Support Dataflow application

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 421,764 bytes | -15% |
| index.js | 4,124,348 bytes | 2% |

## Version 0.7.1 - released May 29, 2019

- Fixes listeners on loading empty document causing data loss
- Adds movable equation labels to movable lines

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 496,642 bytes | 0% |
| index.js | 4,046,632 bytes | 0% |

## Version 0.7.0 - released May 22, 2019

- Adds teacher document starring
- #166111125: fixes line slope and intercept setting
- Dependency and security updates

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 496,642 bytes | 2.1% |
| index.js | 4,046,310 bytes | 0.8% |

## Version 0.6.0 - released March 27, 2019

- Table equations + data generation!
- Add space for expanding bottom tiles
- Update dependencies

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 486,507 bytes | 1.9% |
| index.js | 4,012,778 bytes | 2.2% |

## Version 0.5.2 - released March 15, 2019

- Geometry bug fixes
  - Fix axis labels after rescaling
  - Fix axis handlers on reload/undo
  - Fix invalid default axis bounds
  - Fix incorrect grid lines after undo
  - Fix accidental delete on dialog backspace
- Add table scrolling
- Rollbar fixes + error aggregation

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 477,365 bytes | 0.1% |
| index.js | 3,926,468 bytes | 0.7% |

## Version 0.5.1 - released February 28, 2019

- Log table changes
- More cypress test coverage
- Bug fixes

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 476,805 bytes | 0.0% |
| index.js | 3,899,990 bytes | 0.0% |

## Version 0.5.0 - released February 25, 2019

- Curriculum
  - Moving Straight Ahead unit
- Geometry Tool
  - Features
    - Toolbar
    - Movable line
    - Undo/redo
    - Link Tables to Geometry
    - Import schema for authoring
    - Comment objects
    - Axis scaling
  - Bugs
    - Fix polygon vertex deletion
    - Fix polygon rotation bug
    - Fix polygon copy bug
    - Fix snap behavior of copied points
    - Fix bugs with polygons created from linked points
- Table Tool
  - Features
    - Link Tables to Geometry
    - Copy/paste table rows

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 476,805 bytes | 0.3% |
| index.js | 3,897,231 bytes | 0.2% |

## Version 0.4.0 - released January 28, 2019

- Teacher: group- and user-specific supports by section
- Document workspace
  - Highlight new tile location on toolbar hover
  - Drag from toolbar to place new tiles
  - Class Work and Class Logs tabs
    - Class Work tab contents grouped by section
    - fix scrolling bug
    - performance improvements
- Table: initial tool implementation
- Drawing
  - add stamp tool with curriculum-defined stamps
  - add stamps for Moving Straight Ahead curriculum
  - user actions are logged
- Geometry
  - points snap to 0.1 grid (was 0.2)
  - add graph axis labels
  - user actions are logged
  - improve layered selection
  - fix "updateText()" Rollbar error

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 468,424 bytes | 1.8% |
| index.js | 3,856,819 bytes | 0.9% |

## Version 0.3.0 - released January 11, 2019

- Feature: Teacher-authored class-wide supports
- Geometry: Fix overlapping polygon edge selection
- Geometry: Fix selection when switching between views
- Internal: add app version, user id, role, class, problem, etc. to Rollbar error reports
- Internal: configure Travis to automatically register deploys with Rollbar

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 319,536 bytes | 0.3% |
| index.js | 2,945,232 bytes | 0.2% |

## Version 0.2.2 - released January 7, 2019

- Geometry: Improve initialization performance

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 318,477 bytes | 0.0% |
| index.js | 2,938,753 bytes | 0.0% |

## Version 0.2.1 - released January 6, 2019

- Geometry: Fix polygon edge drag bug
- Internal: Add support for multiple units
- Internal: Enable source maps on production for debugging/profiling
- Internal: Update development dependency to eliminate security warning

### Asset Sizes

| File | Size | % Change from Previous Release |
|---|---|---|
| index.css | 318,477 bytes | 0.0% |
| index.js | 2,938,530 bytes | 0.1% |

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
