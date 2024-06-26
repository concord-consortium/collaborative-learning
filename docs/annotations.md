# Annotations

Annotations are a way for students (and possibly teachers or CLUE itself in the future) to add additional information to their documents. Annotations are tile independent, so they can be added to anything within CLUE that has been properly set up, and can even span between multiple tiles.

## Types of Annotations

Currently there is just a single type of annotation, the student proportional arrow, or sparrow. In the future, there could be many different types of annotations, such as comments on a single object, circles for emphasis, Xs to indicate mistakes, etc.

### Sparrows

Student proportional arrows, more commonly called sparrows, connect two objects with an arrow and a text box. One of the objects is the source, which has the tail end of the arrow, and the other is the target, which gets the arrowhead. The text box can be moved around and defines the curve of the arrow.

## Setting up Tiles to use Annotations

Each tile must be set up to define which objects within it can be annotated.

### CLUE Objects

Annotations can be connected to anything set up as a CLUE Object. These can be anything within a tile, and tiles themselves are in charge of interpreting what they are. A CLUE Object is defined by three pieces of information:

- tileId: This is the actual id of the tile containing the object.
- objectId: This is a unique way to identify the object from the tile's perspective. This will often be the object's actual id, but it doesn't need to be. For example, cells in table tiles have no ids, so the objectId of a cell is a string that contains the cell's case and attribute ids.
- objectType: This optional string can help tiles interpret the objectId. For example, the geometry tile allows annotations to be attached to several different types of objects (points, segments, polygons), and the objectType field helps the geometry tile know where to look for the object.

### Tile Model Modifications

To set a tile up with annotations, its content model must have a `get annotatableObjects` view. This function should return an array of all the tile's objects (see CLUE Objects above) that can have an annotation attached. This array is used to create buttons that attach annotations when the user enters annotation mode.

### Tile Component Modifications

Setting up a tile with annotations also requires defining one function, `getObjectBoundingBox` in the `tileApi`. Additionally, there are two optional functions that can be defined in the `tileApi` to customize how annotations work with the tile.

#### `getObjectBoundingBox` (required)

This function takes an `objectId` and optional `objectType`, and should return a dictionary containing the bounds for the specified object like `{ height, left, top, width }`. These values should be numbers representing pixels and should be relative to the tile. The CLUE Object's `tileId` will be used to determine which tile's `getObjectBoundingBox` is called, and the `AnnotationLayer` (see below) will offset the returned values to position it in the tile within the document. A few notes about this function:

- The returned values will be used to position annotations attached to the CLUE Object.
- The returned values are also used for the object's default annotation button (see `getObjectButtonSVG` below).
- The returned values are also used to bound the annotation's position with respect to the object. It would be better if `getObjectButtonSVG` defined these bounds, but that would require more challenging math to handle arbitrary shapes instead of simple rectangles.
- Tiles can determine the returned values however they see fit. Some might use the model, some might use DOM elements, and some might use 3rd party libraries (like `d3`) that underlie the tile's rendering.
- Even if a tile does not use the model to determine the return values, it still might need to reference the model in the function to make it reactive so that the corresponding component updates when an object's position changes.

#### `getObjectButtonSVG` (optional)

Each object gets an "annotation button" that allows the user to add an annotation to it when in annotation mode. By default, the button is a rectangle defined by the object's bounding box (see `getObjectBoundingBox` above). However, a tile can define `getObjectButtonSVG` to give an object a custom annotation button, e.g. a circular button for round objects. This function takes an object as an argument (defined below) and should return an svg element which will be used as the object's button. If the function is not defined or returns undefined for a particular object, the object's bounding box will be used for its button. The parameter object contains the following members:

- `classes`: This string should be used as the `className` for the svg button to apply the correct button styling to the element. If you want custom styling for the button, you can add additional classes as well.
- `handleClick`: This function should be used as the `onClick` for the svg button.
- `objectId`: The object's id. It's up to the tile to interpret this.
- `objectType`: This optional string can be used to help the tile properly interpret the `objectId`.

#### `getObjectDefaultOffsets` (optional)

By default, annotations are attached to the center of a target object. Defining this function allows the default position of the annotation anchor to be adjusted based on the obect. The function takes the usual `objectId` and optional `objectType`, and should return an MST `OffsetModel` (see `clue-object.ts`), which specifies a `dx` and `dy` with respect to the object's center. Note that offsets are generally bounded by the object's bounding box, so you should make sure `dx` and `dy` are within this rectangle.

#### `getObjectNodeRadii` (optional)

For small objects, such as numberline points or xy plot dots, the default node size might be so big that the node blocks the add annotation button, preventing the user from adding multiple annotations. Defining `getObjectNodeRadii` allows for a custom sized node. The function takes an `objectId` and optional `objectType` and should return an object which cotains `centerRadius` and `highlightRadius`. `kSmallAnnotationNodeRadius / 2` and `kSmallAnnotationNodeRadius` are good values for these, respectively.

### Updates to `registerTileContentInfo`

All tiles have a `tile-registration.ts` file, where certain basic information about the tile is defined.

#### `updateObjectReferenceWithNewSharedModelIds`

When tiles are copied (either with the duplicate button or by dragging them from one document to another--these cases are handled in `document-content.ts`), the tile's object ids are generally not updated. The current exception to this rule is that `SharedDataSets` update their `caseIds` and `attributeIds`. For tiles with annotations that connect to objects related to datasets (such as table cells or xy plot dots), these ids need to be updated when the tile is copied. `updateObjectReferenceWithNewSharedModelIds` takes care of this requirement. The function takes three parameters:

- `object` is a `ClueObject` (see above). This is the object that is being updated, and its `objectId` should be mutated appropriately by the function.
- `sharedDataSetEntries` is a list of `PartialSharedModelEntries` which are connected to the tile being copied.
- `updatedSharedModelMap` is a dictionary where keys are original shared model ids and values are `UpdatedSharedDataSetIds`, which contain an `attributeIdMap` and `caseIdMap` that can be used to translate old attribute and case ids to new ones.
This function should update `object.objectId` with new attribute and case ids. It should also return the updated `objectId`.
_REMEMBER:_ This function is only necessary to define for tiles with object ids that get updated when tiles are copied. Currently, that's only an issue for tiles with object ids that come from shared data sets, because other tile internal ids do not get updated when a tile is duplicated.

## Implementation Details

### Annotations in Document Model

Annotations are added to the document model in `document-content-with-annotations.ts`. Annotations are stored at the top level of the `DocumentModel` in a map, similar to tiles and shared models. And just like tiles and shared models, annotations need to be handled when exporting and importing documents, copying tiles, etc. Most of these functions are handled in `document-content.ts`.
_NOTE:_ Currently, `annotations` in `DocumentModel` is defined as a map of `ArrowAnnotations`. When it comes time to add additional annotations to CLUE, it will be necessary to make this a union including `ArrowAnnotation` and any other new annotation models.

### Rendering Annotations

Annotations are rendered in the `AnnotationLayer`. This component is contained in the `CanvasComponent` and lives alongside the `DocumentContent`, covering it completely.

The `AnnotationLayer` is in charge of several important tasks related to annotations:

- It determines the size of the document, which bounds the placement of text.
- It determines the offset of tiles with respect to the document, which is used to position annotation buttons and annotations (since object bounding boxes are positioned with respect to the containing tile).
- It displays a preview arrow while the user has selected the source object of an arrow but hasn't yet selected a target object (note that this will need to be refactored when more annotations are added).
- It displays the annotation buttons when appropriate and handles what happens when they are pressed (this is also very closely tied to sparrows and will need to be refactored when more annotations are added).

### Curved Arrows

Arrow annotations are formed by bezier curves. Most of the heavy lifting for this takes place in `src/components/annotation-utilities.ts`. Below are some high level notes that might help others understand what's going on here:

- Each arrow annotation is made of two bezier curves, one that goes from the source to the text, and another that goes from the text to the target.
- The points mentioned above are defined in the `getPoints` view of the `ArrowAnnotation` model:
  - The source point is the center of the source's bounding box plus the arrow annotation's source offset. The target point is the center of the target's bounding box plus the arrow annotation's target offset.
  - The text point is the half way point of the source point and target point, plus the arrow annotation's text offset.
  - These points can also be modified by the user as they drag one of the points.
  - The source and target offsets are bound by their objects' bounding boxes. The text offset is bound by the document size.
- The control points for the bezier curves go parallel and perpendicular to the line between the source and target points.
- An important concept for this math is whether the text is "between" the source and target points (that is, the line perpendicular to the source-target line that goes through the text point intersects the source-target line between the source and target points) or is "beyond" either the source or target point. The direction of the control points changes based on this, as well as how the arrowhead angle is computed.
- The math to determine the arrowhead angle is pretty messy and isn't perfect. It's a very challenging problem.
- The delete button point is approximately half way between the text and target points. This is also a surprisingly challenging problem.
