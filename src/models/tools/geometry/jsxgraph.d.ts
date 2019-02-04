// tslint:disable:max-classes-per-file
// tslint:disable:member-access
// tslint:disable:member-ordering
// tslint:disable:no-namespace
declare namespace JXG {

  const COORDS_BY_SCREEN: number;
  const COORDS_BY_USER: number;

  const touchProperty: string;

  const boards: { [id: string]: Board };

  interface Angle extends Sector {
    anglepoint: GeometryElement;
    point: GeometryElement;
    point1: GeometryElement;
    point2: GeometryElement;
    point3: GeometryElement;
    pointsquare: GeometryElement;
    radiuspoint: GeometryElement;

    Value: () => number;
  }

  class Board {
    id: string;
    attr: {
      // [x1,y1,x2,y2] upper left corner, lower right corner
      boundingbox: [number, number, number, number]
    };
    axis: boolean;
    canvasWidth: number;
    canvasHeight: number;
    container: string;
    containerObj: HTMLElement;
    cssTransMat: number[][];
    isSuspendedUpdate: boolean;
    keepaspectratio: boolean;
    origin: {
      usrCoords: [number, number, number],
      scrCoords: [number, number, number]
    };
    showCopyright: boolean;
    showNavigation: boolean;
    showZoom: boolean;
    unitX: number;
    unitY: number;
    zoomFactor: number;
    zoomX: number;
    zoomY: number;

    objects: { [id: string]: GeometryElement };
    objectsList: GeometryElement[];

    create: (elementType: string, parents?: any, attributes?: any) => any;
    removeObject: (object: GeometryElement) => JXG.Board;
    on: (event: string, handler: (evt: any) => void) => void;
    getCoordsTopLeftCorner: () => number[];
    // use geometry-utils.getAllObjectsUnderMouse() instead
    // getAllObjectsUnderMouse: (evt: any) => GeometryElement[];

    resizeContainer: (canvasWidth: number, canvasHeight: number,
                      dontSet?: boolean, dontSetBoundingBox?: boolean) => JXG.Board;
    setBoundingBox: (boundingBox: [number, number, number, number], keepaspectratio?: boolean) => JXG.Board;
    showInfobox: (value: boolean) => JXG.Board;
    update: (drag?: JXG.GeometryElement) => JXG.Board;
    suspendUpdate: () => JXG.Board;
    unsuspendUpdate: () => JXG.Board;
  }

  class Coords {
    board: JXG.Board;
    usrCoords: number[];
    scrCoords: number[];
    emitter: boolean;

    constructor(method: number, coordinates: number[], board: JXG.Board, emitter?: boolean);
    normalizeUsrCoords: () => void;
    usr2screen: (doRound: boolean) => void;
    screen2usr: () => void;
  }

  class CoordsElement extends GeometryElement {
    coords: JXG.Coords;
  }

  class Curve extends GeometryElement {
    updateDataArray: () => void;
  }

  type EventHandler = ((evt: any) => void) | ((obj: any, elt: JXG.GeometryElement) => void);

  class GeometryElement {
    board: JXG.Board;
    id: string;
    elType: string;
    type: number;
    name: string;
    ancestors: { [id: string]: GeometryElement };
    parents: Array<string | GeometryElement>;
    childElements: { [id: string]: GeometryElement };
    isDraggable: boolean;
    lastDragTime: Date;
    stdform: [number, number, number, number, number, number, number, number];
    transformations: any[];
    visProp: { [prop: string]: any };
    visPropCalc: { [prop: string]: any };
    fixed: boolean;

    removeChild: (child: GeometryElement) => JXG.Board;
    hasPoint: (x: number, y: number) => boolean;
    // [x1,y1,x2,y2] upper left corner, lower right corner
    bounds: () => [number, number, number, number];
    getAttribute: (key: string) => any;
    setAttribute: (attrs: any) => void;
    setPosition: (method: number, coords: number[]) => JXG.Point;
    on: (event: string, handler: EventHandler) => void;
  }

  const JSXGraph: {
    initBoard: (box: string, attributes: any) => JXG.Board;
    freeBoard: (board: JXG.Board | string) => void;
  };

  class Image extends CoordsElement {
    size: [number, number];
    url: string;

    setSize: (width: number, height: number) => void;
  }

  class Line extends GeometryElement {
    point1: JXG.Point;
    point2: JXG.Point;
  }

  const Math: {
    Geometry: {
      rad: (p1: JXG.Point, p2: JXG.Point, p3: JXG.Point) => number
    },
    Statistics: {
      add: (arr1: number | number[], arr2: number | number[]) => number | number[];
      subtract: (arr1: number | number[], arr2: number | number[]) => number | number[];
    }
  };

  class Point extends CoordsElement {
  }

  class Polygon extends GeometryElement {
    vertices: JXG.Point[];

    findPoint: (point: JXG.Point) => number;
  }

  class Sector extends Curve {
  }

  const _ceil10: (value: number, exp: number) => number;
  const _floor10: (value: number, exp: number) => number;
  const _round10: (value: number, exp: number) => number;
  const toFixed: (num: number, precision: number) => string;
  const isObject: (v: any) => boolean;
  const isPoint: (v: any) => boolean;
  const getPosition: (evt: any, index?: number, doc?: any) => number[];
}
