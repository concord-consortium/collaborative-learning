import React from "react";
import { render } from "@testing-library/react";
import { ImageComponent } from "./image-component";
import { ImageContentModel } from "../../../models/tiles/image/image-content";

describe("Image Component", () => {
  const handleMouseDown = jest.fn();
  const handleUrlChange = jest.fn();

  it("calls onUrlChange when content changes", () => {
    const imageContent = ImageContentModel.create();
    const imageStyle = { background: "url(${imageContent.url})", width: 10, height: 10 };
    render(
      <ImageComponent
        ref={null}
        content={imageContent}
        style={imageStyle}
        onMouseDown={handleMouseDown}
        onUrlChange={handleUrlChange}
      />
    );
     expect(handleUrlChange).toHaveBeenCalledTimes(0);
     imageContent.setUrl("newImage.jpg");
     expect(handleUrlChange).toHaveBeenCalledTimes(1);
  });
});
