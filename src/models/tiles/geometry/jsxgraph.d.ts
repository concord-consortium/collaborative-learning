// These are additional declarations that the JSXGraph package does not supply.
// It should be reviewed when updating JSXGraph.
// As of now we are making use of some items that are not part of the public JSXGraph API,
// as noted below.
declare namespace JXG {

  const touchProperty: string; // Documented as private

  interface Angle {
    point1, point2, point3, radiuspoint, anglepoint: Point;
  }

  type BoundingBox = [number, number, number, number];

  interface Board {
    id: string; // Not documented for Board
    suspendCount: number; // CLUE added; not part of JSXGraph
    objectsList: GeometryElement[];
    // setAttribute is documented to accept any of these, but we only use the first.
    //   object: {key1:value1,key2:value2,...}
    //   string: 'key:value'
    //   array: ['key', value]
    setAttribute: (attrs: {[id:string]: string|number|boolean}) => void;
  }

  interface BoardAttributes {
    infobox: TextAttributes,
    keyboard: { enabled: boolean }
  }

  interface GeometryElement {
    _set: (key: string, value: string | null) => void; // Documented as private
    ancestors: { [id: string]: GeometryElement };
    bounds: () => [number, number, number, number];
    childElements: GeometryElement[];
    descendants: { [id: string]: GeometryElement };
    hasPoint: (x: number, y: number) => boolean;
    isDraggable: boolean;
  }

  interface GridOptions {
    majorStep: number;
  }

  interface Image {
    url: string;
    setSize: (width: number, height: number) => void;
  }

  interface Line {
    getRise: () => number; // Not documented
    getSlope: () => number; // Not documented
    parentPolygon?: JXG.Polygon; // Documented as private.
  }

  interface Statistics {
    add: (arr1: number | number[], arr2: number | number[]) => number | number[];
    subtract: (arr1: number | number[], arr2: number | number[]) => number | number[];
  }

  interface Math {
    Statistics: Statistics;
  }

  interface Text {
    plaintext: string; // Not documented
  }

  interface ZoomOptions {
    enabled: boolean;
  }
}
