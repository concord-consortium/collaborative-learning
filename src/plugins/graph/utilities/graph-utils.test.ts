import { SnapshotOut } from "mobx-state-tree";
import { scaleLinear} from "d3";
import { equationString, getScreenCoord, lineToAxisIntercepts, ptInRect,
  updateGraphContentWithNewSharedModelIds, valueLabelString } from "./graph-utils";
import { DataSet } from "../../../models/data/data-set";
import { UpdatedSharedDataSetIds } from "../../../models/shared/shared-data-set";
import { GraphModel } from "../models/graph-model";

describe("equationString", () => {
  it("should return a valid equation for a given slope and intercept", () => {
    expect(equationString(1, 0, {x: "Lifespan", y: "Speed"})).toBe('<em>Speed</em> = 1 <em>Lifespan</em> + 0');
  });
  it("should return an equation containing only the y attribute when the slope is 0", () => {
    expect(equationString(0, 1, {x: "Lifespan", y: "Speed"})).toBe('<em>Speed</em> = 1');
  });
  it("should return an equation containing only the x attribute when the slope is Infinity", () => {
    expect(equationString(Infinity, 1, {x: "Lifespan", y: "Speed"})).toBe('<em>Lifespan</em> = 1');
  });
});

describe("valueLabelString", () => {
  it("should give correct html", () => {
    expect(valueLabelString(1 / 3)).toBe('<div style="color:blue">0.3333</div>');
  });
});

describe("ptInRect", () => {
  it("{x: 0, y: 0} should be in {x:-1, y: -1, width: 2, height: 2}", () => {
    expect(ptInRect({x: 0, y: 0}, {x: -1, y: -1, width: 2, height: 2})).toBe(true);
  });

  it("{x: 0, y: 0} should be in {x:0, y: 0, width: 0, height: 0}", () => {
    expect(ptInRect({x: 0, y: 0}, {x: 0, y: 0, width: 0, height: 0})).toBe(true);
  });

  it("{x: 1, y: 1} should not be in {x:0, y: 0, width: 1, height: 0.999}", () => {
    expect(ptInRect({x: 1, y: 1}, {x: 0, y: 0, width: 1, height: 0.999})).toBe(false);
  });
});

describe("lineToAxisIntercepts", () => {
  it("Line with slope 1 and intercept 0 should intercept (0,0),(1,1)", () => {
    expect(lineToAxisIntercepts(1, 0, [0, 1], [0, 1]))
      .toEqual({pt1: {x: 0, y: 0}, pt2: {x: 1, y: 1}});
  });

  it("Line with slope ∞ and intercept 0.5 should be parallel to y-axis going through x=0.5", () => {
    expect(lineToAxisIntercepts(1 / 0, 0.5, [0, 1], [0, 1]))
      .toEqual({pt1: {x: 0.5, y: 0}, pt2: {x: 0.5, y: 1}});
  });

  it("Line with slope -1 and intercept 1 should intercept (0,1),(1,0)", () => {
    expect(lineToAxisIntercepts(-1, 1, [0, 1], [0, 1]))
      .toEqual({pt1: {x: 0, y: 1}, pt2: {x: 1, y: 0}});
  });

  it("Line with slope -1 and intercept 0 should hit the lower-left corner of (0,1),(1,0)", () => {
    expect(lineToAxisIntercepts(-1, 0, [0, 1], [0, 1]))
      .toEqual({pt1: {x: 0, y: 0}, pt2: {x: -0, y: 0}});
  });

  it("Line with slope 1 and intercept -1 should hit the lower-right corner of (0,1),(1,0)", () => {
    expect(lineToAxisIntercepts(1, -1, [0, 1], [0, 1]))
      .toEqual({pt1: {x: 1, y: 0}, pt2: {x: 1, y: 0}});
  });

  it("Line with slope 1 and intercept -2 should not intersect (0,1),(1,0)", () => {
    const xDomain = [0, 1],
      yDomain = [0, 1],
      rect = {x: 0, y: 1, width: 1, height: 1},
      result = lineToAxisIntercepts(1, -2, xDomain, yDomain);
    expect(ptInRect(result.pt1, rect) || ptInRect(result.pt2, rect))
      .toBe(false);
  });

});

describe("getScreenCoord", () => {
  it("The screen coord with domain [0, 100] and range [20,200] should be ???", () => {
    const dataset = DataSet.create({name: "data"});
    dataset.addAttributeWithID({name: "a"});
    dataset.addCasesWithIDs([{a: 3, __id__: "c1"}]);
    const attrID = dataset.attributes[0].id,
      caseID = dataset.cases[0].__id__,
      scale = scaleLinear([0, 100], [20, 200]),
      coord1 = getScreenCoord(dataset, caseID, attrID, scale);
    scale.domain([100, 0]);
    const coord2 = getScreenCoord(dataset, caseID, attrID, scale);
    expect(coord1).toBeCloseTo(20 + 0.03 * 180, 5);
    expect(coord2).toBeCloseTo(20 + 0.97 * 180, 5);
  });

});

describe("updateGraphContentWithNewSharedModelIds", () => {

  it("Replaces IDs appropriately", () => {
    const content: SnapshotOut<typeof GraphModel> = {
      "type": "Graph",
      "adornments": [{ "id": "ADRNxHvLKiH_ntmG", "type": "Connecting Lines", "isVisible": true }],
      "axes": {
        "bottom": { "type": "numeric", "place": "bottom", "scale": "linear", "min": -4.5, "max": 7.5 },
        "left": { "type": "numeric", "place": "left", "scale": "linear", "min": -3.5, "max": 8.5 }
      },
      "lockAxes": false,
      "plotType": "scatterPlot", "layers": [{
        "id": "LAYRLybDWmk6IEI-",
        "editable": false,
        "config": {
          "id": "DCON3uYgNhsq_4tk", "dataset": "UL53mvolYBJ5hIVr",
          "metadata": "7U0DJ-WxB83noPMK", "primaryRole": "x",
          "_attributeDescriptions": { "x": { "type": "numeric", "attributeID": "CTZ8N5wGpbsgFPDr" } },
          "_yAttributeDescriptions": [{ "type": "numeric", "attributeID": "t_Yigae_ENpSAaNJ" }]
        }
      }],
      "_idColors": { "t_Yigae_ENpSAaNJ": 0 }, "_pointColors": ["#E6805B"],
      "_pointStrokeColor": "#FFFFFF", "pointStrokeSameAsFill": false, "pointSizeMultiplier": 1,
      "plotBackgroundColor": "#FFFFFF", "plotBackgroundLockInfo": undefined,
      "isTransparent": false, "plotBackgroundImageID": "", "showParentToggles": false,
      "showMeasuresForSelection": false, "xAttributeLabel": "time", "yAttributeLabel": "Signal"
    };

    const updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds> =
    {
      "SharedModelID": {
        attributeIdMap: {
          CTZ8N5wGpbsgFPDr: "att1",
          t_Yigae_ENpSAaNJ: "att2"
        },
        caseIdMap: {},
        origDataSetId: "UL53mvolYBJ5hIVr",
        dataSetId: "dset1",
        sharedModelId: "smod1"
      }
    };

    const result = JSON.stringify(updateGraphContentWithNewSharedModelIds(content, [], updatedSharedModelMap));
    expect(result).not.toContain("UL53mvolYBJ5hIVr");
    expect(result).not.toContain("CTZ8N5wGpbsgFPDr");
    expect(result).not.toContain("t_Yigae_ENpSAaNJ");
    // eslint-disable-next-line max-len
    expect(result).toMatchInlineSnapshot(`"{"type":"Graph","adornments":[{"id":"ADRNxHvLKiH_ntmG","type":"Connecting Lines","isVisible":true}],"axes":{"bottom":{"type":"numeric","place":"bottom","scale":"linear","min":-4.5,"max":7.5},"left":{"type":"numeric","place":"left","scale":"linear","min":-3.5,"max":8.5}},"lockAxes":false,"plotType":"scatterPlot","layers":[{"id":"LAYRLybDWmk6IEI-","editable":false,"config":{"id":"DCON3uYgNhsq_4tk","dataset":"dset1","metadata":"7U0DJ-WxB83noPMK","primaryRole":"x","_attributeDescriptions":{"x":{"type":"numeric","attributeID":"att1"}},"_yAttributeDescriptions":[{"type":"numeric","attributeID":"att2"}]}}],"_idColors":{"att2":0},"_pointColors":["#E6805B"],"_pointStrokeColor":"#FFFFFF","pointStrokeSameAsFill":false,"pointSizeMultiplier":1,"plotBackgroundColor":"#FFFFFF","isTransparent":false,"plotBackgroundImageID":"","showParentToggles":false,"showMeasuresForSelection":false,"xAttributeLabel":"time","yAttributeLabel":"Signal"}"`);
  });

});
