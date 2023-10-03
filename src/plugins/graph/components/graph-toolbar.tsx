import React from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import { observer } from "mobx-react";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
  } from "../../../components/tiles/hooks/use-floating-toolbar-location";
import { IGraphModel } from "../models/graph-model";
import { ITileModel } from "../../../models/tiles/tile-model";
import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";

import "./graph-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  content: IGraphModel;
  documentId?: string;
  isLinkEnabled: boolean;
  model: ITileModel;
  onLinkTableButtonClick: () => void;
}

export const GraphToolbar: React.FC<IProps> = observer(({
  documentContent, documentId, isLinkEnabled, tileElt, content, model,
  onIsEnabled, onLinkTableButtonClick, ...others
}) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    tileElt,
                    toolbarHeight: 38,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });

  const handleLinkTileButtonClick = (e: React.MouseEvent) => {
    isLinkEnabled && onLinkTableButtonClick();
    e.stopPropagation();
  };

  return documentContent
    ? ReactDOM.createPortal(
        <div className={classNames("graph-toolbar", { disabled: !enabled || !location })}
              data-testid="graph-toolbar" style={location}
              onMouseDown={e => e.stopPropagation()}>
          <div className="toolbar-buttons">
            <div key="link-tile-button"
              className={classNames("button link-tile-button", { disabled: !isLinkEnabled })}
              data-testid="link-tile-button"
              onClick={handleLinkTileButtonClick}
            >
              <LinkTableIcon />
            </div>
          </div>
        </div>, documentContent)
    : null;
});
