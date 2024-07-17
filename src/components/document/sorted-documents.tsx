import React, { useState } from "react";
import { observer } from "mobx-react";
import { DocumentContextReact } from "./document-context";
import classNames from "classnames";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
import { SortedDocument } from "../../models/stores/sorted-documents";
import { DocumentModelType, getDocumentContext } from "../../models/document/document";
import { DecoratedDocumentThumbnailItem } from "../thumbnail/decorated-document-thumbnail-item";
import { useStores } from "../../hooks/use-stores";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { ENavTab } from "../../models/view/nav-tabs";

import "./sort-work-view.scss";

interface IProps {
  idx: number;
  sortedSection: SortedDocument
}

export const SortedDocuments: React.FC<IProps> = observer(function SortedDocuments(props: IProps) {
  const { idx, sortedSection } = props;
  const { persistentUI } = useStores();

  const [showDocuments, setShowDocuments] = useState(false);

  const handleSelectDocument = (document: DocumentModelType) => {
    persistentUI.openSubTabDocument(ENavTab.kSortWork, ENavTab.kSortWork, document.key);
    logDocumentViewEvent(document);
  };

  const handleArrowClick = () => {
    setShowDocuments(!showDocuments);
  };

  return (
    <div className="sorted-sections" key={`sortedSection-${idx}`}>
      <div className="section-header">
        <div className="section-header-label">
        <div className="section-header-right">{sortedSection.icon ? <sortedSection.icon/>: null} {sortedSection.sectionLabel}</div>
        <div className="section-header-left">
          <div>Total workspaces: {sortedSection.documents.length}</div>
          <ArrowIcon className={classNames("section-header-arrow", {up: showDocuments})} onClick={handleArrowClick}/>
        </div>
        </div>
      </div>
      <div className="list">
        {showDocuments && sortedSection.documents.map((doc: any, sortIdx: number) => {
          const documentContext = getDocumentContext(doc);
          return (
            <DocumentContextReact.Provider key={doc.key} value={documentContext}>
              <DecoratedDocumentThumbnailItem
                key={doc.key}
                scale={0.1}
                document={doc}
                tab={ENavTab.kSortWork}
                shouldHandleStarClick={true}
                allowDelete={false}
                onSelectDocument={handleSelectDocument}
              />
            </DocumentContextReact.Provider>
          );
        })}
      </div>
    </div>
  );
});
