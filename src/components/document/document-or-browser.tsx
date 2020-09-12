import React from "react";
import { useAppConfigStore } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { ENavTab, NavTabSpec } from "../../models/view/left-tabs";
import { DocumentTabPanel } from "../navigation/document-tab-panel";
import { EditableDocumentContent, IProps as IEditableDocumentContentProps } from "./editable-document-content";

interface IDocumentOrBrowserProps extends IEditableDocumentContentProps {
  showBrowser: boolean;
  tabSpec: NavTabSpec;
  onSelectDocument?: (document: DocumentModelType) => void;
}
export const DocumentOrBrowser: React.FC<IDocumentOrBrowserProps> = props => {
  const { showBrowser, tabSpec, onSelectDocument, ...others } = props;
  return showBrowser && tabSpec
          ? <DocumentTabPanel tabSpec={tabSpec} onDocumentClick={onSelectDocument} />
          : <EditableDocumentContent {...others} />;
};

function useTabSpec(tab: ENavTab) {
  const appConfig = useAppConfigStore();
  return appConfig.getNavTabSpec(tab);
}

type IMyWorkDocumentOrBrowserProps = Omit<IDocumentOrBrowserProps, "tabSpec">;
export const MyWorkDocumentOrBrowser: React.FC<IMyWorkDocumentOrBrowserProps> = props => {
  const myWorkTabSpec = useTabSpec(ENavTab.kMyWork);
  return myWorkTabSpec ? <DocumentOrBrowser tabSpec={myWorkTabSpec} {...props} /> : null;
};
