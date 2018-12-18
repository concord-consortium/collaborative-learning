import { types } from "mobx-state-tree";

export const DEFAULT_SPLITTER_SIZE = 3;

export enum CellPositions {
  NorthWest = 0,
  NorthEast,
  SouthEast,
  SouthWest,
}

interface ICellUpdate {
  bottom?: number;
  height?: number;
  left?: number;
  right?: number;
  top?: number;
  width?: number;
  scale?: number;
}

export interface IGridUpdate {
  height?: number;
  width?: number;
  hSplitter?: number;
  vSplitter?: number;
  initSplitters?: boolean;
  resizeSplitters?: boolean;
}

export const FourUpGridCellModel = types
  .model("FourUpGridCell", {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    scale: 0,
    top: 0,
    width: 0,
  })
  .actions((self) => {
    const updateCell = (update: ICellUpdate) => {
      self.bottom = typeof update.bottom !== "undefined" ? update.bottom : self.bottom;
      self.height = typeof update.height !== "undefined" ? update.height : self.height;
      self.left = typeof update.left !== "undefined" ? update.left : self.left;
      self.right = typeof update.right !== "undefined" ? update.right : self.right;
      self.scale = typeof update.scale !== "undefined" ? update.scale : self.scale;
      self.top = typeof update.top !== "undefined" ? update.top : self.top;
      self.width = typeof update.width !== "undefined" ? update.width : self.width;
    };

    return {
      update: updateCell,
    };
  });

export const FourUpGridModel = types
  .model("FourUpGrid", {
    cells: types.array(FourUpGridCellModel),
    hSplitter: 0,
    height: 0,
    splitterSize: DEFAULT_SPLITTER_SIZE,
    vSplitter: 0,
    width: 0,
  })
  .actions((self) => {
    const splitInMiddle = (dist: number) => {
      return Math.max(0, (dist - splitterSize) / 2);
    };

    const getCellScaling = (opts: ICellUpdate) => {
      const cell = {
        height: opts.height || 0,
        width: opts.width || 0,
      };
      opts.scale = (self.width > 0) && (self.height > 0)
        ? Math.min(cell.width / self.width, cell.height / self.height)
        : 0;
      return opts;
    };

    const getCellPositions = () => {
      const southTop = self.hSplitter + self.splitterSize;
      const eastLeft = self.vSplitter + self.splitterSize;
      const eastWidth = Math.max(0, self.width - eastLeft);
      const southHeight = Math.max(0, self.height - southTop);
      const nwPos = {top: 0,        left: 0,        width: self.vSplitter, height: self.hSplitter};
      const nePos = {top: 0,        left: eastLeft, width: eastWidth,      height: self.hSplitter};
      const sePos = {top: southTop, left: eastLeft, width: eastWidth,      height: southHeight};
      const swPos = {top: southTop, left: 0,        width: self.vSplitter, height: southHeight};
      return {
        [CellPositions.NorthWest]: getCellScaling(nwPos),
        [CellPositions.NorthEast]: getCellScaling(nePos),
        [CellPositions.SouthEast]: getCellScaling(sePos),
        [CellPositions.SouthWest]: getCellScaling(swPos),
      };
    };

    const updateGrid = (update: IGridUpdate) => {
      const start = {
        hSplitter: self.hSplitter,
        height: self.height,
        vSplitter: self.vSplitter,
        width: self.width,
      };

      // update the container size
      self.width = typeof update.width !== "undefined" ? update.width : self.width;
      self.height = typeof update.height !== "undefined" ? update.height : self.height;

      // see if the splitters need moved to inside the container
      self.hSplitter = Math.max(self.splitterSize, Math.min(
        typeof update.hSplitter !== "undefined" ? update.hSplitter : self.hSplitter,
        Math.max(0, self.height - (self.splitterSize * 2)),
      ));
      self.vSplitter = Math.max(self.splitterSize, Math.min(
        typeof update.vSplitter !== "undefined" ? update.vSplitter : self.vSplitter,
        Math.max(0, self.width - (self.splitterSize * 2)),
      ));
      if (update.initSplitters) {
        self.hSplitter = splitInMiddle(self.height);
        self.vSplitter = splitInMiddle(self.width);
      }
      if (update.resizeSplitters) {
        self.hSplitter = (start.hSplitter / start.height) * self.height;
        self.vSplitter = (start.vSplitter / start.width) * self.width;
      }

      // update the cells
      const updateCellPos = getCellPositions();
      self.cells[CellPositions.NorthWest].update(updateCellPos[CellPositions.NorthWest]);
      self.cells[CellPositions.NorthEast].update(updateCellPos[CellPositions.NorthEast]);
      self.cells[CellPositions.SouthEast].update(updateCellPos[CellPositions.SouthEast]);
      self.cells[CellPositions.SouthWest].update(updateCellPos[CellPositions.SouthWest]);
    };

    // set the splitters
    const {height, width, splitterSize} = self;
    let {hSplitter, vSplitter} = self;
    if (hSplitter === 0) {
      hSplitter = splitInMiddle(height);
    }
    if (vSplitter === 0) {
      vSplitter = splitInMiddle(width);
    }

    // initialize the cells
    if (self.cells.length !== 0) {
      throw new Error("FourUpGridModel should be passed an empty cells array");
    }
    const initialCellPos = getCellPositions();
    self.cells[CellPositions.NorthWest] = FourUpGridCellModel.create(initialCellPos[CellPositions.NorthWest]);
    self.cells[CellPositions.NorthEast] = FourUpGridCellModel.create(initialCellPos[CellPositions.NorthEast]);
    self.cells[CellPositions.SouthEast] = FourUpGridCellModel.create(initialCellPos[CellPositions.SouthEast]);
    self.cells[CellPositions.SouthWest] = FourUpGridCellModel.create(initialCellPos[CellPositions.SouthWest]);

    return {
      update: updateGrid,
    };
  });

export type FourUpGridModelType = typeof FourUpGridModel.Type;
export type FourUpGridCellModelType = typeof FourUpGridCellModel.Type;
