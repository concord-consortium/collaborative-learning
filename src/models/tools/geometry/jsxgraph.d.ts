// tslint:disable:max-classes-per-file
// tslint:disable:member-access
// tslint:disable:no-namespace
declare namespace JXG {

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
}
