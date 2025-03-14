import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";
import { useAppConfig, useUserStore } from "../../hooks/use-stores";
import { ISubTabModel, NavTabModelType } from "../../models/view/nav-tabs";
import { DocumentModelType } from "../../models/document/document";
import { DocumentCollectionByType } from "./documents-type-collection";

interface IProps {
  setCollectionElement?: (element: HTMLDivElement) => void;
  subTab: ISubTabModel;
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
        onSelectNewDocument, onSelectDocument}) {
  const appConfigStore = useAppConfig();
  const user = useUserStore();
  const navTabSpec = appConfigStore.navTabs.getNavTabSpec(tabSpec.tab);

  return (
    <div className={classNames("doc-collection-list", {horizontal, collapsed})}
        ref={element => element && setCollectionElement?.(element)}>
      {
        subTab.sections.map((section, index) => {
          const shouldHandleStarClick = section.showStarsForUser(user);

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
              shouldHandleStarClick={shouldHandleStarClick}
              allowDelete={section.allowDelete}
            />
          );
        })
      }
    </div>);
});
