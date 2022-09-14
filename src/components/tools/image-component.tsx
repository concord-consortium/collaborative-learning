import { observer } from "mobx-react";
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

const _ImageComponent =
  React.forwardRef<HTMLDivElement, IProps>(({ content, style, onMouseDown, onUrlChange }, forwardedRef) => {
    // calls onUrlChange when image url changes in content
    useImageContentUrl(content, onUrlChange);

    return (
      <div className="image-frame">
        dennis
        <div
          className="image-tool-image"
          ref={forwardedRef}
          style={style}
          onMouseDown={onMouseDown}
        />
      </div>
    );
  });
_ImageComponent.displayName = "ImageComponent";
export const ImageComponent = observer(_ImageComponent);
