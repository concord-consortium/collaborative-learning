import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { SimpleDocumentItem } from "../thumbnail/simple-document-item";
import { DocumentGroup } from "../../models/stores/document-group";
import { IDocumentMetadataModel } from "../../models/document/document-metadata-model";

import ScrollArrowIcon from "../../assets/workspace-instance-scroll.svg";

import "./document-group.scss";

interface IProps {
  documentGroup: DocumentGroup;
  secondarySort: string;
  onSelectDocument: (document: IDocumentMetadataModel) => void;
}

export const DocumentGroupComponent = observer(function DocumentGroupComponent(props: IProps) {
  const { documentGroup, secondarySort, onSelectDocument } = props;
  const docBoxWidth = 16;
  const docBoxGap = 10;
  const scrollUnit = docBoxWidth + docBoxGap;
  const docCount = documentGroup.documents.length || 0;
  const isUnsorted = secondarySort === "None";
  const docListContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [leftArrowDisabled, setLeftArrowDisabled] = useState(true);
  const [rightArrowDisabled, setRightArrowDisabled] = useState(false);

  // Each document in the group is represented by a square box. The group of document boxes is displayed in
  // a single row. If there are more boxes than can fit within the row's width, scroll buttons are added
  // to either side of the list so the user can scroll through it.
  const handleScroll = (direction: "left" | "right") => {
    if (docListContainerRef.current) {
      const scrollAmount = visibleCount * scrollUnit;
      docListContainerRef.current.scrollBy({
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
      const count = Math.floor(containerWidth / scrollUnit);
      setVisibleCount(count);
    }
  }, [containerWidth, scrollUnit]);

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
  }, [visibleCount, scrollUnit]);

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
      {visibleCount < docCount && renderScrollButton("left", leftArrowDisabled)}
      <div ref={docListContainerRef} className="doc-group-list simple" data-testid="doc-group-list">
        {documentGroup.documents?.map((doc) => {
          return (
            <SimpleDocumentItem
              key={doc.key}
              document={doc}
              onSelectDocument={onSelectDocument}
            />
          );
        })}
      </div>
      {visibleCount < docCount && renderScrollButton("right", rightArrowDisabled)}
      {!isUnsorted && <div className="doc-group-count" data-testid="doc-group-count">{docCount}</div>}
    </div>
  );
});
