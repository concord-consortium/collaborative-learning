import React from "react";
import classNames from "classnames";
import LinkTableIcon from "../../assets/icons/link-table-icon.svg"; //we may need to change to icon with icon up
import { useDocumentFromStore, useFeatureFlag, useStores } from "../../../../hooks/use-stores";
import { useTableLinking } from "../dataflow-use-table-linking";
import { ITileModel } from "src/models/tiles/tile-model";

import "./dataflow-program-link-table-button.scss";
import { ITileLinkMetadata } from "src/models/tiles/table-link-types";

interface IProps {
  isLinkButtonEnabled?: boolean;
  onLinkTableButtonClick?: (documentID: string, isLinkEnabled: boolean, getLinkIndex: boolean) => void;
  //useTableLinking
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  // actionHandlers?: IToolbarActionHandlers;

}

export const DataflowLinkTableButton: React.FC<IProps> = (props: IProps) => {
  const { isLinkButtonEnabled, onLinkTableButtonClick, model, onRequestTilesOfType, documentId } = props;
  console.log("<DataflowLinkTableButton> with model:", model);
  const classes = classNames("link-table-button", { disabled: !isLinkButtonEnabled });

  // //find documentId to pass
  const store = useStores();
  const currentDocumentIndex = store.documents.all.length -  1;
  const currentDocumentKey = store.documents.all[currentDocumentIndex].key;
  console.log("currentDocumentKey", currentDocumentKey);

  const testReturn = useTableLinking({
                                       documentId,
                                       model,
                                       onRequestTilesOfType
                                     });
  const  {isLinkEnabled, getLinkIndex} = testReturn;

  const handleClick = (e: React.MouseEvent) => {
    isLinkButtonEnabled && documentId && onLinkTableButtonClick?.(documentId, isLinkEnabled, getLinkIndex);
    e.stopPropagation();
  };

  //

  // console.log("useFeatureFlag: geometryLinkedTables?", useFeatureFlag("GeometryLinkedTables"));
  // console.log(testReturn);
  console.log(documentId, isLinkEnabled, getLinkIndex);

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
