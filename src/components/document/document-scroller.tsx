import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { clamp } from "lodash";

import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DocumentGroup } from "../../models/stores/document-group";
import { ENavTab } from "../../models/view/nav-tabs";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { IOpenDocumentsGroupMetadata } from "./sorted-section";

import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";
import SwitchSortGroupIcon from "../../assets/scroll-arrow-small-current-color-icon.svg";

import "./document-scroller.scss";

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

interface IProps {
  documentGroup?: DocumentGroup;
  nextDocumentsGroup?: DocumentGroup;
  openDocumentKey?: string;
  openGroupMetadata?: IOpenDocumentsGroupMetadata;
  previousDocumentsGroup?: DocumentGroup;
}

export const DocumentScroller: React.FC<IProps> = observer(function DocumentThumbnailCarousel(props: IProps) {
  const { documentGroup, nextDocumentsGroup, openDocumentKey, openGroupMetadata, previousDocumentsGroup } = props;
  const { documents, networkDocuments, persistentUI, sortedDocuments } = useStores();
  const { primarySortBy, secondarySortBy } = persistentUI;
  const hasSecondarySort = secondarySortBy !== "None";
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const documentListRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);
  const scrollWidth = documentListRef.current?.scrollWidth ?? 0;
  const maxScrollTo = scrollWidth - panelWidth;

  const handleSelectDocument = async (document: DocumentModelType) => {
    const tabState = persistentUI.getOrCreateTabState(ENavTab.kSortWork);
    if (!tabState.currentDocumentGroupId) {
      console.error("No currentDocumentGroupId found in persistentUI");
      return;
    }
    tabState.openDocumentGroupPrimaryDocument(tabState.currentDocumentGroupId, document.key);
    logDocumentViewEvent(document);
  };

  const handleScrollTo = (side: string) => () => {
    const direction = side === "left" ? -1 : 1;
    const attemptedScrollTo = scrollToLocation + direction * panelWidth;
    const scrollTo = clamp(attemptedScrollTo, 0, maxScrollTo);
    setScrollToLocation(scrollTo);
  };

  const getDocument = (docKey: string) => {
    const openDoc = documents.getDocument(docKey) || networkDocuments.getDocument(docKey);
    if (openDoc) {
      return openDoc;
    }

    // Calling `fetchFullDocument` will update the `documents` store with the full document,
    // triggering a re-render of this component since it's an observer.
    sortedDocuments.fetchFullDocument(docKey);
  };

  const renderThumbnail = (docKey: string) => {
    const fullDocument = getDocument(docKey);
    const thumbnailClass = classNames("document-thumbnail", { selected: docKey === openDocumentKey });
    return (
      fullDocument &&
        <div key={docKey} className={thumbnailClass} data-testid="document-thumbnail">
          <DecoratedDocumentThumbnailItem
            key={docKey}
            scale={0.1}
            document={fullDocument}
            tab={ENavTab.kSortWork}
            shouldHandleStarClick
            allowDelete={false}
            onSelectDocument={handleSelectDocument}
          />
        </div>
    );
  };

  useEffect(() => {
    if (scrollToLocation !== undefined) {
      documentListRef.current?.scrollTo({left: scrollToLocation, behavior: "smooth"});
    }
  },[scrollToLocation]);

  // Keep track of the size of the containing element
  useEffect(() => {
    let obs: ResizeObserver;
    if (documentScrollerRef.current) {
      obs = new ResizeObserver(() => {
        setPanelWidth(documentScrollerRef.current?.clientWidth ?? 0);
      });
      obs.observe(documentScrollerRef.current);
    }

    return () => obs?.disconnect();
  }, []);

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

  const renderHeader = () => {
    if (!openDocumentKey) return;

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
  };

  return (
    <>
      {renderHeader()}
      <div ref={documentScrollerRef} className="document-thumbnail-scroller" data-testid="document-thumbnail-scroller">
        {scrollToLocation > 0 &&
          <button className="scroll-arrow left" data-testid="scroll-arrow-left" onClick={handleScrollTo("left")}>
            <ScrollArrowIcon />
          </button>
        }
        <div ref={documentListRef} className="document-thumbnail-list documents-list">
          {documentGroup?.documents.map((doc) => (
            renderThumbnail(doc.key)
          ))}
        </div>
        {scrollToLocation < maxScrollTo &&
          <button className="scroll-arrow right" data-testid="scroll-arrow-right" onClick={handleScrollTo("right")}>
            <ScrollArrowIcon />
          </button>
        }
      </div>
    </>
  );
});
