import { expect } from "chai";
import { CellPositions, DEFAULT_SPLITTER_SIZE, FourUpGridModel } from "./four-up-grid";

describe("four-up grid model", () => {

  it("sets default values", () => {
    const grid = FourUpGridModel.create({});
    expect(grid.cells.length).to.equal(4);
    expect(grid.hSplitter).to.equal(0);
    expect(grid.height).to.equal(0);
    expect(grid.splitterSize).to.equal(DEFAULT_SPLITTER_SIZE);
    expect(grid.vSplitter).to.equal(0);
    expect(grid.width).to.equal(0);

    const nwCell = grid.cells[CellPositions.NorthWest];
    expect(nwCell.bottom).to.equal(0);
    expect(nwCell.height).to.equal(0);
    expect(nwCell.left).to.equal(0);
    expect(nwCell.right).to.equal(0);
    expect(nwCell.scale).to.equal(0);
    expect(nwCell.top).to.equal(0);
    expect(nwCell.width).to.equal(0);

    const neCell = grid.cells[CellPositions.NorthEast];
    expect(neCell.bottom).to.equal(0);
    expect(neCell.height).to.equal(0);
    expect(neCell.left).to.equal(DEFAULT_SPLITTER_SIZE);
    expect(neCell.right).to.equal(0);
    expect(neCell.scale).to.equal(0);
    expect(neCell.top).to.equal(0);
    expect(neCell.width).to.equal(0);

    const seCell = grid.cells[CellPositions.SouthEast];
    expect(seCell.bottom).to.equal(0);
    expect(seCell.height).to.equal(0);
    expect(seCell.left).to.equal(DEFAULT_SPLITTER_SIZE);
    expect(seCell.right).to.equal(0);
    expect(seCell.scale).to.equal(0);
    expect(seCell.top).to.equal(DEFAULT_SPLITTER_SIZE);
    expect(seCell.width).to.equal(0);

    const swCell = grid.cells[CellPositions.SouthWest];
    expect(swCell.bottom).to.equal(0);
    expect(swCell.height).to.equal(0);
    expect(swCell.left).to.equal(0);
    expect(swCell.right).to.equal(0);
    expect(swCell.scale).to.equal(0);
    expect(swCell.top).to.equal(DEFAULT_SPLITTER_SIZE);
    expect(swCell.width).to.equal(0);
  });

  it("uses override values", () => {
    const grid = FourUpGridModel.create({
      hSplitter: 75,
      height: 100,
      splitterSize: 5,
      vSplitter: 50,
      width: 200,
    });
    expect(grid.hSplitter).to.equal(75);
    expect(grid.height).to.equal(100);
    expect(grid.splitterSize).to.equal(5);
    expect(grid.vSplitter).to.equal(50);
    expect(grid.width).to.equal(200);

    const nwCell = grid.cells[CellPositions.NorthWest];
    expect(nwCell.bottom).to.equal(0);
    expect(nwCell.height).to.equal(75);
    expect(nwCell.left).to.equal(0);
    expect(nwCell.right).to.equal(0);
    expect(nwCell.scale).to.equal(0.25);
    expect(nwCell.top).to.equal(0);
    expect(nwCell.width).to.equal(50);

    const neCell = grid.cells[CellPositions.NorthEast];
    expect(neCell.bottom).to.equal(nwCell.bottom);
    expect(neCell.height).to.equal(nwCell.height);
    expect(neCell.left).to.equal(55);
    expect(neCell.right).to.equal(0);
    expect(neCell.scale).to.equal(0.725);
    expect(neCell.top).to.equal(0);
    expect(neCell.width).to.equal(145);

    const seCell = grid.cells[CellPositions.SouthEast];
    expect(seCell.bottom).to.equal(0);
    expect(seCell.height).to.equal(20);
    expect(seCell.left).to.equal(neCell.left);
    expect(seCell.right).to.equal(neCell.right);
    expect(seCell.scale).to.equal(0.2);
    expect(seCell.top).to.equal(80);
    expect(seCell.width).to.equal(145);

    const swCell = grid.cells[CellPositions.SouthWest];
    expect(swCell.bottom).to.equal(seCell.bottom);
    expect(swCell.height).to.equal(seCell.height);
    expect(swCell.left).to.equal(nwCell.left);
    expect(swCell.right).to.equal(nwCell.right);
    expect(swCell.scale).to.equal(seCell.scale);
    expect(swCell.top).to.equal(seCell.top);
    expect(swCell.width).to.equal(nwCell.width);
  });

  it("can initialize the splitters", () => {
    const grid = FourUpGridModel.create({
      height: 100,
      splitterSize: 3,
      width: 200,
    });
    grid.update({initSplitters: true});
    expect(grid.hSplitter).to.equal(48.5);
    expect(grid.vSplitter).to.equal(98.5);
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
    expect(grid.hSplitter).to.equal(97);
    expect(grid.vSplitter).to.equal(147.75);
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
    expect(grid.hSplitter).to.equal(25);
    expect(grid.vSplitter).to.equal(75);
  });
});
