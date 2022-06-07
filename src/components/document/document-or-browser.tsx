import React from "react";
import { useAppConfig } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, PersonalDocument, ProblemDocument } from "../../models/document/document-types";
import { ENavTab, ENavTabSectionType, NavTabSpec } from "../../models/view/nav-tabs";
import { SectionDocumentOrBrowser } from "../navigation/section-document-or-browser";
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
  tabSpec?: NavTabSpec;
  onSelectNewDocument?: (type: string) => void;
  onSelectDocument?: (document: DocumentModelType) => void;
}
export const DocumentOrBrowser: React.FC<IDocumentOrBrowserProps> = props => {
  const { showBrowser, tabSpec, document, onSelectNewDocument, onSelectDocument, ...others } = props;
  return showBrowser && tabSpec
          ? <SectionDocumentOrBrowser tabSpec={tabSpec}
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
  return <DocumentOrBrowser tabSpec={myWorkTabSpec} {...props} />;
};
