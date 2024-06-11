declare namespace JXG {

  const touchProperty: string; // note, documented as private

  interface Angle {
    point1, point2, point3, radiuspoint, anglepoint: Point;
  }

  type BoundingBox = [number, number, number, number];

  interface Board {
    cssTransMat: number[][]; // not documented
    id: string; // not documented for Board
    suspendCount: number; // CLUE added; not part of JSXGraph
    objectsList: GeometryElement[];
    // setAttribute is documented to accept any of these, but we only use the first.
    //   object: {key1:value1,key2:value2,...}
    //   string: 'key:value'
    //   array: ['key', value]
    setAttribute: (attrs: {[id:string]: string|number|boolean}) => void;
  }

  interface GeometryElement {
    ancestors: { [id: string]: GeometryElement };
    bounds: () => [number, number, number, number];
    childElements: GeometryElement[];
    descendants: { [id: string]: GeometryElement };
    hasPoint: (x: number, y: number) => boolean;
    isDraggable: boolean;
  }

  interface Image {
    url: string;
    setSize: (width: number, height: number) => void;
  }

  interface Line {
    getRise: () => number; // note, not documented
    getSlope: () => number; // note, not documented
    parentPolygon?: JXG.Polygon; // note, documented as private.
  }

  interface Math {
    Statistics: Statistics;
  }

  interface Statistics {
    add: (arr1: number | number[], arr2: number | number[]) => number | number[];
    subtract: (arr1: number | number[], arr2: number | number[]) => number | number[];
  }

  interface Text {
    plaintext: string; // Not documented
  }
}
