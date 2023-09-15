import React, { useRef, useState } from "react";

import { useCustomModal } from "./use-custom-modal";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import MergeInIcon from "../../src/plugins/data-card/assets/merge-in-icon.svg";


import "./link-tile-dialog.scss";

interface IContentProps {
  selectValue: string;
  hostTileTitle?: string;
  mergableTiles: ITileLinkMetadata[];
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps> = ({ selectValue, hostTileTitle, mergableTiles, setSelectValue })=> {
  const selectElt = useRef<HTMLSelectElement>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectValue(e.target.value);
    setTimeout(() => selectElt.current?.focus());
  };

  const renderOptionsGroup = () => {
    if (!mergableTiles || mergableTiles.length < 1) return null;

    return (
      <optgroup label="select data source">
        {mergableTiles.map(tileInfo => {
          return (
            <option key={tileInfo.id} value={tileInfo.id}>
              {tileInfo.id}
            </option>
          );
        })}
      </optgroup>
    );
  };

  return (
    <>
      <div className="message">
        Select a data source from the list to add data to { hostTileTitle }.
      </div>
      <select value={selectValue} onChange={handleSelectChange}>
        <option key="prompt" value={""}>Select a data source</option>
        { renderOptionsGroup() }
      </select>
    </>
  );
};

interface IProps {
  mergableTiles: ITileLinkMetadata[];
  model: ITileModel;
  onMergeTile: (tileInfo: ITileLinkMetadata) => void;
}
export const useMergeTileDialog = ({ mergableTiles, model, onMergeTile }: IProps) => {
  const hostTileTitle = model.title;
  const [selectValue, setSelectValue] = useState("");

  const handleClickMerge = () => {
    const selectedTileInfo = mergableTiles.find(tile => tile.id === selectValue);
    selectedTileInfo && onMergeTile(selectedTileInfo);
  };

  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: MergeInIcon,
    title: "Add data from...",
    Content,
    contentProps: { selectValue, hostTileTitle, mergableTiles, setSelectValue },
    buttons: [
      {
        label: "Cancel", onClick: () => hideModal()
      },
      {
        label: "Add Data",
        isDefault: true,
        onClick: handleClickMerge
      }
    ]
  }, [mergableTiles]);

  return [showModal, hideModal];
};
