import React from "react";
import { IconButton } from "../../../utilities/icon-button";
import "./split-view-buttons.sass";

interface IProps {
  splitClass: "full" | "most" | "half";
  onClickSplitLeft?: () => void;
  onClickSplitRight?: () => void;
}

export const SplitViewButtons: React.SFC<IProps> = (props: IProps) => {
  const { splitClass, onClickSplitLeft, onClickSplitRight } = props;
  return (
    <div className="split-view-buttons">
      <IconButton className={`split-view-button split-view-left ${splitClass}`}
                  icon="split-view-left" key="split-view-left" title="Move Split Left"
                  onClickButton={onClickSplitLeft} />
      <IconButton className={`split-view-button split-view-right ${splitClass}`}
                  icon="split-view-right" key="split-view-right" title="Move Split Right"
                  onClickButton={onClickSplitRight} />
    </div>
  );
};
