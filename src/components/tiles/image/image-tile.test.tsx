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
import { Provider } from "mobx-react";
import { render } from "@testing-library/react";
import { ImageContentModel } from "../../../models/tiles/image/image-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { EntryStatus, gImageMap } from "../../../models/image-map";
import { ITileApi } from "../tile-api";
import ImageToolComponent from "./image-tile";

import "../../../models/tiles/image/image-registration";
import { runInAction } from "mobx";

describe("Image Component", () => {
  const mockImageUrl = "my/image/url";
  const updatedUrl = "new-image-url";

  const content = ImageContentModel.create({url: mockImageUrl});
  const model = TileModel.create({content});

  const stores = specStores();

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLDivElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestUniqueTitle: (tileId: string): string | undefined => {
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

  beforeEach(() => {
    // This short circuits the download of the image content
    gImageMap._addOrUpdateEntry(mockImageUrl, {
      contentUrl: mockImageUrl,
      displayUrl: mockImageUrl,
      status: EntryStatus.Ready
    });

    // This short circuits the download of the image content
    gImageMap._addOrUpdateEntry(updatedUrl, {
      contentUrl: updatedUrl,
      displayUrl: updatedUrl,
      status: EntryStatus.Ready
    });

    // Make sure our content has the right url
    content.setUrl(mockImageUrl);
  });

  afterAll(() => {
    createElementSpy.mockRestore();

    // We do this in afterAll because there are delayed promises in
    // image-tile.tsx in `storeNewImageUrl` and `updateImage`.  At least one of these
    // is running after afterEach but before afterAll. So if we remove the entries
    // in afterEach these promises trigger warnings about missing handlers for this
    // bogus images.
    // This should be simplified when the image map entry lookup is moved to the model
    runInAction(() => {
      gImageMap.images.delete(mockImageUrl);
      gImageMap.images.delete(updatedUrl);
    });
  });

  it("renders successfully", () => {
    const { getByTestId } =
      render(
        <Provider stores={stores}>
          <ImageToolComponent {...defaultProps} {...{model}} />
        </Provider>
      );
    expect(getByTestId("image-tile")).toBeInTheDocument();
  });

  it("renders the displayUrl as the background image", () => {
    const { getByTestId } =
      render(
        <Provider stores={stores}>
          <ImageToolComponent {...defaultProps} {...{model}} />
        </Provider>
      );
    const tile = getByTestId("image-tile");
    // FIXME: if you log the renders of the ImageToolComponent you will see that the background
    // image is flip flopping between `test-file-stub` and `my/image/url`
    // This is due to the complexities of the autorun in componentDidMount, the setState in updateImage,
    // and the promise.then in updateImage.
    // This complexity should be reduced if image map entry was moved into the ImageContentModel
    expect(tile.querySelector(".image-tool-image")).toHaveStyle(`background-image: url(${mockImageUrl})`);
  });

  it("updates the background image when the contentUrl changes", () => {
    const { getByTestId } =
      render(
        <Provider stores={stores}>
          <ImageToolComponent {...defaultProps} {...{model}} />
        </Provider>
      );
    const tile = getByTestId("image-tile");
    expect(tile.querySelector(".image-tool-image")).toHaveStyle(`background-image: url(${mockImageUrl})`);


    content.setUrl(updatedUrl);
    expect(tile.querySelector(".image-tool-image")).toHaveStyle(`background-image: url(${updatedUrl})`);
  });

});
