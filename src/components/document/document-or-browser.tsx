import React from "react";
import { useAppConfigStore } from "../../hooks/use-stores";
import { ELeftTab, LeftTabSpec } from "../../models/view/left-tabs";
import { DocumentTabPanel } from "../navigation/document-tab-panel";
import { EditableDocumentContent, IProps as IEditableDocumentContentProps } from "./editable-document-content";

interface IDocumentOrBrowserProps extends IEditableDocumentContentProps {
  showBrowser: boolean;
  tabSpec: LeftTabSpec;
}
export const DocumentOrBrowser: React.FC<IDocumentOrBrowserProps> = props => {
  const { showBrowser, tabSpec, ...others } = props;
  return showBrowser && tabSpec
          ? <DocumentTabPanel tabSpec={tabSpec} />
          : <EditableDocumentContent {...others} />;
};

function useTabSpec(tab: ELeftTab) {
  const appConfig = useAppConfigStore();
  return appConfig.getLeftTabSpec(tab);
}

type IMyWorkDocumentOrBrowserProps = Omit<IDocumentOrBrowserProps, "tabSpec">;
export const MyWorkDocumentOrBrowser: React.FC<IMyWorkDocumentOrBrowserProps> = props => {
  const myWorkTabSpec = useTabSpec(ELeftTab.kMyWork);
  return myWorkTabSpec ? <DocumentOrBrowser tabSpec={myWorkTabSpec} {...props} /> : null;
};
