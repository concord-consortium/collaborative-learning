import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { FunctionComponent, SVGProps } from "react";

import { useStores } from "../../hooks/use-stores";
import { DocumentGroup } from "../../models/stores/document-group";
import { ENavTab } from "../../models/view/nav-tabs";
import { isSortTypeId } from "../../models/stores/ui-types";
import { getSortTypeTranslationKey } from "../../utilities/sort-utils";
import { upperWords } from "../../utilities/string-utils";
import { translate } from "../../utilities/translation/translate";
import { IOpenDocumentsGroupMetadata } from "./sorted-section";

import LargeThumbnailsIcon from "../../assets/large-thumbnails-view-icon.svg";
import SmallThumbnailsIcon from "../../assets/small-thumbnails-view-icon.svg";
import SwitchSortGroupIcon from "../../assets/scroll-arrow-small-current-color-icon.svg";

import "./document-scroller-header.scss";

interface IThumbnailDisplayButtonProps {
  className?: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  selected?: boolean;
}
function ThumbnailDisplayButton({ className, Icon, onClick, selected }: IThumbnailDisplayButtonProps) {
  const buttonClassName = classNames("thumbnail-display-button", className, { selected });
  return (
    <button className={buttonClassName} onClick={onClick}>
      <Icon />
    </button>
  );
}

interface IArrowButtonProps {
  direction: "left" | "right";
  disabled?: boolean;
  onClick: () => void;
}
function SwitchSortGroupButton({ direction, disabled, onClick }: IArrowButtonProps) {
  const className = classNames("switch-sort-group-button", direction);
  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      <SwitchSortGroupIcon />
    </button>
  );
}

interface IDocumentScrollerHeaderProps {
  documentGroup?: DocumentGroup;
  nextDocumentsGroup?: DocumentGroup;
  openDocumentKey?: string;
  openGroupMetadata?: IOpenDocumentsGroupMetadata;
  previousDocumentsGroup?: DocumentGroup;
}
export const DocumentScrollerHeader = observer(function DocumentScrollerHeader({
  documentGroup, nextDocumentsGroup, openDocumentKey, openGroupMetadata, previousDocumentsGroup
}: IDocumentScrollerHeaderProps) {
  const { persistentUI } = useStores();
  const { primarySortBy, secondarySortBy, thumbnailDisplay } = persistentUI;
  const primarySortByLabel = isSortTypeId(primarySortBy)
    ? upperWords(translate(getSortTypeTranslationKey(primarySortBy)))
    : primarySortBy;
  const secondarySortByLabel = isSortTypeId(secondarySortBy)
    ? upperWords(translate(getSortTypeTranslationKey(secondarySortBy)))
    : secondarySortBy;
  const hasSecondarySort = secondarySortBy !== "None";

  const switchSortGroup = (direction: "previous" | "next") => () => {
    const newDocumentGroup = direction === "previous" ? previousDocumentsGroup : nextDocumentsGroup;
    const newKey = newDocumentGroup?.documents[0]?.key;
    const newSubTab = hasSecondarySort
      ? { ...openGroupMetadata, secondaryType: newDocumentGroup?.sortType, secondaryLabel: newDocumentGroup?.label }
      : { primaryType: newDocumentGroup?.sortType, primaryLabel: newDocumentGroup?.label };
    const newSubTabString = JSON.stringify(newSubTab);
    if (newKey) {
      persistentUI.openDocumentGroupPrimaryDocument(ENavTab.kSortWork, newSubTabString, newKey);
    }
  };

  if (!openDocumentKey) return null;

  const primaryLabelClass = classNames({ "sort-label": !hasSecondarySort });
  return (
    <div className="document-scroller-header">
      <div className="left-group">
        <div className="thumbnail-display-buttons">
          <ThumbnailDisplayButton
            className="left small-thumbnails"
            Icon={SmallThumbnailsIcon}
            onClick={() => persistentUI.setThumbnailDisplay("Small")}
            selected={thumbnailDisplay === "Small"}
          />
          <ThumbnailDisplayButton
            className="right large-thumbnails"
            Icon={LargeThumbnailsIcon}
            onClick={() => persistentUI.setThumbnailDisplay("Large")}
            selected={thumbnailDisplay === "Large"}
          />
        </div>
        <div className="divider" />
        <div className="header-text">
          Sorted by
          <span className="sort-type"> {primarySortByLabel}: </span>
          {!hasSecondarySort && (
            <SwitchSortGroupButton
              direction="left"
              disabled={!previousDocumentsGroup}
              onClick={switchSortGroup("previous")}
            />
          )}
          <span className={primaryLabelClass}>{openGroupMetadata?.primaryLabel ?? ""}</span>
          {!hasSecondarySort && (
            <SwitchSortGroupButton
              direction="right"
              disabled={!nextDocumentsGroup}
              onClick={switchSortGroup("next")}
            />
          )}
          { hasSecondarySort && (
            <>
              {" "}
              <span className="sort-type"> {secondarySortByLabel}: </span>
              <SwitchSortGroupButton
                direction="left"
                disabled={!previousDocumentsGroup}
                onClick={switchSortGroup("previous")}
              />
              <span className="sort-label">{documentGroup?.label ?? ""}</span>
              <SwitchSortGroupButton
                direction="right"
                disabled={!nextDocumentsGroup}
                onClick={switchSortGroup("next")}
              />
            </>
          )}
        </div>
      </div>
      <div className="header-text">
        Shown for <span>{persistentUI.docFilter}</span>
      </div>
    </div>
  );
});
