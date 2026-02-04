import { CellPositions, DEFAULT_SPLITTER_SIZE, FourUpGridModel, FourUpGridCellModel } from "./four-up-grid";

describe("four-up grid model", () => {

  it("throws an exception if the cells aren't empty", () => {
    const invalidCells = () => {
      FourUpGridModel.create({
        cells: [
          FourUpGridCellModel.create({})
        ]
      });
    };
    expect(invalidCells).toThrow(Error);
  });

  it("sets default values", () => {
    const grid = FourUpGridModel.create({});
    expect(grid.cells.length).toBe(4);
    expect(grid.hSplitter).toBe(0);
    expect(grid.height).toBe(0);
    expect(grid.splitterSize).toBe(DEFAULT_SPLITTER_SIZE);
    expect(grid.vSplitter).toBe(0);
    expect(grid.width).toBe(0);

    const nwCell = grid.cells[CellPositions.NorthWest];
    expect(nwCell.bottom).toBe(0);
    expect(nwCell.height).toBe(0);
    expect(nwCell.left).toBe(0);
    expect(nwCell.right).toBe(0);
    expect(nwCell.scale).toBe(0);
    expect(nwCell.top).toBe(0);
    expect(nwCell.width).toBe(0);

    const neCell = grid.cells[CellPositions.NorthEast];
    expect(neCell.bottom).toBe(0);
    expect(neCell.height).toBe(0);
    expect(neCell.left).toBe(DEFAULT_SPLITTER_SIZE);
    expect(neCell.right).toBe(0);
    expect(neCell.scale).toBe(0);
    expect(neCell.top).toBe(0);
    expect(neCell.width).toBe(0);

    const seCell = grid.cells[CellPositions.SouthEast];
    expect(seCell.bottom).toBe(0);
    expect(seCell.height).toBe(0);
    expect(seCell.left).toBe(DEFAULT_SPLITTER_SIZE);
    expect(seCell.right).toBe(0);
    expect(seCell.scale).toBe(0);
    expect(seCell.top).toBe(DEFAULT_SPLITTER_SIZE);
    expect(seCell.width).toBe(0);

    const swCell = grid.cells[CellPositions.SouthWest];
    expect(swCell.bottom).toBe(0);
    expect(swCell.height).toBe(0);
    expect(swCell.left).toBe(0);
    expect(swCell.right).toBe(0);
    expect(swCell.scale).toBe(0);
    expect(swCell.top).toBe(DEFAULT_SPLITTER_SIZE);
    expect(swCell.width).toBe(0);
  });

  it("uses override values", () => {
    const grid = FourUpGridModel.create({
      hSplitter: 75,
      height: 100,
      splitterSize: 5,
      vSplitter: 50,
      width: 200,
    });
    expect(grid.hSplitter).toBe(75);
    expect(grid.height).toBe(100);
    expect(grid.splitterSize).toBe(5);
    expect(grid.vSplitter).toBe(50);
    expect(grid.width).toBe(200);

    const nwCell = grid.cells[CellPositions.NorthWest];
    expect(nwCell.bottom).toBe(0);
    expect(nwCell.height).toBe(75);
    expect(nwCell.left).toBe(0);
    expect(nwCell.right).toBe(0);
    expect(nwCell.scale).toBe(0.25);
    expect(nwCell.top).toBe(0);
    expect(nwCell.width).toBe(50);

    const neCell = grid.cells[CellPositions.NorthEast];
    expect(neCell.bottom).toBe(nwCell.bottom);
    expect(neCell.height).toBe(nwCell.height);
    expect(neCell.left).toBe(55);
    expect(neCell.right).toBe(0);
    expect(neCell.scale).toBe(0.725);
    expect(neCell.top).toBe(0);
    expect(neCell.width).toBe(145);

    const seCell = grid.cells[CellPositions.SouthEast];
    expect(seCell.bottom).toBe(0);
    expect(seCell.height).toBe(20);
    expect(seCell.left).toBe(neCell.left);
    expect(seCell.right).toBe(neCell.right);
    expect(seCell.scale).toBe(0.2);
    expect(seCell.top).toBe(80);
    expect(seCell.width).toBe(145);

    const swCell = grid.cells[CellPositions.SouthWest];
    expect(swCell.bottom).toBe(seCell.bottom);
    expect(swCell.height).toBe(seCell.height);
    expect(swCell.left).toBe(nwCell.left);
    expect(swCell.right).toBe(nwCell.right);
    expect(swCell.scale).toBe(seCell.scale);
    expect(swCell.top).toBe(seCell.top);
    expect(swCell.width).toBe(nwCell.width);
  });

  it("can initialize the splitters", () => {
    const grid = FourUpGridModel.create({
      height: 100,
      splitterSize: 3,
      width: 200,
    });
    grid.update({initSplitters: true});
    expect(grid.hSplitter).toBe(48.5);
    expect(grid.vSplitter).toBe(98.5);
  });

  it("can resize the splitters", () => {
    const grid = FourUpGridModel.create({
      height: 100,
      splitterSize: 3,
      width: 200,
    });
    grid.update({initSplitters: true});
    grid.update({
      height: 200,
      resizeSplitters: true,
      width: 300,
    });
    expect(grid.hSplitter).toBe(97);
    expect(grid.vSplitter).toBe(147.75);
  });

  it("can move the splitters", () => {
    const grid = FourUpGridModel.create({
      height: 100,
      splitterSize: 3,
      width: 200,
    });
    grid.update({initSplitters: true});
    grid.update({
      hSplitter: 25,
      vSplitter: 75,
    });
    expect(grid.hSplitter).toBe(25);
    expect(grid.vSplitter).toBe(75);
  });

  it("can do partial updates of the cells", () => {
    const grid = FourUpGridModel.create({
      height: 100,
      splitterSize: 3,
      width: 200,
    });
    grid.cells[CellPositions.NorthWest].update({right: 10});
    grid.cells[CellPositions.NorthEast].update({});
    grid.cells[CellPositions.SouthEast].update({bottom: 0});
    grid.cells[CellPositions.SouthWest].update({right: 10, bottom: 0});
  });
});
