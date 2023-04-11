import React from "react";
import classNames from "classnames";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up
import { useFeatureFlag } from "../../../../hooks/use-stores";

import "./dataflow-program-link-table-button.scss";

interface IProps {
  isLinkButtonEnabled?: boolean;
  onLinkTableButtonClick?: () => void;
}
export const DataflowLinkTableButton: React.FC<IProps> = ({ isLinkButtonEnabled, onLinkTableButtonClick }) => {
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isLinkButtonEnabled && onLinkTableButtonClick?.();
    e.stopPropagation();
  };

  console.log("useFeatureFlag: geometryLinkedTables?", useFeatureFlag("GeometryLinkedTables"));

  return useFeatureFlag("DataflowLinkedTables") //change to DataflowLinkedTable
          ? <div key="table-link-button" className={classes} data-testid="table-link-button" onClick={handleClick}>
              <LinkTableIcon />
            </div>
          : null;
};
