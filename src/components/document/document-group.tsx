import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { SimpleDocumentItem } from "../thumbnail/simple-document-item";
import { DocumentGroup } from "../../models/stores/document-group";
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";
import { sortDocumentsInGroup } from "../../utilities/sort-document-utils";

import ScrollArrowIcon from "../../assets/workspace-instance-scroll.svg";

import "./document-group.scss";

interface IProps {
  documentGroup: DocumentGroup;
  secondarySort: string;
  onSelectDocument: (document: IDocumentMetadataModel) => void;
}

// A document box and the gap that follows it, matching the box size and `column-gap` of
// `.doc-group-list.simple` in document-group.scss. The row scrolls in whole units of this.
const kDocBoxWidth = 16;
const kDocBoxGap = 10;
export const kScrollUnit = kDocBoxWidth + kDocBoxGap;

export const DocumentGroupComponent = observer(function DocumentGroupComponent(props: IProps) {
  const { documentGroup, secondarySort, onSelectDocument } = props;
  const docCount = documentGroup.documents.length || 0;
  const isUnsorted = secondarySort === "None";
  const docListContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [leftArrowDisabled, setLeftArrowDisabled] = useState(true);
  const [rightArrowDisabled, setRightArrowDisabled] = useState(false);
  const sortedGroupDocuments = sortDocumentsInGroup(documentGroup);
  // Gate on visibleCount > 0: before the ResizeObserver fires, the row has no measured width, so
  // there is nothing to scroll by — a silent no-op click. Render the buttons only once we have a
  // measurement, so a click always actually scrolls.
  const showScrollButtons = visibleCount > 0 && visibleCount < docCount;

  // Each document in the group is represented by a square box. The group of document boxes is displayed in
  // a single row. If there are more boxes than can fit within the row's width, scroll buttons are added
  // to either side of the list so the user can scroll through it.
  const handleScroll = (direction: "left" | "right") => {
    const docListContainer = docListContainerRef.current;
    if (docListContainer) {
      // The row's width changes as the scroll buttons take their place beside it, so both directions
      // measure at click time: they have to move by the same amount for the row to reach its start
      // again. Whole boxes only, so a click never leaves one half out of view.
      const scrollAmount = Math.floor(docListContainer.clientWidth / kScrollUnit) * kScrollUnit;
      docListContainer.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  // Set up a resize observer for responding to changes to the document list container's width.
  useEffect(() => {
    const docListContainer = docListContainerRef.current;

    const updateWidth = () => {
      if (docListContainer) {
        setContainerWidth(docListContainer.offsetWidth);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (docListContainer) {
      resizeObserver.observe(docListContainer);
    }

    return () => {
      if (docListContainer) {
        resizeObserver.unobserve(docListContainer);
      }
    };
  }, []);

  // Calculate the number of visible documents based on the current container width
  useEffect(() => {
    if (docListContainerRef.current) {
      const count = Math.floor(containerWidth / kScrollUnit);
      setVisibleCount(count);
    }
  }, [containerWidth]);

  // Update arrow button states based on scroll position.
  useEffect(() => {
    const updateArrowStates = () => {
      if (docListContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = docListContainerRef.current;
        setLeftArrowDisabled(scrollLeft === 0);
        setRightArrowDisabled(scrollLeft + clientWidth >= scrollWidth);
      }
    };

    const docListContainer = docListContainerRef.current;
    if (docListContainer) {
      updateArrowStates();
      docListContainer.addEventListener("scroll", updateArrowStates);

      return () => {
        docListContainer.removeEventListener("scroll", updateArrowStates);
      };
    }
  }, [visibleCount]);

  const renderScrollButton = (direction: "left" | "right", disabled: boolean) => {
    return (
      <button
        className={`scroll-button scroll-${direction}`}
        data-testid={`scroll-button-${direction}`}
        disabled={disabled}
        onClick={() => handleScroll(direction)}
      >
        <ScrollArrowIcon />
      </button>
    );
  };

  return (
    <div key={documentGroup.label} className="doc-group" data-testid="doc-group">
      {!isUnsorted &&
        <div className="doc-group-label" data-testid="doc-group-label">
          {documentGroup.icon ? <documentGroup.icon className="tool-icon"/> : null}{documentGroup.label}
        </div>
      }
      {showScrollButtons && renderScrollButton("left", leftArrowDisabled)}
      <div ref={docListContainerRef} className="doc-group-list simple" data-testid="doc-group-list">
        {sortedGroupDocuments?.map((doc) => {
          return (
            <SimpleDocumentItem
              key={doc.key}
              document={doc}
              onSelectDocument={onSelectDocument}
            />
          );
        })}
      </div>
      {showScrollButtons && renderScrollButton("right", rightArrowDisabled)}
      {!isUnsorted && <div className="doc-group-count" data-testid="doc-group-count">{docCount}</div>}
    </div>
  );
});
