import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";
import { DocumentDragKey, SupportPublication } from "../../models/document/document-types";
import { useAppConfig, useUIStore, useUserStore } from "../../hooks/use-stores";
import { ISubTabSpec, NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentModelType } from "../../models/document/document";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";
import { DocumentCollectionByType } from "./documents-type-collection";

interface IProps {
  setCollectionElement?: (element: HTMLDivElement) => void;
  subTab: ISubTabSpec;
  tabSpec: NavTabModelType;
  selectedDocument?: string;
  selectedSecondaryDocument?: string;
  horizontal?: boolean;
  collapsed?: boolean;
  scrollToLocation?: number;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
}

export const kNavItemScale = 0.11;

export const DocumentCollectionList: React.FC<IProps> = observer(function DocumentCollectionList(
    { setCollectionElement, subTab, tabSpec, horizontal, collapsed, selectedDocument, selectedSecondaryDocument,
        onSelectNewDocument, onSelectDocument }) {
  const ui = useUIStore();
  const appConfigStore = useAppConfig();
  const user = useUserStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);

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
    <div className={classNames("doc-collection-list", { horizontal, collapsed })}
        ref={element => element && setCollectionElement?.(element)}>
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
              selectedSecondaryDocument={selectedSecondaryDocument}
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
