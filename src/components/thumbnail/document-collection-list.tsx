import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef } from "react";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { useAppConfig, useUIStore, useUserStore } from "../../hooks/use-stores";
import { ISubTabSpec, NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentModelType } from "../../models/document/document";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";
import { DocumentCollectionByType } from "./documents-type-collection";

interface IProps {
  subTab: ISubTabSpec;
  tabSpec: NavTabModelType;
  selectedDocument?: string;
  horizontal?: boolean;
  collapsed?: boolean;
  scrollToLocation?: number;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
  setScrollWidth?: (scrollWidth: number) => void;
  setScrollLeft?: (scrollLeft: number) => void;
}

export const kNavItemScale = 0.11;

export const DocumentCollectionList: React.FC<IProps> = observer(function DocumentCollectionList(
    { subTab, tabSpec, horizontal, collapsed, selectedDocument, scrollToLocation,
      onSelectNewDocument, onSelectDocument, setScrollWidth,  setScrollLeft}) {
  const ui = useUIStore();
  const appConfigStore = useAppConfig();
  const user = useUserStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);
  const documentListRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const documentListEl = documentListRef.current;
    if (documentListEl) {
      setScrollWidth && setScrollWidth(documentListEl.scrollWidth);
      setScrollLeft && setScrollLeft(documentListEl.scrollLeft);
    }
  }, [documentListRef, setScrollLeft, setScrollWidth]);

  const handleBrowserScroll = useCallback((documentListEl: HTMLDivElement) => (evt: any) => {
    console.log("in handle browser scroll");
    setScrollWidth && setScrollWidth(documentListEl.scrollWidth);
    setScrollLeft && setScrollLeft(documentListEl.scrollLeft);
  },[setScrollLeft, setScrollWidth]);
  // console.log("documentListEl.scrollWidth", documentListRef.current?.scrollWidth);
  // console.log("documentListEl.scrollLeft", documentListRef.current?.scrollLeft);
  console.log("in doc-coll-list scrollToLocation", scrollToLocation);

  useEffect(()=>{
    console.log("in doc-coll-list useEffect", scrollToLocation);
    if(scrollToLocation) {
      documentListRef.current?.scrollBy({left: scrollToLocation, behavior: "smooth"});
    }
  },[scrollToLocation]);


  useEffect(()=>{
    const documentListEl = documentListRef.current;
    if (documentListEl) {
      documentListEl.addEventListener("scroll", handleBrowserScroll(documentListEl));
    }
    return () => {
      documentListEl?.removeEventListener("scroll",  handleBrowserScroll(documentListEl));
    };
  },[handleBrowserScroll]);

  const handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  };

  const handleDocumentStarClick = (document: DocumentModelType) => {
    document?.toggleUserStar(user.id);
  };

  const handleDocumentDeleteClick = (document: DocumentModelType) => {
    ui.confirm("Do you want to delete this?", "Confirm Delete")
      .then(ok => {
        if (ok) {
          document.setProperty("isDeleted", "true");
          if (document.type === SupportPublication) {
            logDocumentEvent(LogEventName.DELETE_SUPPORT, { document });
          }
        }
      });
  };

  return (
    <div className={`doc-collection-list ${horizontal ? "horizontal" : ""} ${collapsed ? "collapsed" : ""}`}
        ref={documentListRef}>
      {
        subTab.sections.map((section: any, index: any) => {
          const _handleDocumentStarClick = section.showStarsForUser(user)
            ? handleDocumentStarClick
            : undefined;

          return (
            <DocumentCollectionByType
              key={`${section.type}_${index}`}
              topTab={navTabSpec?.tab}
              tab={subTab.label}
              section={section}
              index={index}
              horizontal={horizontal}
              numSections={subTab.sections.length}
              scale={kNavItemScale}
              selectedDocument={selectedDocument}
              onSelectNewDocument={onSelectNewDocument}
              onSelectDocument={onSelectDocument}
              onDocumentDragStart={handleDocumentDragStart}
              onDocumentStarClick={_handleDocumentStarClick}
              onDocumentDeleteClick={handleDocumentDeleteClick}
            />
          );
        })
      }
    </div>);
});
