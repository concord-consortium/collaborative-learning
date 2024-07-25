import React, { useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { DocumentContextReact } from "./document-context";
import { SortedDocument } from "../../models/stores/sorted-documents";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { useStores } from "../../hooks/use-stores";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocFilterType } from "../../models/stores/ui-types";
import { SimpleDocumentItem } from "../thumbnail/simple-document-item";
import { IDocumentMetadata } from "../../../functions/src/shared";

import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./sort-work-view.scss";

interface IProps {
  docFilter: DocFilterType;
  idx: number;
  sortedSection: SortedDocument
}

export const SortedDocuments: React.FC<IProps> = observer(function SortedDocuments(props: IProps) {
  const { docFilter, idx, sortedSection } = props;
  const { persistentUI, sortedDocuments } = useStores();
  const [showDocuments, setShowDocuments] = useState(false);

  const getDocument = (docKey: string) => {
    const document = sortedDocuments.documents.all.find((doc: DocumentModelType) => doc.key === docKey);
    if (document) return document;

    // Calling `fetchFullDocument` will update the `documents` store with the full document,
    // triggering a re-render of this component since its an observer.
    sortedDocuments.fetchFullDocument(docKey);

    return undefined;
  };

  const documentCount = () => {
    const downloadedDocs = sortedSection.documents.filter(doc => getDocument(doc.key));
    return downloadedDocs.length;
  };

  const handleSelectDocument = async (document: DocumentModelType | IDocumentMetadata) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
    logDocumentViewEvent(document);
  };

  const handleToggleShowDocuments = () => {
    setShowDocuments(!showDocuments);
  };

  const renderDocumentItem = (doc: any) => {
    const fullDocument = getDocument(doc.key);
    if (docFilter === "Problem" && fullDocument) {
      return <DecoratedDocumentThumbnailItem
          scale={0.1}
          document={fullDocument}
          tab={ENavTab.kSortWork}
          shouldHandleStarClick={true}
          allowDelete={false}
          onSelectDocument={handleSelectDocument}
        />;
    } else if (docFilter === "Problem") {
      return <div className="loading-spinner"/>;
    } else {
      return <SimpleDocumentItem
              document={doc}
              investigationOrdinal={doc.investigation}
              problemOrdinal={doc.problem}
              onSelectDocument={handleSelectDocument}
            />;
    }
  };

  return (
    <div className="sorted-sections" key={`sortedSection-${idx}`}>
      <div className="section-header">
        <div className="section-header-label">
        <div className="section-header-left">
          {sortedSection.icon ? <sortedSection.icon/>: null} {sortedSection.sectionLabel}
        </div>
        <div className="section-header-right">
          <div>Total workspaces: {documentCount()}</div>
          <ArrowIcon
            className={classNames("section-header-arrow", {up: showDocuments})}
            onClick={handleToggleShowDocuments}
          />
        </div>
        </div>
      </div>
      <div className="list">
        {showDocuments && sortedSection.documents.map((doc: any, sortIdx: number) => {
          const documentContext = getDocumentContext(doc);
          return (
            <DocumentContextReact.Provider key={doc.key} value={documentContext}>
              {renderDocumentItem(doc)}
            </DocumentContextReact.Provider>
          );
        })}
      </div>
    </div>
  );
});
