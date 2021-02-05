import React, { useRef, useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { ITileLinkMetadata } from "../../../models/tools/table/table-model-types";

import "./link-geometry-dialog.scss";

interface IContentProps {
  geometryTiles: ITileLinkMetadata[];
  selectValue: string;
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps> = ({ geometryTiles, selectValue, setSelectValue }) => {
  const selectElt = useRef<HTMLSelectElement>(null);
  return (
    <>
      <div className="prompt">
        To link this table to a graph, drag the table to a graph or select a graph from this list.
      </div>
      <select ref={selectElt} value={selectValue}
                              onChange={e => {
                                setSelectValue(e.target.value);
                                setTimeout(() => selectElt.current?.focus());
                              }}>
        <option key="prompt" value={""}>Select a graph</option>
        {geometryTiles.map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
      </select>
    </>
  );
};

interface IProps {
  geometryTiles: ITileLinkMetadata[];
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}
export const useLinkGeometryDialog = ({ geometryTiles, onLinkGeometryTile }: IProps) => {
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const tileInfo = geometryTiles.find(tile => tile.id === selectValue);
    tileInfo && onLinkGeometryTile(tileInfo);
  };
  const [showModal, hideModal] = useCustomModal({
    className: "link-geometry",
    Icon: LinkGraphIcon,
    title: "Link Table to a Graph",
    Content,
    contentProps: { geometryTiles, selectValue, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: "Link Table", isDefault: true, isDisabled: !selectValue, onClick: handleClick }
    ]
  }, [geometryTiles]);

  return [showModal, hideModal];
};
