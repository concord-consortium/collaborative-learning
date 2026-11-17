import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { ArrowAnnotationComponent } from "./arrow-annotation";
import { getDefaultPeak } from "./annotation-utilities";
import { ArrowAnnotation, ArrowShape } from "../../models/annotations/arrow-annotation";

// Two cells one row apart in a table, the case that made this bug reportable: the arrow is 22px
// long, so everything it draws is crowded into a space smaller than a single default handle.
const sourceCell = { left: 20, top: 100, height: 22, width: 80 };
const targetCell = { left: 20, top: 122, height: 22, width: 80 };
const center = (cell: typeof sourceCell) => [cell.left + cell.width / 2, cell.top + cell.height / 2];

function renderShortSparrow(text?: string) {
  // The offset the annotation layer stores when a sparrow is drawn, rather than a chosen one: how
  // far a label starts from its endpoints is the thing under test.
  const [sourceCenterX, sourceCenterY] = center(sourceCell);
  const [targetCenterX, targetCenterY] = center(targetCell);
  const { peakDx, peakDy } =
    getDefaultPeak(ArrowShape.curved, sourceCenterX, sourceCenterY, targetCenterX, targetCenterY);
  const arrow = ArrowAnnotation.create({
    text,
    textOffset: { dx: peakDx, dy: peakDy },
    sourceObject: { tileId: "tile1", objectId: "cell1", objectType: "cell" },
    targetObject: { tileId: "tile1", objectId: "cell2", objectType: "cell" }
  });
  const { container } = render(
    <svg>
      <ArrowAnnotationComponent
        arrow={arrow}
        canEdit={true}
        deleteArrow={jest.fn()}
        handleArrowClick={jest.fn()}
        handleDragHandleNonDrag={jest.fn()}
        documentLeft={0} documentRight={800} documentTop={0} documentBottom={600}
        getBoundingBox={object => object.objectId === "cell1" ? sourceCell : targetCell}
        getObjectNodeRadii={() => undefined}
        getTileSize={() => undefined}
      />
    </svg>
  );
  return { arrow, container };
}

function numericAttribute(element: Element, name: string) {
  const value = Number(element.getAttribute(name));
  if (Number.isNaN(value)) throw new Error(`${name} is not a number`);
  return value;
}

describe("ArrowAnnotationComponent on a short sparrow", () => {
  // The middle of the chip is the part of it least likely to be covered, so clearing that is the
  // weakest form of the guarantee. The fixed 48px handles this replaced failed even that.
  it("leaves the middle of the label outside both endpoint hit squares", () => {
    const { container } = renderShortSparrow("+5");
    const label = container.querySelector("foreignObject.text-object")!;
    const centerX = numericAttribute(label, "x") + numericAttribute(label, "width") / 2;
    const centerY = numericAttribute(label, "y") + numericAttribute(label, "height") / 2;

    const hitSquares = container.querySelectorAll(".drag-handle rect");
    expect(hitSquares).toHaveLength(2);
    hitSquares.forEach(square => {
      const left = numericAttribute(square, "x");
      const top = numericAttribute(square, "y");
      const covers = centerX >= left && centerX <= left + numericAttribute(square, "width")
        && centerY >= top && centerY <= top + numericAttribute(square, "height");
      expect(covers).toBe(false);
    });
  });

  // SVG paints in document order and there is no z-index, so this ordering is the whole of what
  // keeps an endpoint reachable when the label overlaps it. It has been reversed twice.
  it("paints the endpoint handles after the label", () => {
    const { container } = renderShortSparrow("+5");
    const label = container.querySelector("foreignObject.text-object")!;
    container.querySelectorAll(".drag-handle").forEach(handle => {
      // eslint-disable-next-line no-bitwise
      expect(label.compareDocumentPosition(handle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("opens the label for editing when it is double clicked", () => {
    renderShortSparrow("+5");
    fireEvent.click(screen.getByRole("button", { name: "+5" }), { detail: 2 });
    expect(screen.getByDisplayValue("+5")).toBeInTheDocument();
  });
});
