// Following drawing-tile.test.tsx, these mocks need to be in place before importing libraries.

// mock the measureText function
const mockMeasureText = jest.fn((text: string, fontSize: number) => {
  // assume every character is half the width of the font's height
  const width = text.length * fontSize / 2;
  return { width };
});

// mock the 2D canvas context
class MockCanvas2DContext {
  font: string;

  get fontSize() {
    const match = /(\d+)/.exec(this.font || "");
    const sizeStr = match?.[1];
    return sizeStr ? +sizeStr : 16;
  }

  measureText(text: string) {
    return mockMeasureText(text, this.fontSize);
  }
}

// mock document.createElement to return a "canvas" element that returns our mock 2D context
const origCreateElement = document.createElement;
const createElementSpy = jest.spyOn(document, "createElement")
    .mockImplementation((tagName: string, options?: any) => {
  // console.log("mockCreateElement", "tag:", tagName);
  return tagName === "canvas"
          ? { getContext: () => new MockCanvas2DContext() } as any as HTMLCanvasElement
          : origCreateElement.call(document, tagName, options);
});

// Mock colors imported from SCSS
jest.mock("../../../utilities/color-utils.ts", () => {
  const originalModule = jest.requireActual("../../../utilities/color-utils.ts");
  return {
    ...originalModule,
    clueDataColorInfo: [
      { color: "#0069ff", name: "blue" },
      { color: "#ff9617", name: "orange" },
      { color: "#19a90f", name: "green" },
      { color: "#ee0000", name: "red" },
      { color: "#cbd114", name: "yellow" },
      { color: "#d51eff", name: "purple" },
      { color: "#6b00d2", name: "indigo" }    ]
  };
});

// Set up mock axes
const hOrientation = "horizontal" as AxisOrientation;
const vOrientation = "vertical" as AxisOrientation;
const bottomPlace = "bottom" as "bottom" | "left" | "rightNumeric" | "rightCat" | "top";
const leftPlace = "left" as "bottom" | "left" | "rightNumeric" | "rightCat" | "top";
const scaleType = "linear" as IScaleType;
const mockAxes = {
  bottom: {
    isCategorical: false,
    isNumeric: true,
    max: 10,
    min: 0,
    orientation: hOrientation,
    place: bottomPlace,
    scale: scaleType,
    setScale: jest.fn(),
    setTransitionDuration: jest.fn(),
    transitionDuration: 0,
    type: "linear"
  },
  left: {
    isCategorical: false,
    isNumeric: true,
    max: 10,
    min: 0,
    orientation: vOrientation,
    place: leftPlace,
    scale: scaleType,
    setScale: jest.fn(),
    setTransitionDuration: jest.fn(),
    transitionDuration: 0,
    type: "linear"
  }
};

import { getSnapshot } from '@concord-consortium/mobx-state-tree';
import { GraphModel, IGraphModel } from './graph-model';
import { kGraphTileType } from '../graph-defs';
import {
  clueDataColorInfo, defaultBackgroundColor, defaultPointColor, defaultStrokeColor
} from "../../../utilities/color-utils";
import { MovablePointModel } from '../adornments/movable-point/movable-point-model';
import { MovableLineModel } from '../adornments/movable-line/movable-line-model';
import { createDocumentModel, DocumentModelType } from '../../../models/document/document';
import { SharedDataSet } from '../../../models/shared/shared-data-set';
import { getTileSharedModels } from '../../../models/shared/shared-data-utils';
import { getSharedModelManager } from '../../../models/tiles/tile-environment';
import { AxisOrientation, IScaleType } from '../imports/components/axis/axis-types';

import "../../../models/shared/shared-data-set-registration";
import "../../../models/shared/shared-case-metadata-registration";
import "../graph-registration";

describe('GraphModel', () => {
  it('should create an instance with defaults', () => {
    const graphModel = GraphModel.create();
    expect(graphModel.type).toBe(kGraphTileType);
    expect(graphModel.adornments.length).toBe(0);
    expect(graphModel.axes.size).toBe(0);
    expect(graphModel.plotType).toBe('casePlot');
    expect(graphModel._pointColors).toStrictEqual([defaultPointColor]);
    expect(graphModel._pointStrokeColor).toBe(defaultStrokeColor);
    expect(graphModel.pointStrokeSameAsFill).toBe(false);
    expect(graphModel.plotBackgroundColor).toBe(defaultBackgroundColor);
    expect(graphModel.pointSizeMultiplier).toBe(1);
    expect(graphModel.isTransparent).toBe(false);
    expect(graphModel.plotBackgroundImageID).toBe('');
    expect(graphModel.plotBackgroundLockInfo).toBe(undefined);
    expect(graphModel.showParentToggles).toBe(false);
    expect(graphModel.showMeasuresForSelection).toBe(false);
    expect(graphModel.layers.length).toBe(1);
    expect(graphModel.layers[0].config).toBeTruthy();
  });

  it('should show and hide adornments', () => {
    const graphModel = GraphModel.create();
    expect(graphModel.adornments.length).toBe(0);
    const testAdornment = MovablePointModel.create({id: 'test', type: 'Movable Point', isVisible: true});
    graphModel.addAdornment(testAdornment);
    expect(graphModel.adornments.length).toBe(1);
    expect(graphModel.adornments[0]).toBe(testAdornment);
    graphModel.hideAdornment('Movable Point');
    expect(graphModel.adornments[0].isVisible).toBe(false);
    graphModel.showAdornment('Movable Point');
    expect(graphModel.adornments[0].isVisible).toBe(true);
  });

  it('should clear selected adornment instances', () => {
    const graphModel = GraphModel.create();
    const testMovableLineAdornment = MovableLineModel.create();
    testMovableLineAdornment.setLine(mockAxes.bottom, mockAxes.left, "line1");
    graphModel.addAdornment(testMovableLineAdornment);
    expect(testMovableLineAdornment.lines.size).toBe(1);
    testMovableLineAdornment.toggleSelected("line1");
    expect(graphModel.isAnyAdornmentSelected).toBe(true);
    graphModel.clearSelectedAdornmentInstances();
    expect(graphModel.isAnyAdornmentSelected).toBe(false);
    expect(testMovableLineAdornment.lines.size).toBe(0);
  });

  describe('Responding to shared data', () => {
    function createDefaultDocument() {
      return createDocumentModel({ type: "problem", uid: "user-1", key: "document-1", content: {} });
    }
    let document: DocumentModelType = createDefaultDocument();
    let graphModel: IGraphModel;
    const sharedDataSet = SharedDataSet.create();
    const sharedDataSet2 = SharedDataSet.create();

    it('supports adding layers', () => {
      document = createDefaultDocument();
      const { tileId } = document.content?.addTileContentInNewRow(getSnapshot(GraphModel.create())) || {};
      graphModel = document.content?.getTile(tileId!)?.content as IGraphModel;
      expect(graphModel).toBeTruthy();
      if (!graphModel) fail('No graph model');
      expect(graphModel.type).toBe(kGraphTileType);
      expect(graphModel.layers.length).toBe(1);
      expect(graphModel.layers[0].isLinked).toBe(false);
      expect(graphModel.layers[0].config.dataset).toBeUndefined();

      const smm = getSharedModelManager(graphModel);
      expect(smm?.isReady).toBe(true);

      // First added dataset replaces default layer 0
      smm?.addSharedModel(sharedDataSet);
      smm?.addTileSharedModel(graphModel, sharedDataSet);
      graphModel.updateAfterSharedModelChanges(sharedDataSet); // normally called by tree manager
      expect(getTileSharedModels(graphModel)).toHaveLength(2); // Metadata will have been created and added
      expect(graphModel.layers.length).toBe(1);
      expect(graphModel.layers[0].isLinked).toBe(true);
      expect(graphModel.layers[0].config.dataset).toEqual(sharedDataSet.dataSet);

      // Second added dataset creates a layer 1
      smm?.addSharedModel(sharedDataSet2);
      smm?.addTileSharedModel(graphModel, sharedDataSet2);
      graphModel.updateAfterSharedModelChanges(sharedDataSet2); // normally called by tree manager
      expect(getTileSharedModels(graphModel)).toHaveLength(4); // Metadata will have been created and added
      expect(graphModel.layers.length).toBe(2);
      expect(graphModel.layers[0].isLinked).toBe(true);
      expect(graphModel.layers[0].config.dataset).toEqual(sharedDataSet.dataSet);
      expect(graphModel.layers[1].isLinked).toBe(true);
      expect(graphModel.layers[1].config.dataset).toEqual(sharedDataSet2.dataSet);
    });

    it('supports adding an editable layer', () => {
      if (!graphModel) fail('No graph model'); // reuses data from previous test
      expect(graphModel.layers.length).toBe(2);
      expect(graphModel.layers[0].editable).toBe(false);
      graphModel.createEditableLayer();
      expect(graphModel.layers.length).toBe(3);
      const layer = graphModel.layers[2];
      expect(layer.editable).toBe(true);
      expect(layer.config.attributeDescriptions.x.type).toEqual("numeric");
      expect(layer.config.attributeDescriptions.y.type).toEqual("numeric");
      expect(layer.config.dataset?.name).toEqual("Added by hand");
      expect(layer.config.dataset?.attributes.map(a => a.name)).toEqual(["X Variable", "Y Variable 1"]);
    });

    it('supports removing layers', () => {
      if (!graphModel) fail('No graph model'); // reuses data from previous test
      const smm = getSharedModelManager(graphModel);
      smm?.removeTileSharedModel(graphModel, sharedDataSet2);
      graphModel.updateAfterSharedModelChanges(sharedDataSet);
      // Currently Metadata remains attached - doesn't seem like correct behavior longer term though
      expect(getTileSharedModels(graphModel)).toHaveLength(5);
      expect(graphModel.layers.length).toBe(2);
      expect(graphModel.layers[0].isLinked).toBe(true);
      expect(graphModel.layers[0].config.dataset).toEqual(sharedDataSet.dataSet);
    });

    it("re-uses existing metadata if present", () => {
      if (!graphModel) fail('No graph model'); // reuses data from previous test
      const smm = getSharedModelManager(graphModel);
      smm?.addSharedModel(sharedDataSet2);
      smm?.addTileSharedModel(graphModel, sharedDataSet2);
      graphModel.updateAfterSharedModelChanges(sharedDataSet2);
      expect(getTileSharedModels(graphModel)).toHaveLength(6);
      expect(graphModel.layers.length).toBe(3);
      expect(graphModel.layers[0].isLinked).toBe(true);
      expect(graphModel.layers[0].config.dataset).toEqual(sharedDataSet.dataSet);
      expect(graphModel.layers[1].isLinked).toBe(true);
      expect(graphModel.layers[1].editable).toEqual(true);
      expect(graphModel.layers[2].isLinked).toBe(true);
      expect(graphModel.layers[2].config.dataset).toEqual(sharedDataSet2.dataSet);
    });

    it("cycles through colors properly", () => {
      if (!graphModel) fail("No graph model"); // reuses data from previous test
      function getUniqueColorIndices() {
        const uniqueColorIndices: number[] = [];
        graphModel._idColors.forEach(colorIndex => {
          if (!uniqueColorIndices.includes(colorIndex)) uniqueColorIndices.push(colorIndex);
        });
        return uniqueColorIndices;
      }

      // Colors should loop once we've gone through them all
      clueDataColorInfo.forEach(color => {
        graphModel.setColorForId(color.color);
        // graphModel.getColorForId(color.color);
      });
      const extraId = "extra";
      graphModel.setColorForId(extraId);
      // graphModel.getColorForId(extraId);
      expect(getUniqueColorIndices().length).toEqual(clueDataColorInfo.length);

      // After removing a color, we should get it when we add a new color
      const uniqueKey =
        clueDataColorInfo.find(id => graphModel.getColorForId(id.color) !== graphModel.getColorForId(extraId))!.color;
      const oldColor = graphModel.getColorForId(uniqueKey);
      graphModel.removeColorForId(uniqueKey);
      expect(getUniqueColorIndices().length).toEqual(clueDataColorInfo.length - 1);
      const newKey = "new";
      graphModel.setColorForId(newKey);
      const newColor = graphModel.getColorForId(newKey);
      expect(newColor).toEqual(oldColor);
    });
  });

  afterAll(() => {
    createElementSpy.mockRestore();
  });

});

