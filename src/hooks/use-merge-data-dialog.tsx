import React, { useState } from "react";
import { useCustomModal } from "./use-custom-modal";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { getTileModelById } from "../utilities/mst-utils";
import MergeInIcon from "../../src/assets/icons/dataset/merge-in-icon.svg";

import "./link-tile-dialog.scss";

interface IContentProps {
  model: ITileModel;
  selectValue: string;
  hostTileTitle?: string;
  mergableTiles: ITileLinkMetadata[];
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps> = ({
  model, selectValue, hostTileTitle, mergableTiles, setSelectValue
}) => {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectValue(e.target.value);
  };

  const mergableTilesInfo = mergableTiles.map(tileInfo => {
    if (tileInfo.title) return tileInfo;
    if (!tileInfo.title && tileInfo.providerId) {
      const tileModel = getTileModelById(model.content, tileInfo.providerId);
      return { ...tileInfo, title: tileModel?.computedTitle };
    }
  });

  return (
    <>
      <div className="prompt">
        Select a data source from the list to add data to { hostTileTitle ?? "this tile" }.
      </div>
      <select className="merge-data-select" value={selectValue} onChange={handleSelectChange}>
        <option key="prompt" value={""}>Select a data source</option>
        { mergableTilesInfo.length > 0 &&
          mergableTilesInfo.map(tileInfo => {
            return tileInfo && tileInfo.title && (
              <option key={tileInfo.id} value={tileInfo.id}>
                { tileInfo.title }
              </option>
            );
          })
        }
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
  const hostTileTitle = model.computedTitle;
  const [selectValue, setSelectValue] = useState("");

  const handleClickMerge = () => {
    const selectedTile = mergableTiles.find(tile => tile.id === selectValue);
    selectedTile && onMergeTile(selectedTile);
  };

  const [showModal, hideModal] = useCustomModal({
    className: "merge-tile",
    Icon: MergeInIcon,
    title: "Add data from...",
    Content,
    contentProps: { model, selectValue, hostTileTitle, mergableTiles, setSelectValue },
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
  }, [model, selectValue, hostTileTitle, mergableTiles, setSelectValue]);

  return [showModal, hideModal];
};
