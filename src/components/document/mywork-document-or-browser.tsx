import React from "react";
import { useAppConfig } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { ENavTab } from "../../models/view/nav-tabs";
import { SubTabsPanel } from "../navigation/sub-tabs-panel";
import { DocumentCollectionList } from "../thumbnail/document-collection-list";
import { EditableDocumentContent, IProps as IEditableDocumentContentProps } from "./editable-document-content";

interface IProps extends IEditableDocumentContentProps {
  showBrowser: boolean;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
}

export const MyWorkDocumentOrBrowser: React.FC<IProps> = props => {
  const navTabs = useAppConfig().navTabs;
  const myWorkTabSpec = navTabs.getNavTabSpec(ENavTab.kMyWork);
  const { showBrowser, document, onSelectNewDocument, onSelectDocument, ...others } = props;

  if (showBrowser && myWorkTabSpec) {
    // If we are re-rendered and showBrowser is true then we will will always
    // re-render the SubTabsPanel because of the renderSubTabPanel property.
    // However since we are passing most of our props to DocumentCollectionList
    // it is likely that every re-render will be because one of these props
    // changed and we need to re-render the SubTabsPanel anyhow.
    return (
      <SubTabsPanel tabSpec={myWorkTabSpec} renderSubTabPanel={(subTab) => (
        <div>
          <DocumentCollectionList
            subTab={subTab}
            tabSpec={myWorkTabSpec}
            onSelectNewDocument={onSelectNewDocument}
            onSelectDocument={onSelectDocument}
          />
        </div>
      )} />
    );
  } else {
    return <EditableDocumentContent document={document} idClass="my-work" {...others} />;
  }
};
