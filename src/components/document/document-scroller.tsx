import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { clamp } from "lodash";

import { DocumentGroup } from "../../models/stores/document-group";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { ENavTab } from "../../models/view/nav-tabs";
import { logDocumentViewEvent } from "../../models/document/log-document-event";

import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";

import "./document-scroller.scss";

interface IProps {
  documentGroup?: DocumentGroup;
}

export const DocumentScroller: React.FC<IProps> = observer(function DocumentThumbnailCarousel(props: IProps) {
  const { documentGroup } = props;
  const { documents, networkDocuments, persistentUI, sortedDocuments } = useStores();
  const tabState = persistentUI.tabs.get(ENavTab.kSortWork);
  const openDocumentKey = tabState?.openSubTab && tabState?.openDocuments.get(tabState.openSubTab);
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const documentListRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);
  const scrollWidth = documentListRef.current?.scrollWidth ?? 0;
  const maxScrollTo = scrollWidth - panelWidth;

  const handleSelectDocument = async (document: DocumentModelType) => {
    if (!tabState?.openSubTab) {
      console.error("No openSubTab found in persistentUI");
      return;
    }
    persistentUI.openSubTabDocument(ENavTab.kSortWork, tabState?.openSubTab, document.key);
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

  return (
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
  );
});
