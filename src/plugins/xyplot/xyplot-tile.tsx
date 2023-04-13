import { observer } from "mobx-react";
import React from "react";

import { ITileProps } from "../../components/tiles/tile-component";
// import { XYplotContentModelType } from "./xyplot-content";

import "./xyplot-tile.scss";

export const XYplotToolComponent: React.FC<ITileProps> = observer((props) => {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  //
  // TODO: Determine if the commented out elements below and on line 5 should be modified to
  // for use by features we'll be adding.
  // const content = props.model.content as XYplotContentModelType;

  // const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   content.setText(event.target.value);
  // };

  return (
    <div className="xyplot-tool">
      XYplot Content Placeholder
    </div>
  );
});
XYplotToolComponent.displayName = "XYplotToolComponent";
