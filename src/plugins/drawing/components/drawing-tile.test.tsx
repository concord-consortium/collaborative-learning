// Some mocks have to be set up before things are imported.

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

import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ITileApi, TileModelContext } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { Provider } from "mobx-react";
import { specStores } from "../../../models/stores/spec-stores";
import { ModalProvider } from "react-modal-hook";
import { createDrawingContent } from "../model/drawing-content";
import DrawingToolComponent from "./drawing-tile";
import { RectangleObjectSnapshotForAdd } from "../objects/rectangle";

// The starter tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../drawing-registration";

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../../models/tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent(...args)
}));

const mockSettings = {
  fill: "#666666",
  stroke: "#888888",
  strokeDashArray: "3,3",
  strokeWidth: 5
};

const rectangleSnapshot: RectangleObjectSnapshotForAdd = {
  type: "rectangle",
  x: 0,
  y: 0,
  width: 30,
  height: 10,
  ...mockSettings,
};

const squareSnapshot: RectangleObjectSnapshotForAdd = {
  type: "rectangle",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...mockSettings,
};

describe("DrawingToolComponent", () => {

  const stores = specStores();

  const content = createDrawingContent();
  const model = TileModel.create({content});
  model.setTitle('A Title for Testing');
  render(<div className="document-content" data-testid="document-content"/>);
  const documentContent = screen.getByTestId("document-content");

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent,
    isUserResizable: true,
    navigatorAllowed: false,
    readOnly: false,
    onResizeRow: (e: React.DragEvent<HTMLDivElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
      // throw new Error("Function not implemented.");
    }
  };

  afterAll(() => {
    createElementSpy.mockRestore();
  });

  it("renders successfully", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <TileModelContext.Provider value={model}>
            <DrawingToolComponent {...defaultProps} {...{model}} />
          </TileModelContext.Provider>
        </Provider>
      </ModalProvider>
    );
    expect(screen.getByTestId("drawing-tool")).toBeInTheDocument();
    expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Open show/sort panel")).toBeInTheDocument();
    expect(screen.getByText("A Title for Testing")).toBeInTheDocument();
  });

  it("can open and close show/sort panel", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <DrawingToolComponent {...defaultProps} {...{model}} />
        </Provider>
      </ModalProvider>
    );
    expect(screen.getByTestId("drawing-tool")).toContainHTML("Open show/sort panel");
    expect(screen.getByTestId("drawing-tool")).not.toContainHTML("Close show/sort panel");

    screen.getByLabelText("Open show/sort panel").click();
    expect(screen.getByTestId("drawing-tool")).toContainHTML("Close show/sort panel");
    expect(screen.getByTestId("drawing-tool")).not.toContainHTML("Open show/sort panel");

    screen.getByLabelText("Close show/sort panel").click();
    expect(screen.getByTestId("drawing-tool")).toContainHTML("Open show/sort panel");
    expect(screen.getByTestId("drawing-tool")).not.toContainHTML("Close show/sort panel");
  });

  it("shows objects in show/sort panel", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <DrawingToolComponent {...defaultProps} {...{model}} />
        </Provider>
      </ModalProvider>
    );

    expect(screen.getByTestId("object-list-view")).not.toContainHTML("Square");
    content.addAndSelectObject(squareSnapshot);
    screen.getByLabelText("Open show/sort panel").click();
    expect(screen.getByTestId("object-list-view")).toContainHTML("Square");
  });

  it("shows correct order of objects in show/sort panel", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <DrawingToolComponent {...defaultProps} {...{model}} />
        </Provider>
      </ModalProvider>
    );

    // Content already has a square in it from previous test.
    content.addAndSelectObject(rectangleSnapshot);
    let items = within(screen.getByTestId("object-list-view")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toContainHTML("Rectangle");
    expect(items[1]).toContainHTML("Square");

    // Move square to top.
    if (content.objects.length >= 2) {
      content.changeZOrder(content.objects[1].id, content.objects[0].id);
    }
    items = within(screen.getByTestId("object-list-view")).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    expect(items[0]).toContainHTML("Square");
    expect(items[1]).toContainHTML("Rectangle");

  });

  describe("read-only mode", () => {
    const readOnlyContent = createDrawingContent();
    readOnlyContent.addObject(squareSnapshot);
    const readOnlyModel = TileModel.create({content: readOnlyContent});

    it("does not show object list panel in read-only mode", () => {
      render(
        <ModalProvider>
          <Provider stores={stores}>
            <DrawingToolComponent {...defaultProps} model={readOnlyModel} readOnly={true} />
          </Provider>
        </ModalProvider>
      );
      expect(screen.queryByTestId("object-list-view")).not.toBeInTheDocument();
    });

    it("provides getViewTransform for read-only tiles", () => {
      let capturedApi: ITileApi | undefined;
      const onRegisterTileApi = (tileApi: ITileApi) => {
        capturedApi = tileApi;
      };

      const { container } = render(
        <ModalProvider>
          <Provider stores={stores}>
            <DrawingToolComponent
              {...defaultProps}
              model={readOnlyModel}
              readOnly={true}
              onRegisterTileApi={onRegisterTileApi}
            />
          </Provider>
        </ModalProvider>
      );

      const drawingTile = container.querySelector("[data-testid=\"drawing-tool\"]");
      if (drawingTile) {
        Object.defineProperty(drawingTile, "clientWidth", { value: 800, writable: true });
        Object.defineProperty(drawingTile, "clientHeight", { value: 600, writable: true });
      }

      expect(capturedApi?.getViewTransform).toBeDefined();
      const transform = capturedApi?.getViewTransform?.();
      expect(transform).toBeDefined();
      if (transform) {
        expect(transform).toHaveProperty("offsetX");
        expect(transform).toHaveProperty("offsetY");
        expect(transform).toHaveProperty("zoom");
      }
    });

    it("provides untransformed coordinates for getObjectBoundingBox in read-only mode", () => {
      let capturedApi: ITileApi | undefined;
      const onRegisterTileApi = (tileApi: ITileApi) => {
        capturedApi = tileApi;
      };

      const testContent = createDrawingContent();
      const testRect: RectangleObjectSnapshotForAdd = {
        height: 30,
        type: "rectangle",
        x: 100,
        y: 50,
        width: 40,
        ...mockSettings,
      };
      testContent.addObject(testRect);
      const testModel = TileModel.create({content: testContent});

      render(
        <ModalProvider>
          <Provider stores={stores}>
            <DrawingToolComponent
              {...defaultProps}
              model={testModel}
              readOnly={true}
              onRegisterTileApi={onRegisterTileApi}
            />
          </Provider>
        </ModalProvider>
      );

      const objectId = testContent.objects[0]?.id;
      expect(objectId).toBeDefined();

      const bbox = capturedApi?.getObjectBoundingBox?.(objectId);
      expect(bbox).toBeDefined();

      // In read-only mode, coordinates should be untransformed (raw object coordinates)
      // The bounding box includes padding of 5 on all sides
      const bbPadding = 5;
      expect(bbox!.left).toBeCloseTo(testRect.x - bbPadding, 1);
      expect(bbox!.top).toBeCloseTo(testRect.y - bbPadding, 1);
      expect(bbox!.width).toBeCloseTo(testRect.width + bbPadding * 2, 1);
      expect(bbox!.height).toBeCloseTo(testRect.height + bbPadding * 2, 1);
      expect(bbox!.width).toBeLessThan(60);
      expect(bbox!.height).toBeLessThan(50);
    });

    it("provides transformed coordinates for getObjectBoundingBox in editable mode", () => {
      let capturedApi: ITileApi | undefined;
      const onRegisterTileApi = (tileApi: ITileApi) => {
        capturedApi = tileApi;
      };

      const editableContent = createDrawingContent();
      const testRect: RectangleObjectSnapshotForAdd = {
        type: "rectangle",
        x: 100,
        y: 50,
        width: 40,
        height: 30,
        ...mockSettings,
      };
      editableContent.addObject(testRect);
      const zoom = 2;
      const offsetX = 50;
      const offsetY = 25;
      editableContent.setZoom(zoom, {x: 100, y: 100});
      editableContent.setOffset(offsetX, offsetY);
      const editableModel = TileModel.create({content: editableContent});

      render(
        <ModalProvider>
          <Provider stores={stores}>
            <DrawingToolComponent
              {...defaultProps}
              model={editableModel}
              readOnly={false}
              onRegisterTileApi={onRegisterTileApi}
            />
          </Provider>
        </ModalProvider>
      );

      const objectId = editableContent.objects[0]?.id;
      expect(objectId).toBeDefined();

      const bbox = capturedApi?.getObjectBoundingBox?.(objectId!);
      expect(bbox).toBeDefined();
      const bbPadding = 5;
      const expectedWidth = (testRect.width + bbPadding * 2) * zoom;
      const expectedHeight = (testRect.height + bbPadding * 2) * zoom;
      expect(bbox!.width).toBeCloseTo(expectedWidth, 1);
      expect(bbox!.height).toBeCloseTo(expectedHeight, 1);
      const expectedLeft = (testRect.x - bbPadding) * zoom + offsetX;
      const expectedTop = (testRect.y - bbPadding) * zoom + offsetY;
      // Left will include the object list panel width, so we just verify it's transformed.
      expect(bbox!.left).toBeGreaterThan(expectedLeft);
      expect(bbox!.top).toBeCloseTo(expectedTop, 1);
    });
  });
});
