import React from "react";
import { IDocumentContext } from "../../models/document/document-types";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { useImageContentUrl } from "./use-image-content-url";

interface IProps {
  content: ImageContentModelType;
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onUrlChange: (url: string, filename?: string, context?: IDocumentContext) => void;
}

export const ImageComponent =
  React.forwardRef<HTMLDivElement, IProps>(({ content, style, onMouseDown, onUrlChange }, forwardedRef) => {

    // calls onUrlChange when image url changes in content
    useImageContentUrl(content, onUrlChange);

    return (
      <div className="image-frame">
        <div
          className="image-tool-image"
          ref={forwardedRef}
          style={style}
          onMouseDown={onMouseDown}
        />
      </div>
    );
  });
ImageComponent.displayName = "ImageComponent";
