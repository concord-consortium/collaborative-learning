import React, { useRef, useState } from "react";
import { useCustomModal } from "./use-custom-modal";
import { ITileModel } from "../models/tiles/tile-model";
import { SharedModelType } from "../models/shared/shared-model";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import LinkGraphIcon from "../assets/icons/add-data-graph-icon.svg";

import "./link-tile-dialog.scss";

interface IContentProps {
  labelFunction: (model: SharedModelType) => string;
  linkedSharedModels: SharedModelType[];
  unlinkedSharedModels: SharedModelType[];
  selectValue: string;
  tileTitle?: string;
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps>
              = ({ labelFunction, linkedSharedModels, unlinkedSharedModels,
                   selectValue, tileTitle, setSelectValue })=> {
  const selectElt = useRef<HTMLSelectElement>(null);

  const separator = <option disabled>──────────────────────────────</option>;

  return (
      <>
        <div className="prompt">
          Select a data or variables source to graph or clear:
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-tile-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a data or variables source</option>
            {unlinkedSharedModels.length > 0 &&
              <optgroup label="Link Source">
                {unlinkedSharedModels
                  .map(m => <option key={m.id} value={m.id}>{labelFunction(m)}</option>)}
              </optgroup>
            }
            {(linkedSharedModels.length > 0) && (unlinkedSharedModels.length > 0) && separator }
            {linkedSharedModels.length > 0 &&
                <optgroup label="Unlink Source">
                  {linkedSharedModels
                    .map(m => <option key={m.id} value={m.id}>{labelFunction(m)}</option>)}
                </optgroup>
            }
        </select>
      </>
  );
};

interface IProps {
  sharedModels: SharedModelType[];
  model: ITileModel;
  onLinkTile: (tileInfo: SharedModelType) => void;
  onUnlinkTile: (tileInfo: SharedModelType) => void;
}
export const useLinkProviderTileDialog = ({
  sharedModels, model, onLinkTile, onUnlinkTile
}: IProps) => {
  const tileTitle = model.computedTitle;
  const [selectValue, setSelectValue] = useState("");
  const selectedModel = sharedModels.find(m => m.id === selectValue);

  // console.log("📁 use-link-provider-tile-dialog.tsx ------------------------");
  // console.log("\t tileTitle:", tileTitle);
  // console.log("\t🥩 selectedModel:", selectedModel);

  const sharedModelManager = getSharedModelManager(model);
  const currentTileModels = (sharedModelManager?.isReady) ? sharedModelManager.getTileSharedModels(model.content) : [];
  const linkedSharedModels   = sharedModels.filter(m => currentTileModels.includes(m));
  const unlinkedSharedModels = sharedModels.filter(m => !currentTileModels.includes(m));
  //send the sharedModelType to getSharedModelProviders to get the tile
  //handle case of zero length array, 1 element, multiple elements -
  const handleClick = () => {
    const chosen = sharedModels.find(m => m.id === selectValue);
    // console.log("chosen:", chosen);
    //TODO: here is where you send the selectedTileId?
    if (chosen) {
      if (linkedSharedModels.includes(chosen)) {
        onUnlinkTile?.(chosen);
      } else {
        onLinkTile?.(chosen);
      }
    }
  };

  const labelFunction = (m: SharedModelType) => {
    if (sharedModelManager?.isReady) {
      return sharedModelManager.getSharedModelLabel(m);
    } else {
      return m.id;
    }
  };

  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: "Add Data and Variables",
    Content,
    contentProps: { labelFunction, unlinkedSharedModels, linkedSharedModels,
      selectValue, tileTitle, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: selectedModel && linkedSharedModels.includes(selectedModel) ? "Clear It!" : "Graph It!",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [sharedModels]);

  return [showModal, hideModal];
};
