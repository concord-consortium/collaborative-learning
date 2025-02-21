import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { clamp } from "lodash";
import { DocumentModelType } from "../../models/document/document";
import { ISubTabModel, NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentCollectionList } from "../thumbnail/document-collection-list";
import ScrollArrowIcon from "../../assets/scroll-arrow-icon.svg";
import CollapseScrollerIcon from "../../assets/show-hide-document-view-icon.svg";

import "./document-browser-scroller.scss";

interface DocumentBrowserScrollerProps {
  subTab: ISubTabModel;
  tabSpec: NavTabModelType;
  openDocumentKey: string;
  openSecondaryDocumentKey: string;
  onSelectDocument: (document: DocumentModelType) => void;
}

export const DocumentBrowserScroller =
    ({subTab, tabSpec, openDocumentKey, openSecondaryDocumentKey, onSelectDocument}: DocumentBrowserScrollerProps) => {
  const [scrollerCollapsed, setScrollerCollapsed] = useState(false);
  const [collectionElement, setCollectionElement] = useState<HTMLDivElement>();
  const documentScrollerRef = useRef<HTMLDivElement>(null);
  const [scrollToLocation, setScrollToLocation] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);

  const scrollWidth = collectionElement?.scrollWidth ?? 0;
  const maxScrollTo = scrollWidth - panelWidth;

  useEffect(() => {
    if(scrollToLocation !== undefined) {
      collectionElement?.scrollTo({left: scrollToLocation, behavior: "smooth"});
    }
  },[collectionElement, scrollToLocation]);

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

  const handleScrollTo = (side: string) => {
    const direction = side === "left" ? -1 : 1;
    const attemptedScrollTo = scrollToLocation + direction * panelWidth;
    const scrollTo = clamp(attemptedScrollTo, 0, maxScrollTo);
    setScrollToLocation(scrollTo);
  };

  const handleCollapseScroller = () => {
    setScrollerCollapsed(!scrollerCollapsed);
  };

  return (
    <>
      <div className={classNames("document-scroller", tabSpec.tab, {"collapsed": scrollerCollapsed})}
          ref={documentScrollerRef}>
        <DocumentCollectionList
            setCollectionElement={setCollectionElement}
            subTab={subTab}
            tabSpec={tabSpec}
            horizontal={true}
            collapsed={scrollerCollapsed}
            selectedDocument={openDocumentKey}
            selectedSecondaryDocument={openSecondaryDocumentKey}
            scrollToLocation={scrollToLocation}
            onSelectDocument={onSelectDocument}
        />
        {(scrollToLocation > 0) && !scrollerCollapsed &&
            <ScrollEndControl side={"left"} tab={tabSpec.tab} onScroll={handleScrollTo} />
        }
        {(scrollToLocation < maxScrollTo) && !scrollerCollapsed &&
            <ScrollEndControl side={"right"} tab={tabSpec.tab} onScroll={handleScrollTo} />
        }
      </div>
      <div className={classNames("collapse-scroller-button", "themed", tabSpec.tab,
                {"collapsed": scrollerCollapsed})} onClick={handleCollapseScroller}>
        <CollapseScrollerIcon className={`scroller-icon ${tabSpec.tab}`}/>
      </div>
    </>
  );
};

interface IScrollEndControlProps {
  side: "right" | "left";
  tab: string;
  onScroll: (side: string) => void
}

const ScrollEndControl = ({side, tab, onScroll}: IScrollEndControlProps) => {
  return (
    <div className={classNames("scroller-controls", side)}>
      <ScrollButton side={side} theme={tab} onClick={() => onScroll(side)} />
    </div>
  );
};

interface IScrollButtonProps {
  className?: classNames.Argument;
  onClick: () => void;
  side: "right" | "left";
  theme: string;
}

export const ScrollButton = ({className, onClick, side, theme}: IScrollButtonProps) => {
  return (
    <div className={classNames("scroll-arrow-button", "themed", theme, side, className)}
          onClick={onClick}>
      <ScrollArrowIcon className={classNames("scroll-arrow-icon", "themed", theme, side)} />
    </div>
  );
};
