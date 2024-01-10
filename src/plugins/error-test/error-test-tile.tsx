import { observer } from "mobx-react";
import React from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { ErrorTestContentModelType } from "./error-test-content";
import "./error-test-tile.scss";

export const ErrorTestToolComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as ErrorTestContentModelType;

  if (content.throwRenderError) {
    throw new Error("Test error created by the Error Test tile");
  }

  return (
    <div className="error-test-tool">
      Error Test Component
    </div>
  );
});
ErrorTestToolComponent.displayName = "ErrorTestToolComponent";
