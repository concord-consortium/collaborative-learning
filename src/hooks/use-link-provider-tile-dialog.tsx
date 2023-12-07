import React, { useRef, useState } from "react";
import { useCustomModal } from "./use-custom-modal";
import { ITileModel } from "../models/tiles/tile-model";
import { SharedModelType } from "../models/shared/shared-model";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";

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
  const displayTileTitle = tileTitle || "this tile";
  const selectElt = useRef<HTMLSelectElement>(null);

  return (
      <>
        <div className="prompt">
          To link {displayTileTitle} to a data provider, select a data provider from the link list.
          To unlink {displayTileTitle} from a data provider, select a data provider from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-tile-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a data provider</option>
            {unlinkedSharedModels.length > 0 &&
              <optgroup label="Link Tile">
                {unlinkedSharedModels
                  .map(m => <option key={m.id} value={m.id}>{labelFunction(m)}</option>)}
              </optgroup>
            }
            {(linkedSharedModels.length > 0) && (unlinkedSharedModels.length > 0) &&
              <option disabled>──────────────────────────────</option> }
            {linkedSharedModels.length > 0 &&
                <optgroup label="Unlink Tile">
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
  const sharedModelManager = getSharedModelManager(model);
  const currentTileModels = (sharedModelManager?.isReady) ? sharedModelManager.getTileSharedModels(model.content) : [];
  const linkedSharedModels   = sharedModels.filter(m => currentTileModels.includes(m));
  const unlinkedSharedModels = sharedModels.filter(m => !currentTileModels.includes(m));

  const handleClick = () => {
    const chosen = sharedModels.find(m => m.id === selectValue);
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
    title: "Link or Unlink Data Provider",
    Content,
    contentProps: { labelFunction, unlinkedSharedModels, linkedSharedModels,
      selectValue, tileTitle, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: selectedModel && linkedSharedModels.includes(selectedModel) ? "Unlink" : "Link",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [sharedModels]);

  return [showModal, hideModal];
};
