import React, { useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { useStores } from "../../hooks/use-stores";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { ENavTab } from "../../models/view/nav-tabs";
import { DocFilterType, SecondarySortType } from "../../models/stores/ui-types";
import { SimpleDocumentItem } from "../thumbnail/simple-document-item";
import { IDocumentMetadata } from "../../../functions/src/shared";
import { DocumentContextReact } from "./document-context";
import { DocumentCollection } from "../../utilities/sort-document-utils";
import { DocumentGroup } from "../../models/stores/sorted-documents-documents-group";

import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./sorted-section.scss";

interface IProps {
  docFilter: DocFilterType;
  documentGroup: DocumentGroup;
  idx: number;
  secondarySort: SecondarySortType;
}

export const SortedSection: React.FC<IProps> = observer(function SortedDocuments(props: IProps) {
  const { docFilter, documentGroup, idx, secondarySort } = props;
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
    const downloadedDocs = documentGroup.metaDataDocs?.filter((doc: IDocumentMetadata) => getDocument(doc.key)) ?? [];
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
    if (docFilter === "Problem" && secondarySort === "byNone") {
      const fullDocument = docFilter === "Problem" ? getDocument(doc.key) : undefined;
      if (!fullDocument) return <div className="loading-spinner"/>;

      return <DecoratedDocumentThumbnailItem
          scale={0.1}
          document={fullDocument}
          tab={ENavTab.kSortWork}
          shouldHandleStarClick={true}
          allowDelete={false}
          onSelectDocument={handleSelectDocument}
        />;
    } else {
      return <SimpleDocumentItem
              document={doc}
              investigationOrdinal={doc.investigation}
              problemOrdinal={doc.problem}
              onSelectDocument={handleSelectDocument}
            />;
    }
  };

  const renderList = () => {
    if (secondarySort !== "byNone") {
      return documentGroup[secondarySort]?.map((group: DocumentCollection) => {
        return (
          <div key={group.label} className="doc-group">
            <div className="doc-group-sub-group-label">{group.label}</div>
            {group.documents?.map((doc: any) => {
              const documentContext = getDocumentContext(doc);
              return (
                <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                  {renderDocumentItem(doc)}
                </DocumentContextReact.Provider>
              );
            })}
          </div>
        );
      });
    } else {
      return (
        <div className="doc-group">
          {documentGroup.metaDataDocs?.map((doc: any) => {
            const documentContext = getDocumentContext(doc);
            return (
              <DocumentContextReact.Provider key={doc.key} value={documentContext}>
                {renderDocumentItem(doc)}
              </DocumentContextReact.Provider>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className="sorted-sections" key={`documentGroup-${idx}`}>
      <div className="section-header">
        <div className="section-header-label">
        <div className="section-header-left">
          {documentGroup.icon ? <documentGroup.icon/>: null} {documentGroup.label}
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
        {showDocuments && renderList()}
      </div>
    </div>
  );
});
