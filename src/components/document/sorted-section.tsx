import React, { useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { DocumentModelType } from "../../models/document/document";
import { useStores } from "../../hooks/use-stores";
import { DocFilterType, SecondarySortType } from "../../models/stores/ui-types";
import { IDocumentMetadata } from "../../../shared/shared";
import { DocumentGroup } from "../../models/stores/document-group";
import { DocumentGroupComponent } from "./document-group";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { ENavTab } from "../../models/view/nav-tabs";

import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./sorted-section.scss";

interface IProps {
  docFilter: DocFilterType;
  documentGroup: DocumentGroup;
  idx: number;
  secondarySort: SecondarySortType;
}

export const SortedSection: React.FC<IProps> = observer(function SortedSection(props: IProps) {
  const { docFilter, documentGroup, idx, secondarySort } = props;
  const { persistentUI, sortedDocuments } = useStores();
  const [showDocuments, setShowDocuments] = useState(false);
  const documentCount = documentGroup.documents?.length || 0;

  const getDocument = (docKey: string) => {
    const document = sortedDocuments.documents.all.find((doc: DocumentModelType) => doc.key === docKey);
    if (document) return document;

    // Calling `fetchFullDocument` will update the `documents` store with the full document,
    // triggering a re-render of this component since it's an observer.
    sortedDocuments.fetchFullDocument(docKey);

    return undefined;
  };

  const handleSelectDocument = async (document: DocumentModelType | IDocumentMetadata) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
    logDocumentViewEvent(document);
  };

  const handleToggleShowDocuments = () => {
    setShowDocuments(!showDocuments);
  };

  const renderUngroupedDocument = (doc: IDocumentMetadata) => {
    const fullDocument = getDocument(doc.key);
    if (!fullDocument) return <div key={doc.key} className="loading-spinner"/>;

    return <DecoratedDocumentThumbnailItem
             key={doc.key}
             scale={0.1}
             document={fullDocument}
             tab={ENavTab.kSortWork}
             shouldHandleStarClick
             allowDelete={false}
             onSelectDocument={handleSelectDocument}
           />;
  };

  const renderList = () => {
    if (docFilter === "Problem" && secondarySort === "None") {
      return documentGroup.documents.map(renderUngroupedDocument);
    }

    const renderDocumentGroup = (group: DocumentGroup) => (
      <DocumentGroupComponent
        key={group.label}
        documentGroup={group}
        secondarySort={secondarySort}
        onSelectDocument={handleSelectDocument}
      />
    );

    return secondarySort === "None"
      ? renderDocumentGroup(documentGroup)
      : documentGroup.sortBy(secondarySort).map(renderDocumentGroup);
  };

  const sectionClasses = classNames("sorted-sections", {"show-documents": showDocuments});

  return (
    <div className={sectionClasses} key={`documentGroup-${idx}`}>
      <div className="section-header">
        <div className="section-header-label">
        <div className="section-header-left">
          {documentGroup.icon && <documentGroup.icon/>} {documentGroup.label}
        </div>
        <div className="section-header-right">
          <div>Total workspaces: {documentCount}</div>
          <ArrowIcon
            className={classNames("section-header-arrow", {up: showDocuments})}
            onClick={handleToggleShowDocuments}
          />
        </div>
        </div>
      </div>
      {secondarySort !== "None" &&
        <div className="section-sub-header" data-testid="section-sub-header">
          {secondarySort}
        </div>
      }
      <div className="list" data-testid="section-document-list">
        {showDocuments && renderList()}
      </div>
    </div>
  );
});
