import React from "react";
import classNames from "classnames";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up
import { useDocumentFromStore, useFeatureFlag } from "../../../../hooks/use-stores";
import { useTableLinking } from "../dataflow-use-table-linking";
import { ITileModel } from "src/models/tiles/tile-model";

import "./dataflow-program-link-table-button.scss";
import { ITileLinkMetadata } from "src/models/tiles/table-link-types";

interface IProps {
  isLinkButtonEnabled?: boolean;
  onLinkTableButtonClick?: (isLinkEnabled: boolean, showLinkTableDialog: ()=>void) => void;
  //useTableLinking
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  // actionHandlers?: IToolbarActionHandlers;
}

export const DataflowLinkTableButton: React.FC<IProps> = (props: IProps) => {
  const { isLinkButtonEnabled, onLinkTableButtonClick, model, onRequestTilesOfType, documentId } = props;
  // console.log("<DataflowLinkTableButton> with model:", model);
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });

  const { isLinkEnabled, showLinkTableDialog } = useTableLinking({
                                       documentId,
                                       model,
                                       onRequestTilesOfType
                                     });
  // const { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkTableDialog } = testReturn;
  console.log("<DataflowLinkTableButton>");
  // console.log("typeof showLinkButton", typeof showLinkButton);
  // console.log("typeof getLinkIndex", typeof getLinkIndex);
  console.log("tyopeof showLinkTableDialog", typeof showLinkTableDialog);


  const handleClick = (e: React.MouseEvent) => {
    isLinkButtonEnabled && documentId && onLinkTableButtonClick?.(isLinkEnabled, showLinkTableDialog);
    e.stopPropagation();
  };

  //

  // console.log("useFeatureFlag: geometryLinkedTables?", useFeatureFlag("GeometryLinkedTables"));
  // console.log(testReturn);
  // console.log("<DataflowLinkTableButton> with props:", showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkTableDialog);

  return useFeatureFlag("DataflowLinkedTables") //change to DataflowLinkedTable
          ? <div
              key="table-link-button"
              className={classes}
              data-testid="table-link-button"
              onClick={handleClick}
            >
              <LinkTableIcon />
            </div>
          : null;
};
