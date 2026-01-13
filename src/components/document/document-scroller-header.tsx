import classNames from "classnames";
import React from "react";

import { useStores } from "../../hooks/use-stores";
import { DocumentGroup } from "../../models/stores/document-group";
import { ENavTab } from "../../models/view/nav-tabs";
import { IOpenDocumentsGroupMetadata } from "./sorted-section";

import SwitchSortGroupIcon from "../../assets/scroll-arrow-small-current-color-icon.svg";

import "./document-scroller-header.scss";

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
export function DocumentScrollerHeader({
  documentGroup, nextDocumentsGroup, openDocumentKey, openGroupMetadata, previousDocumentsGroup
}: IDocumentScrollerHeaderProps) {
  const { persistentUI } = useStores();
  const { primarySortBy, secondarySortBy } = persistentUI;
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
      <div className="header-text">
        Sorted by
        <span className="sort-type"> {primarySortBy}: </span>
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
        {" "}
        { hasSecondarySort && (
          <>
            <span className="sort-type"> {secondarySortBy}: </span>
            {hasSecondarySort && (
              <SwitchSortGroupButton
                direction="left"
                disabled={!previousDocumentsGroup}
                onClick={switchSortGroup("previous")}
              />
            )}
            <span className="sort-label">{documentGroup?.label ?? ""}</span>
            {hasSecondarySort && (
              <SwitchSortGroupButton
                direction="right"
                disabled={!nextDocumentsGroup}
                onClick={switchSortGroup("next")}
              />
            )}
          </>
        )}
      </div>
      <div className="header-text">
        Shown for <span>{persistentUI.docFilter}</span>
      </div>
    </div>
  );
}
