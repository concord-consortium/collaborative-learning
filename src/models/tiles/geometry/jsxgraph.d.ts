// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    dot?: GeometryElement;

    Value: () => number;
  }

  type BoundingBox = [number, number, number, number];

  class Board {
    id: string;
    attr: {
      // [x1,y1,x2,y2] upper left corner, lower right corner
      boundingbox: BoundingBox
    };
    axis: boolean;
    canvasWidth: number;
    canvasHeight: number;
    container: string;
    containerObj: HTMLElement;
    cssTransMat: number[][];
    isSuspendedUpdate: boolean;
    suspendCount: number | undefined; // CC addition
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
    options: any;

    objects: { [id: string]: GeometryElement };
    objectsList: GeometryElement[];

    create: (elementType: string, parents?: any, attributes?: any) => any;
    generateName: (object: GeometryElement) => string;
    hasPoint: (x: number, y: number) => boolean;
    removeObject: (object: GeometryElement) => JXG.Board;
    on: (event: string, handler: (evt: any) => void) => void;
    getCoordsTopLeftCorner: () => number[];
    // use geometry-utils.getAllObjectsUnderMouse() instead
    // getAllObjectsUnderMouse: (evt: any) => GeometryElement[];

    resizeContainer: (canvasWidth: number, canvasHeight: number,
                      dontSet?: boolean, dontSetBoundingBox?: boolean) => JXG.Board;
    getBoundingBox: () => BoundingBox;
    setBoundingBox: (boundingBox: BoundingBox, keepaspectratio?: boolean) => JXG.Board;
    showInfobox: (value: boolean) => JXG.Board;
    updateInfobox: (el: JXG.GeometryElement) => JXG.Board;
    update: (drag?: JXG.GeometryElement) => JXG.Board;
    fullUpdate: () => JXG.Board;
    suspendUpdate: () => JXG.Board;
    unsuspendUpdate: () => JXG.Board;
    addGrid: () => void;
    removeGrids: () => void;
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
    name: string | (() => string);
    hasLabel: boolean;
    label?: JXG.Text;
    ancestors: { [id: string]: GeometryElement };
    descendants: { [id: string]: GeometryElement };
    parents: string[];
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
    getLabelAnchor: () => JXG.Coords;
    on: (event: string, handler: EventHandler) => void;
    _set: (key: string, value: string | null) => void;
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
    parentPolygon?: JXG.Polygon;
    getRise: () => number;
    getSlope: () => number;
    L: () => number;
  }

  class Text extends CoordsElement {
    plaintext: string;
    size: [number, number]; // [width, height]
    setText: (content: string) => void;
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
    borders: JXG.Line[];

    findPoint: (point: JXG.Point) => number;
    removePoints: (...points: JXG.Point[]) => void;
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
