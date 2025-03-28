We are trying to make CLUE into a framework that can be used by several different projects. Here is a list of things that would be useful to change to support that. Some are more important than others, so a future exercise is to define some criteria and rank them.

# Tool coupling in the core code

## Direct references to tool models in the core code

Almost done with the obvious places where there are lists of each tool type.

## Image drag handling

The image tool is assumed to be able to handle image drops in the canvas. This currently means an extra url field being passed to all tool creation functions: `defaultContent`. That will be confusing for a new tool author. It also means the Image tool is basically always required. This tool is pretty lightweight so that might not be problem.

## Tool configuration at various levels

Currently the `unit` is passed to all `defaultContent` functions. This allow the drawing tool to get the set of default stamps defined on the `unit`.

This type of configuration is also done with the ability to disable the linking tables to graphs feature.

This ability for a tool to be configured by settings at the application, unit, problem, or document level could be a generic feature of the framework.  Then instead of passing the `unit` to defaultContent, the tool content model could read these settings from a store, or perhaps the MST `env`. If these settings were not "typed" by the core, then new tools can use this settings area without changing the core.

## Title Handling

Currently the Geometry and Table tools use a `title` passed to them by the CLUE core. Other tools ignore this. It might be better to move this field to the ToolTileModel. This way an outline view of the document could be shown and the title of each of the tiles could be used in the outline.

If this was moved ToolTileModel it could still be passed into the tool component as a property so it would be up to the tool component to render it in the most appropriate way.

## Geometry Tool references

The table tool, references the Geometry tool with the `getGeometryContent` function. Refactoring this will likely require a new state sharing system so tiles can coordinate to show the same state without being coupled to each other. That should have its own section in this document.

From a coupling point of view, the Geometry tool is one of the largest tools and we have some potential projects that would not need this tool. These projects do probably need the Table tool. So de-coupling these will reduce the size of the main module.

# Built Available Tools

Some tools are large. For example the geometry tool and text tools are pretty large. And the DataFlow tool which wasn't merged into master is even larger. To counteract this it is best if the application can define which tools it needs and only these tools are built into the bundle.

The decoupling of the tools from the core is a big step towards this. Then the next step is to find a way to use Webpack to configure which tools get included in the bundle. We could have different top level index files for each application which import the core and then import the tools the application needs.

# Dynamically Loaded Tools

Having to build separate applications for each configuration of tools won't be very sustainable if we have many different configurations we need. If the tool code can be downloaded only if it is needed by a unit, then the same application can handle all configurations.

Using Webpack code splitting it should be possible to split each tool's code into its own output file. And then using dynamic imports `import(...)` with a unit level configuration file would make it possible to start out download just the core code, parse the unit level configuration file, and start loading the required tools.

This might improve the current loading speed even if all of the current tools are still loaded. The initial bundle should be pretty small so the application can come up and provide a useful loading message. Then in the background it will be downloading the tool bundles.

# Sharing State between Tools

To support rich interactions between tiles there needs to be a good way to share data between two or more tiles. The current sharing of data between the table and geometry tool is not extensible.

The kind of solution that seems more extensible is to have something like a virtual tile that doesn't have a visible representation in the document. And then other tiles can display data from this virtual tile. It might be possible for one real tile to display data from multiple virtual tiles.

The complication is how to handle copying tiles from document to document. This is a key feature of CLUE. And a user can grab just one tile and copy it. If they grab a table that is displaying data from a shared virtual tile, then there could be a couple of options:
- make the new tile and merge the shared data into the new tile. This way the new tile is completely self contained.
- copy the visible tile and copy the virtual tile into the new document. 

Then it gets more complicate if the user now copies another tile from the source document which was also connected to the virtual tile. A few options:
- copy the second tile in a separated way so now the two tiles are no longer connected in the new document. This seems less than ideal since it seems likely that a user would expect them to continue to be connected.
- copy the second tile and look for the copy of the virtual tile in the new document, then reconnect the second tile copy. If the user has manipulated the first tile copy in the meantime, this could get confusing.

An alternative is to expose these virtual tiles and connections more explicitly. So when copying a tile the user could see that is connected to another tile in some way and decide what they want to do when they copy it.

Another aspect of this is that the data being shared might not just a table. It might be a rich state with objects and arrays.

Another part of this is how to work efficiently with large datasets. A proposal for this before was to use something like GraphQL to watch a shared dataset. This would allow any tiles viewing this dataset to define a query of the dataset so they wouldn't have to be notified of every dataset change, just the changes that update their query. This has the added benefit of allowing the dataset to be a remote or local and in both cases the tile works with GraphQL.

**TODO:** What is the UX in CLUE Currently?

# Improved Drag and Drop

The HTML5 based drag and drop doesn't support thumbnail images the way that CLUE needs. It also is hard to write 

# Updated tool state model

It seems possible to both simplify what tools need to do to save their state and at the same time support recording all document changes. This would make it possible to replay how a student change the document, support a document level undo mechanism, and also pass state around as a list of changes like is currently done in several tools.

The key change is to leverage MST to record these changes. This way a tool can just modify a simple state representation using MST actions. In the background MST records these changes at the document level. There are examples of using MST for undo redo which are built using JSON diffs and also include support for grouping changes together so an undo makes sense.

# Switch to Firestore

CLUE currently uses firebase realtime database. This has limitations because it doesn't support queries. And the rule based security language is more limited.

Our newer projects use Firestore, so it would be best if CLUE used it too.

# Efficient attachment support

Currently images are stored in the firesore realtime database. This isn't very efficient because they can't be downloaded directly by the browser by passing a URL to an element. Javascript has to download the image and then make a blob URL out of it so it can be rendered. 

Also with the switch to firestore this time of storage in the database would be limited to sizes of 1MB. In LARA we switched to storing these files in S3 and using the token-service for authorization to read and write these files.

# Make a document only application

This would be useful for testing out tools without bringing in all of the other CLUE features. It could also be used for real as a way to create and share documents in other systems like google drive.

# Simplify the way Tiles use MST and React

Currently tiles have a pretty complex way of working as functional components. They require a lot of `useRef` and `useEffect` hooks. I think this could be simplified by using MST more within the tiles instead of creating and passing around lists of callbacks.

