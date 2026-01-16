import { NumberlineContentModel } from "./numberline-content";

describe("NumberlineContent", () => {
  it("is always user resizable", () => {
    const content = NumberlineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  describe("Point selection and value labels", () => {
    it("creates and selects a point", () => {
      const content = NumberlineContentModel.create();
      const point = content.createAndSelectPoint(2.5, false);

      expect(content.points.size).toBe(1);
      expect(point.xValue).toBe(2.5);
      expect(point.isOpen).toBe(false);
      expect(content.selectedPoints[point.id]).toBe(point);
    });

    it("only allows one selected point at a time", () => {
      const content = NumberlineContentModel.create();
      const point1 = content.createAndSelectPoint(1.0, false);
      const point2 = content.createAndSelectPoint(3.0, false);

      expect(content.points.size).toBe(2);
      expect(content.selectedPoints[point1.id]).toBeUndefined();
      expect(content.selectedPoints[point2.id]).toBe(point2);
      expect(Object.keys(content.selectedPoints).length).toBe(1);
    });

    it("clears all selected points", () => {
      const content = NumberlineContentModel.create();
      const point = content.createAndSelectPoint(2.0, false);

      expect(Object.keys(content.selectedPoints).length).toBe(1);
      content.clearSelectedPoints();
      expect(Object.keys(content.selectedPoints).length).toBe(0);
    });

    it("tracks drag value separately from stored value", () => {
      const content = NumberlineContentModel.create();
      const point = content.createAndSelectPoint(2.0, false);

      expect(point.currentXValue).toBe(2.0);

      point.setDragXValue(3.5);
      expect(point.currentXValue).toBe(3.5);
      expect(point.xValue).toBe(2.0); // Original value unchanged

      point.setXValueToDragValue();
      expect(point.xValue).toBe(3.5);
      expect(point.dragXValue).toBeUndefined();
      expect(point.currentXValue).toBe(3.5);
    });

    it("creates open and closed points correctly", () => {
      const content = NumberlineContentModel.create();
      const closedPoint = content.createAndSelectPoint(1.0, false);
      const openPoint = content.createAndSelectPoint(2.0, true);

      expect(closedPoint.isOpen).toBe(false);
      expect(openPoint.isOpen).toBe(true);
    });

    it("deletes selected points", () => {
      const content = NumberlineContentModel.create();
      const point1 = content.createNewPoint(1.0, false);
      const point2 = content.createNewPoint(2.0, false);
      content.setSelectedPoint(point2);

      expect(content.points.size).toBe(2);
      content.deleteSelectedPoints();
      expect(content.points.size).toBe(1);
      expect(content.getPoint(point1.id)).toBeDefined();
      expect(content.getPoint(point2.id)).toBeUndefined();
    });

    it("moves point position via drag value", () => {
      const content = NumberlineContentModel.create({ min: -5, max: 5 });
      const point = content.createAndSelectPoint(0, false);

      // Simulate keyboard movement
      point.setDragXValue(0.1);
      point.setXValueToDragValue();
      expect(point.xValue).toBeCloseTo(0.1);

      // Move again
      point.setDragXValue(point.xValue + 1.0);
      point.setXValueToDragValue();
      expect(point.xValue).toBeCloseTo(1.1);
    });

    it("can select points in order by position", () => {
      const content = NumberlineContentModel.create();
      const pointA = content.createNewPoint(3.0, false);
      const pointB = content.createNewPoint(-2.0, false);
      const pointC = content.createNewPoint(1.0, false);

      // Points sorted by xValue: B(-2), C(1), A(3)
      const sortedPoints = content.pointsArr.slice().sort((a, b) => a.xValue - b.xValue);
      expect(sortedPoints[0].id).toBe(pointB.id);
      expect(sortedPoints[1].id).toBe(pointC.id);
      expect(sortedPoints[2].id).toBe(pointA.id);
    });
  });
});
