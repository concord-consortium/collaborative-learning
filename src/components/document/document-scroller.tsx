import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { clamp } from "lodash";

import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DocumentGroup } from "../../models/stores/document-group";
import { ENavTab } from "../../models/view/nav-tabs";
import { getPixelWidthFromCSSStyle } from "../../utilities/js-utils";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { DocumentScrollerHeader } from "./document-scroller-header";
import { IOpenDocumentsGroupMetadata } from "./sorted-section";

import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";

import styles from "../vars.scss";
import "./document-scroller.scss";

const documentThumbnailListPadding = getPixelWidthFromCSSStyle(styles.documentThumbnailListPadding) || 1;

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
  const { getOrCreateTabState, thumbnailDisplay } = persistentUI;
  const largeThumbnails = thumbnailDisplay === "Large";
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const documentListRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);
  const scrollWidth = documentListRef.current?.scrollWidth ?? 0;
  const maxScrollTo = scrollWidth - panelWidth;

  const handleSelectDocument = async (document: DocumentModelType) => {
    const tabState = getOrCreateTabState(ENavTab.kSortWork);
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

  // Subract an extra pixel to ensure both large thumbnails can fit in the width area
  const largeThumbnailWidth = Math.floor(panelWidth / 2 - documentThumbnailListPadding - 1);
  const thumbnailAspectRatio = 0.87; // height / width
  const largeThumbnailHeight = largeThumbnailWidth * thumbnailAspectRatio;
  const thumbnailStyle = largeThumbnails ? {
    height: `${largeThumbnailHeight}px`,
    width: `${largeThumbnailWidth}px`
  } : undefined;
  const renderThumbnail = (docKey: string) => {
    const fullDocument = getDocument(docKey);
    const thumbnailClass = classNames("document-thumbnail", { selected: docKey === openDocumentKey });
    return (
      fullDocument &&
        <div key={docKey} className={thumbnailClass} data-testid="document-thumbnail" style={thumbnailStyle}>
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

  const scrollerClasses = classNames("document-thumbnail-scroller", { "large-thumbnails": largeThumbnails });
  return (
    <>
      <DocumentScrollerHeader
        documentGroup={documentGroup}
        nextDocumentsGroup={nextDocumentsGroup}
        openDocumentKey={openDocumentKey}
        openGroupMetadata={openGroupMetadata}
        previousDocumentsGroup={previousDocumentsGroup}
      />
      <div ref={documentScrollerRef} className={scrollerClasses} data-testid="document-thumbnail-scroller">
        {!largeThumbnails && scrollToLocation > 0 &&
          <button className="scroll-arrow left" data-testid="scroll-arrow-left" onClick={handleScrollTo("left")}>
            <ScrollArrowIcon />
          </button>
        }
        <div ref={documentListRef} className="document-thumbnail-list documents-list">
          {documentGroup?.documents.map((doc) => (
            renderThumbnail(doc.key)
          ))}
        </div>
        {!largeThumbnails && scrollToLocation < maxScrollTo &&
          <button className="scroll-arrow right" data-testid="scroll-arrow-right" onClick={handleScrollTo("right")}>
            <ScrollArrowIcon />
          </button>
        }
      </div>
    </>
  );
});
