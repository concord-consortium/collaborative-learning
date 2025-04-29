import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { DocumentModelType } from "../../models/document/document";
import { useStores } from "../../hooks/use-stores";
import { DocFilterType, SecondarySortType } from "../../models/stores/ui-types";
import { DocumentGroup } from "../../models/stores/document-group";
import { DocumentGroupComponent } from "./document-group";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { ENavTab } from "../../models/view/nav-tabs";
import { IDocumentMetadataModel } from "../../models/stores/sorted-documents";

import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./sorted-section.scss";

interface IProps {
  docFilter: DocFilterType;
  documentGroup: DocumentGroup;
  idx: number;
  secondarySort: SecondarySortType;
}

export interface IOpenDocumentsGroupMetadata {
  primaryType: string;
  primaryLabel: string;
  secondaryType?: string;
  secondaryLabel?: string;
}

export const SortedSection: React.FC<IProps> = observer(function SortedSection(props: IProps) {
  const { docFilter, documentGroup, idx, secondarySort } = props;
  const { persistentUI, sortedDocuments, ui } = useStores();
  const { expandedSortWorkSections, setExpandedSortWorkSections, setHighlightedSortWorkDocument } = ui;
  const showDocuments = expandedSortWorkSections.includes(documentGroup.label);
  const documentCount = documentGroup.documents?.length || 0;

  const getDocument = (docKey: string) => {
    const document = sortedDocuments.documents.all.find((doc: DocumentModelType) => doc.key === docKey);
    if (document) return document;

    // Calling `fetchFullDocument` will update the `documents` store with the full document,
    // triggering a re-render of this component since it's an observer.
    sortedDocuments.fetchFullDocument(docKey);
  };

  const handleSelectDocument = (docGroup: DocumentGroup) => {
    const { label, sortType } = docGroup;
    const openDocGroupMetadata: IOpenDocumentsGroupMetadata = secondarySort === "None"
                               ? { primaryLabel: label, primaryType: sortType }
                               : { primaryLabel: documentGroup.label, primaryType: documentGroup.sortType,
                                   secondaryLabel: label, secondaryType: sortType };

    return async (document: DocumentModelType | IDocumentMetadataModel) => {
      // The sort work tab stores the group metadata as the document group id.
      // This way it can record both the primary and secondary filter values
      // associated with the group.
      // TODO: create different tabState and/or document group types so these
      // values can be stored as fields in the document group
      const documentGroupId = JSON.stringify(openDocGroupMetadata);
      const tabState = persistentUI.getOrCreateTabState(ENavTab.kSortWork);
      tabState.openDocumentGroupPrimaryDocument(documentGroupId, document.key);
      setHighlightedSortWorkDocument(document.key);
      logDocumentViewEvent(document);
    };
  };

  const handleToggleShowDocuments = () => {
    setExpandedSortWorkSections(documentGroup.label, !showDocuments);
  };

  const renderUngroupedDocument = (doc: IDocumentMetadataModel) => {
    const fullDocument = getDocument(doc.key);
    if (!fullDocument) return <div key={doc.key} className="loading-spinner"/>;
    return <DecoratedDocumentThumbnailItem
             key={doc.key}
             scale={0.1}
             document={fullDocument}
             tab={ENavTab.kSortWork}
             shouldHandleStarClick
             allowDelete={false}
             selectedDocument={ui.highlightedSortWorkDocument}
             onSelectDocument={handleSelectDocument(documentGroup)}
           />;
  };

  const renderList = () => {
    if (docFilter === "Problem" && secondarySort === "None") {
      return documentGroup.documents.map(renderUngroupedDocument);
    }

    const renderDocumentGroup = (group: DocumentGroup) => (
      <DocumentGroupComponent
        key={`${group.label}-${group.sortType}`}
        documentGroup={group}
        secondarySort={secondarySort}
        onSelectDocument={handleSelectDocument(group)}
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
      <div className="documents-list" data-testid="section-document-list">
        {showDocuments && renderList()}
      </div>
    </div>
  );
});
