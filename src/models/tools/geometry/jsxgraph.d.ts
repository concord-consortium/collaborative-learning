// tslint:disable:max-classes-per-file
// tslint:disable:member-access
// tslint:disable:member-ordering
// tslint:disable:no-namespace
declare namespace JXG {

  const COORDS_BY_SCREEN: number;
  const COORDS_BY_USER: number;

  const touchProperty: string;

  class Board {
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

    create: (elementType: string, parents?: any, attributes?: any) => any;
    on: (event: string, handler: (evt: any) => void) => void;
    getCoordsTopLeftCorner: () => number[];
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

  }

  class GeometryElement {
    type: number;
    visProp: { [prop: string]: any };
  }

  const JSXGraph: {
    initBoard: (box: string, attributes: any) => JXG.Board;
    freeBoard: (board: JXG.Board | string) => void;
  };

  class Point extends GeometryElement {

  }

  const _ceil10: (value: number, exp: number) => number;
  const _floor10: (value: number, exp: number) => number;
  const _round10: (value: number, exp: number) => number;
  const toFixed: (num: number, precision: number) => string;
  const isObject: (v: any) => boolean;
  const isPoint: (v: any) => boolean;
  const getPosition: (evt: any, index?: number, doc?: any) => number[];
}
