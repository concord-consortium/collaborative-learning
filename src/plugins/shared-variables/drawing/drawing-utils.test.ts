import { RectangleObjectSnapshotForAdd } from "src/plugins/drawing/objects/rectangle";
import { defaultDrawingContent } from "../../drawing/model/drawing-content";
import { getValidInsertPosition } from "./drawing-utils";

const mockGetVisibleCanvasSize = jest.fn(() => { return {x:200, y:100}} );

const mockSettings = {
    fill: "#666666",
    stroke: "#888888",
    strokeDashArray: "3,3",
    strokeWidth: 5
};

const rect1: RectangleObjectSnapshotForAdd = {
    id: "a",
    type: "rectangle",
    x: 10,
    y: 10,
    width: 10,
    height: 10,
    ...mockSettings
};

describe("getValidInsertPosition", () => {
    it("Should return initial position", () => {
        const content = defaultDrawingContent();
        expect(getValidInsertPosition(content, mockGetVisibleCanvasSize)).toStrictEqual({ x: 10, y: 10});
    });
    it("Should increment position to avoid overlaps", () => {
        const content = defaultDrawingContent();
        content.addObject(rect1);
        expect(getValidInsertPosition(content, mockGetVisibleCanvasSize)).toStrictEqual({ x: 35, y: 35});

        content.addObject({...rect1, id: "b", x: 35, y: 35 });
        content.addObject({...rect1, id: "c", x: 60, y: 60 });
        content.addObject({...rect1, id: "d", x: 85, y: 85 });
        expect(getValidInsertPosition(content, mockGetVisibleCanvasSize)).toStrictEqual({ x: 110, y: 10});
    })
});