import { observer } from "mobx-react";
import React from "react";

interface IProps {
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const _ImageComponent =
  React.forwardRef<HTMLDivElement, IProps>(({ style, onMouseDown }, forwardedRef) => {

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
_ImageComponent.displayName = "ImageComponent";
export const ImageComponent = observer(_ImageComponent);
