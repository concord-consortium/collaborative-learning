// tslint:disable:max-classes-per-file
// tslint:disable:member-access
// tslint:disable:member-ordering
// tslint:disable:no-namespace
declare namespace JXG {

  const COORDS_BY_SCREEN: number;
  const COORDS_BY_USER: number;

  const touchProperty: string;

  const boards: { [id: string]: Board };

  class Board {
    id: string;
    axis: boolean;
    boundingBox: number[];
    canvasWidth: number;
    canvasHeight: number;
    keepaspectratio: boolean;
    showCopyright: boolean;
    showNavigation: boolean;
    showZoom: boolean;
    zoomFactor: number;
    zoomX: number;
    zoomY: number;

    objects: { [id: string]: any };

    objectsList: any[];

    create: (elementType: string, parents?: any, attributes?: any) => any;
    removeObject: (object: GeometryElement) => void;
    on: (event: string, handler: (evt: any) => void) => void;
    getCoordsTopLeftCorner: () => number[];
    resizeContainer: (canvasWidth: number, canvasHeight: number,
                      dontSet?: boolean, dontSetBoundingBox?: boolean) => void;
    setBoundingBox: (boundingBox: number[]) => void;
    update: (drag?: JXG.GeometryElement) => void;
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

  class GeometryElement {
    id: string;
    type: number;
    visProp: { [prop: string]: any };
    fixed: boolean;

    getAttribute: (key: string) => any;
    setAttribute: (attrs: any) => void;
    setPosition: (method: number, coords: number[]) => JXG.Point;
    on: (event: string, handler: (evt: any) => void) => void;
  }

  const JSXGraph: {
    initBoard: (box: string, attributes: any) => JXG.Board;
    freeBoard: (board: JXG.Board | string) => void;
  };

  class Point extends CoordsElement {
  }

  class Polygon extends GeometryElement {
  }

  const _ceil10: (value: number, exp: number) => number;
  const _floor10: (value: number, exp: number) => number;
  const _round10: (value: number, exp: number) => number;
  const toFixed: (num: number, precision: number) => string;
  const isObject: (v: any) => boolean;
  const isPoint: (v: any) => boolean;
  const getPosition: (evt: any, index?: number, doc?: any) => number[];
}
