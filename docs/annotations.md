# Annotations
Annotations are a way for students (and possibly teachers or CLUE itself in the future) to add additional information to their documents. Annotations are tile independent, so they can be added to anything within CLUE that has been properly set up, and can even span between multiple tiles.

## Types of Annotations
Currently there is just a single type of annotation, the student proportional arrow, or sparrow. In the future, there could be many different types of annotations, such as comments on a single object, circles for emphasis, Xs to indicate mistakes, etc.

### Sparrows
Student proportional arrows, more commonly called sparrows, connect two objects with an arrow and a text box. One of the objects is the source, which has the tail end of the arrow, and the other is the target, which gets the arrowhead. The text box can be moved around and defines the curve of the arrow.

## Setting up Tiles to use Annotations
Each tile must be set up to define which objects within it can be annotated.

### CLUE Objects
Annotations can be connected to anything set up as a CLUE Object. These can be anything within a tile, and tiles themselves are in charge of interpretting what they are. A CLUE Object is defined by three pieces of information:
- tileId: This is the actual id of the tile containing the object.
- objectId: This is a unique way to identify the object from the tile's perspective. This will often be the object's actual id, but it doesn't need to be. For example, cells in table tiles have no ids, so the objectId of a cell is a string that contain's the cell's case and attribute ids.
- objectType: This optional string can help tiles interpret the objectId. For example, the geometry tile allows annotations to be attached to several different types of objects (points, segments, polygons), and the objectType field helps the geometry tile know where to look for the object.

### Tile Model Modifications
To set a tile up with annotations, its content model must have a `get annotatableObjects` view. This function should return an array of all the tile's objects (see CLUE Objects above) that can have an annotation attached to it. This array is used to create buttons the attach annotations when the user enters annotation mode.

### Tile Component Modifications
Setting up a tile with annotations also requires defining one function, `getObjectBoundingBox` in the `tileApi`. Additionally, there are two optional functions that can be defined in the `tileApi` to customize how annotations work with the tile.

#### `getObjectBoundingBox` (required)
This function takes an `objectId` and optional `objectType`, and should return a dictionary containing the bounds for the specified object like `{ height, left, top, width }`. These values should be numbers representing pixels and should be relative to the tile. The CLUE Object's `tileId` will be used to determine which tile's `getObjectBoundingBox` is called, and the `AnnotationLayer` (see below) will offset the returned values to position it in the tile within the document. A few notes about this function:
- The returned values will be used to position annotations attached to the CLUE Object.
- The returned values are also used for the object's default annotation button (see `getObjectButtonSVG` below).
- The returned values are also used to bound the annotation's position with respect to the object. It would be better if `getObjectButtonSVG` defined these bounds, but that would require more challenging math to handle arbitrary shapes instead of simple rectangles.
- Tiles can determine the returned values however they see fit. Some might use the model, some might use DOM elements, and some might use 3rd party libraries (like `d3`) that underly the tile's rendering.
- Even if a tile does not use the model to determine the return values, it still might need to reference the model in the function to make it reactive and update when an object's position changes.

#### `getObjectButtonSVG` (optional)
Each object gets an "annotation button" that allows the user to add an annotation to it when in annotation mode. By default, the button is a rectangle defined by the object's bounding box (see `getObjectBoundingBox` above). However, a tile can define `getObjectButtonSVG` to give an object a custom annotation button. This function takes an object as an argument (defined below) and should return an svg element which will be used as the object's button. If the function is not defined or returns undefined for a particular object, the object's bounding box will be used for its button. The parameter object contains the following members:
- `classes`: This string should be used as the `className` for the svg button to apply the correct button styling to the element. If you want custom styling for the button, you can add additional classes as well.
- `handleClick`: This function should be used as the `onClick` for the svg button.
- `objectId`: The object's id. It's up to the tile to interpret this.
- `objectType`: This optional string can be used to help the tile properly interpret the `objectId`.

#### `getObjectDefaultOffsets` (optional)
By default, annotations are attached to the center of a target object. Defining this function allows the default position of the annotation anchor to be adjusted based on the obect. The function takes the usual `objectId` and optional `objectType`, and should return an MST `OffsetModel` (see `clue-object.ts`), which specifies a `dx` and `dy` with respect to the object's center. Note that offsets are generally bounded by the object's bounding box, so you should make sure `dx` and `dy` are within this rectangle.

### Updates to `registerTileContentInfo`
All tiles have a `tile-registration.ts` file, where certain basic information about the tile is defined.

#### `updateObjectReferenceWithNewSharedModelIds`
When tiles are copied (either with the duplicate button or by dragging them from one document to another--these cases are handled in `document-content.ts`), the tile's object ids are generally not updated. The current exception to this rule is that `SharedDataSets` update their `caseIds` and `attributeIds`. For tiles with annotations that connect to objects related to datasets (such as table cells or xy plot dots), these ids need to be updated when the tile is copied. `updateObjectReferenceWithNewSharedModelIds` takes care of this requirement. The function takes...

## Implementation Details
_TO BE ADDED_
