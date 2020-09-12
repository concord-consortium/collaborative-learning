import React from "react";
import { useAppConfigStore } from "../../hooks/use-stores";
import { EContentTab, ContentTabSpec } from "../../models/view/left-tabs";
import { DocumentTabPanel } from "../navigation/document-tab-panel";
import { EditableDocumentContent, IProps as IEditableDocumentContentProps } from "./editable-document-content";

interface IDocumentOrBrowserProps extends IEditableDocumentContentProps {
  showBrowser: boolean;
  tabSpec: ContentTabSpec;
}
export const DocumentOrBrowser: React.FC<IDocumentOrBrowserProps> = props => {
  const { showBrowser, tabSpec, ...others } = props;
  return showBrowser && tabSpec
          ? <DocumentTabPanel tabSpec={tabSpec} />
          : <EditableDocumentContent {...others} />;
};

function useTabSpec(tab: EContentTab) {
  const appConfig = useAppConfigStore();
  return appConfig.getLeftTabSpec(tab);
}

type IMyWorkDocumentOrBrowserProps = Omit<IDocumentOrBrowserProps, "tabSpec">;
export const MyWorkDocumentOrBrowser: React.FC<IMyWorkDocumentOrBrowserProps> = props => {
  const myWorkTabSpec = useTabSpec(EContentTab.kMyWork);
  return myWorkTabSpec ? <DocumentOrBrowser tabSpec={myWorkTabSpec} {...props} /> : null;
};
