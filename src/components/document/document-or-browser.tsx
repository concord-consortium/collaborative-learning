import React from "react";
import { useAppConfig } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, PersonalDocument, ProblemDocument } from "../../models/document/document-types";
import { getNavTabConfigFromStores } from "../../models/stores/stores";
import { ENavTab, ENavTabSectionType, NavTabSpec } from "../../models/view/nav-tabs";
import { DocumentTabPanel } from "../navigation/document-tab-panel";
import { EditableDocumentContent, IProps as IEditableDocumentContentProps } from "./editable-document-content";

function getSectionForDocument(document: DocumentModelType) {
  const kDocTypeToSection: Record<string, ENavTabSectionType> = {
    [ProblemDocument]: ENavTabSectionType.kProblemDocuments,
    [PersonalDocument]: ENavTabSectionType.kPersonalDocuments,
    [LearningLogDocument]: ENavTabSectionType.kLearningLogs
  };
  return kDocTypeToSection[document.type];
}

interface IDocumentOrBrowserProps extends IEditableDocumentContentProps {
  showBrowser: boolean;
  tabSpec: NavTabSpec;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
}
export const DocumentOrBrowser: React.FC<IDocumentOrBrowserProps> = props => {
  const { showBrowser, tabSpec, document, onSelectNewDocument, onSelectDocument, ...others } = props;
  return showBrowser && tabSpec
          ? <DocumentTabPanel tabSpec={tabSpec}
              selectedDocument={document.key}
              selectedSection={getSectionForDocument(document)}
              onSelectNewDocument={onSelectNewDocument}
              onSelectDocument={onSelectDocument} />
          : <EditableDocumentContent document={document} {...others} />;
};

function useTabSpec(tab: ENavTab) {
  return useAppConfig().navTabs.getNavTabSpec(tab);
}

type IMyWorkDocumentOrBrowserProps = Omit<IDocumentOrBrowserProps, "tabSpec">;
export const MyWorkDocumentOrBrowser: React.FC<IMyWorkDocumentOrBrowserProps> = props => {
  const myWorkTabSpec = useTabSpec(ENavTab.kMyWork);
  return myWorkTabSpec ? <DocumentOrBrowser tabSpec={myWorkTabSpec} {...props} /> : null;
};
