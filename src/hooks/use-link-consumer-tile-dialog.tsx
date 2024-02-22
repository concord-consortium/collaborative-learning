import React, { useRef, useState } from "react";
import { IModalButton, useCustomModal } from "./use-custom-modal";
import { isLinkedToTile } from "../models/shared/shared-data-utils";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { SharedModelType } from "../models/shared/shared-model";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import { BadgedIcon } from "../components/toolbar/badged-icon";
// import { logSharedModelDocEvent } from "../models/document/log-shared-model-document-event";
// import { LogEventName } from "../lib/logger-types";


import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";
import ViewBadgeIcon from "../assets/icons/view/view-badge.svg";

import "./link-tile-dialog.scss";


// Defines a modal window that allows the user to select a tile
// to link with or unlink from the current tile's dataset.
// If a single tile type is supplied as an argument, an option to
// create a new tile of that type will be offered as well.

interface IContentProps {
  linkedTiles: ITileLinkMetadata[];
  selectValue: string;
  tileTitle?: string;
  unlinkedTiles: ITileLinkMetadata[];
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
  tileType?: string;
}


  //**************************************** GUIDELINES ************************************************
  // LinkTable button
  // Graph iT! Button

const Content: React.FC<IContentProps>
              = ({ linkedTiles, selectValue, tileTitle, unlinkedTiles, setSelectValue, tileType })=> {
  /**
   * Content for the link/unlink/create modal dialog.
   */
  const displayTileTitle = tileTitle || "this tile";
  const selectElt = useRef<HTMLSelectElement>(null);

  let instructions, defaultOption;
  if (tileType) {
    const lcTileType = tileType.toLowerCase();
    instructions = `Select a ${lcTileType} to link or unlink.`;
    defaultOption = `Select a ${lcTileType}`;
  } else {
    instructions = `To link ${displayTileTitle} to another tile, select a tile from the link list.
     To unlink ${displayTileTitle} from another tile, select a tile from the unlink list.`;
     defaultOption = 'Select a tile';
  }

  const hasNewOption = !!tileType;
  const hasLinkOptions = unlinkedTiles.length > 0;
  const hasUnlinkOptions = linkedTiles.length > 0;

  const separator = <option disabled>──────────────────────────────</option>;

  return (
    <>
      <div className="prompt">
        {instructions}
      </div>
      <select ref={selectElt} value={selectValue} data-test="link-tile-select"
        onChange={e => {
          setSelectValue(e.target.value);
          setTimeout(() => selectElt.current?.focus());
        }}>
        <option key="prompt" value="">{defaultOption}</option>
        {hasNewOption && <option key="new" value="NEW">New {tileType}</option>}
        {hasNewOption && (hasLinkOptions || hasUnlinkOptions) && separator }
        {hasLinkOptions &&
          <optgroup label="Link">
            {unlinkedTiles
              .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
          </optgroup>
        }
        {hasLinkOptions && hasUnlinkOptions && separator }
        {hasUnlinkOptions &&
          <optgroup label="Unlink">
            {linkedTiles
              .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
          </optgroup>
        }
      </select>
    </>
  );
};

interface IProps {
  linkableTiles: ITileLinkMetadata[];
  model: ITileModel;
  modelToShare?: SharedModelType;
  tileType?: string;
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
  onCreateTile: () => void;
}
export const useLinkConsumerTileDialog =
    ({ linkableTiles, model, modelToShare, tileType, onLinkTile, onUnlinkTile, onCreateTile }: IProps) => {
  const tileTitle = model.computedTitle;
  const [selectValue, setSelectValue] = useState("");

  const handleClick = () => {
    if (selectValue === 'NEW') {
      onCreateTile();
    } else {
      const tileInfo = linkableTiles.find(tile => tile.id === selectValue);
      if (tileInfo && modelToShare) {
        if (isLinkedToTile(modelToShare, tileInfo.id)) {
          onUnlinkTile(tileInfo);
        } else {
          onLinkTile(tileInfo);
        }
      }
    }
  };
  const unlinkedTiles = linkableTiles
    .filter(tileInfo => modelToShare && !isLinkedToTile(modelToShare, tileInfo.id));
  const linkedTiles = linkableTiles
    .filter(tileInfo => modelToShare && isLinkedToTile(modelToShare, tileInfo.id) && tileInfo.id !== model.id);

  const primaryButtonText = modelToShare && isLinkedToTile(modelToShare, selectValue)
    ? 'Clear It!'
    : tileType ? `${tileType} It!` : 'Link';

  // Builds an appopriate icon for the dialog.
  // Alternatively, we could consider requiring the caller to pass in an icon.
  const Icon: React.FC<any> = () => {
    const baseIcon = tileType && getTileComponentInfo(tileType)?.Icon;
    if (baseIcon) {
      return <BadgedIcon Icon={baseIcon} Badge={ViewBadgeIcon}/>;
    } else {
      return <LinkGraphIcon/>;
    }
  };

  const buttons: IModalButton[] = [
    { label: "Cancel" },
    {
      label: primaryButtonText,
      isDefault: true,
      isDisabled: !selectValue,
      onClick: handleClick
    }];
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon,
    title: tileType ? `${tileType} It!` : "Link or Unlink Tile",
    Content,
    contentProps: { linkedTiles, selectValue, tileTitle, tileType, unlinkedTiles, setSelectValue },
    buttons
  }, [linkableTiles]);

  return [showModal, hideModal];
};
