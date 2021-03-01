import React, { useRef, useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { ITileLinkMetadata } from "../../../models/tools/table/table-model-types";

import "./link-geometry-dialog.scss";
import { TableContentModelType } from "../../../models/tools/table/table-content";

interface IContentProps {
  unlinkedGeometryTiles: ITileLinkMetadata[];
  linkedGeometryTiles: ITileLinkMetadata[];
  selectValue: string;
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps>
              = ({ unlinkedGeometryTiles, linkedGeometryTiles, selectValue, setSelectValue })=> {
  const selectElt = useRef<HTMLSelectElement>(null);

    return (
      <>
        <div className="prompt">
          To link this table to a graph, drag the table to a graph or select a graph from the link list.
          To unlink this table from a graph, select a graph from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-graph-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a graph</option>
            {(unlinkedGeometryTiles.length > 0) &&
              <optgroup label="Link Graphs">
                {unlinkedGeometryTiles
                  .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
              </optgroup>
            }
            {(linkedGeometryTiles.length > 0) &&
              <React.Fragment>
                <option disabled>──────────────────────────────</option>
                <optgroup label="Unlink Graphs">
                  {linkedGeometryTiles
                    .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
                </optgroup>
              </React.Fragment>
            }
        </select>
      </>
    );
};

interface IProps {
  geometryTiles: ITileLinkMetadata[];
  model: ToolTileModelType;
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
  onUnlinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}
export const useLinkGeometryDialog = ({ geometryTiles, model, onLinkGeometryTile, onUnlinkGeometryTile }: IProps) => {
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const tileInfo = geometryTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (content.metadata.linkedGeometries.indexOf(tileInfo.id) < 0) {
        onLinkGeometryTile(tileInfo);
      } else {
        onUnlinkGeometryTile(tileInfo);
      }
    }
  };
  const content = model.content as TableContentModelType;
  const unlinkedGeometryTiles = geometryTiles
                                  .filter(tileInfo => content.metadata.linkedGeometries.indexOf(tileInfo.id) < 0);
  const linkedGeometryTiles = geometryTiles
                                  .filter(tileInfo => content.metadata.linkedGeometries.indexOf(tileInfo.id) >= 0);
  const [showModal, hideModal] = useCustomModal({
    className: "link-geometry",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Table to a Graph",
    Content,
    contentProps: { unlinkedGeometryTiles, linkedGeometryTiles, selectValue, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: "OK", isDefault: true, isDisabled: !selectValue, onClick: handleClick }
    ]
  }, [geometryTiles]);

  return [showModal, hideModal];
};
