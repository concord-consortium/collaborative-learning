import * as React from "react";
import { CollapsibleSectionHeader } from "./collapsible-section-header";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType, isUnpublishedType, isPublishedType, isProblemType } from "../../models/document/document";
import { IStores } from "../../models/stores/stores";
import { NavTabSectionModelType } from "../../models/view/right-nav";
import { CanvasComponent } from "../document/canvas";
import { Icon } from "@blueprintjs/core";

interface IProps {
  tab: string;
  section: NavTabSectionModelType;
  stores: IStores;
  scale: number;
  isExpanded: boolean;
  onToggleExpansion: (sectionType: string) => void;
  onNewDocumentClick?: (sectionType: string, documentTypes: string[]) => void;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDragStart: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
}

function getSectionTitle(section: NavTabSectionModelType, stores: IStores) {
  if (section.title === "%abbrevInvestigation%") {
    const { unit, problem } = stores;
    const { abbrevTitle } = unit;
    const prefix = abbrevTitle ? `${abbrevTitle}: ` : "";
    // For now pull investigation number from problem title.
    // Teacher dashboard work adds investigation to store, at which
    // point it can be pulled from there directly.
    const problemChar0 = problem.title.length ? problem.title[0] : "";
    const investigationNum = problemChar0 >= "0" && problemChar0 <= "9" ? problemChar0 : "";
    return `${prefix}Investigation ${investigationNum}`;
  }
  return section.title;
}

function getDocumentCaption(section: NavTabSectionModelType, stores: IStores, document: DocumentModelType) {
  const { problem, class: _class } = stores;
  const { type, uid } = document;
  const user = _class && _class.getUserById(uid);
  const userName = user && user.displayName;
  const namePrefix = isPublishedType(type) ? `${userName}: ` : "";
  const title = isProblemType(type) ? problem.title : document.title;
  return `${namePrefix}${title}`;
}

export const DocumentsSection = ({ tab, section, stores, scale,
                                  isExpanded, onToggleExpansion,
                                  onDocumentClick, onDocumentDragStart,
                                  onNewDocumentClick, onDocumentStarClick }: IProps) => {
    const sectionTitle = getSectionTitle(section, stores);
    const { documents, user } = stores;
    const sectionDocs: DocumentModelType[] = [];

    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectionDocs.push(...documents.byTypeForUser(type as any, user.id));
      }
      else if (isPublishedType(type)) {
        sectionDocs.push(...documents.byType(type as any));
      }
    });

    function handleSectionHeaderClick() {
      onToggleExpansion && onToggleExpansion(section.type);
    }
    function handleNewDocumentClick() {
      onNewDocumentClick && onNewDocumentClick(section.type, section.documentTypes);
    }

    return (
      <div className={`${section.className}`} key={`${tab}-${section.type}`}>
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName={section.dataTestHeader}
          isExpanded={isExpanded} onClick={handleSectionHeaderClick}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {sectionDocs.map(document => {

            function handleDocumentClick() {
              onDocumentClick && onDocumentClick(document);
            }
            function handleDocumentDragStart(e: React.DragEvent<HTMLDivElement>) {
              onDocumentDragStart && onDocumentDragStart(e, document);
            }
            function handleDocumentStarClick() {
              onDocumentStarClick && onDocumentStarClick(document);
            }

            const isStarred = section.showStars
                                ? user.isTeacher
                                  ? !!document.stars.find(star => star.uid === user.id && star.starred)
                                  : !!document.stars.find(star => star.starred)
                                : false;
            const _handleDocumentStarClick = section.showStars && user.isTeacher
                                              ? handleDocumentStarClick
                                              : undefined;
            return (
              <ThumbnailDocumentItem
                key={document.key} dataTestName={`${tab}-list-items`}
                canvasContext={tab} document={document} scale={scale}
                captionText={getDocumentCaption(section, stores, document)}
                onDocumentClick={handleDocumentClick} onDocumentDragStart={handleDocumentDragStart}
                isStarred={isStarred} onDocumentStarClick={_handleDocumentStarClick} />
            );
          })}
          {section.addDocument
            ? <NewDocumentButtonComponent onClick={handleNewDocumentClick} />
            : null}
        </div>
      </div>
    );
  };

interface INewDocumentButtonProps {
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const NewDocumentButtonComponent = ({ onClick }: INewDocumentButtonProps) => {
  return (
    <div className="list-item" data-test="my-work-new-document" >
      <div
        className="scaled-list-item-container new-document-button"
        onClick={onClick} >
        <div className="scaled-list-item">
          <CanvasComponent context="my-work" readOnly={true} />
        </div>
        <div className="new-document-button-label">
          <Icon className="new-document-button-icon" icon="add" iconSize={26} />
          <label>New</label>
        </div>
      </div>
    </div>
  );
};
