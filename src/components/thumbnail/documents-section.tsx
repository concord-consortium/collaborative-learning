import * as React from "react";
import { observer } from "mobx-react";
import { CollapsibleSectionHeader } from "./collapsible-section-header";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType, isUnpublishedType, isPublishedType, isProblemType, PublicationDocument, SupportPublication
      } from "../../models/document/document";
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
  onToggleExpansion: (section: NavTabSectionModelType) => void;
  onNewDocumentClick?: (section: NavTabSectionModelType) => void;
  onDocumentClick: (document: DocumentModelType) => void;
  onDocumentDragStart: (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => void;
  onDocumentStarClick?: (document: DocumentModelType) => void;
}

function getSectionTitle(section: NavTabSectionModelType, stores: IStores) {
  if (section.title === "%abbrevInvestigation%") {
    const { unit, investigation } = stores;
    const { abbrevTitle } = unit;
    const prefix = abbrevTitle ? `${abbrevTitle}: ` : "";
    return `${prefix}Investigation ${investigation.ordinal}`;
  }
  return section.title;
}

function getDocumentCaption(section: NavTabSectionModelType, stores: IStores, document: DocumentModelType) {
  const { problem, class: _class } = stores;
  const { type, uid } = document;
  if (type === SupportPublication) return document.getProperty("caption") || "Support";
  const user = _class && _class.getUserById(uid);
  const userName = user && user.displayName;
  const namePrefix = isPublishedType(type) ? `${userName}: ` : "";
  const title = isProblemType(type) ? problem.title : document.title;
  return `${namePrefix}${title}`;
}

export const DocumentsSection = observer(({ tab, section, stores, scale,
                                  isExpanded, onToggleExpansion,
                                  onDocumentClick, onDocumentDragStart,
                                  onNewDocumentClick, onDocumentStarClick }: IProps) => {
    const sectionTitle = getSectionTitle(section, stores);
    const { documents, user } = stores;
    let sectionDocs: DocumentModelType[] = [];

    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectionDocs.push(...documents.byTypeForUser(type as any, user.id));
      }
      else if (isPublishedType(type)) {
        sectionDocs.push(...documents.byType(type as any));
      }
    });
    // filter by additional properties
    if (section.properties && section.properties.length) {
      sectionDocs = sectionDocs.filter(doc => {
        return section.properties.every(p => {
          const match = /(!)?(.*)/.exec(p);
          const property = match && match[2];
          const wantsProperty = !(match && match[1]); // not negated => has property
          if (property === "starred") {
            return doc.isStarred === wantsProperty;
          }
          if (property) {
            return !!doc.getProperty(property) === wantsProperty;
          }
          // ignore empty strings, etc.
          return true;
        });
      });
    }

    function handleSectionHeaderClick() {
      onToggleExpansion && onToggleExpansion(section);
    }
    function handleNewDocumentClick() {
      onNewDocumentClick && onNewDocumentClick(section);
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

            // pass function so logic stays here but access occurs from child
            // so that mobx-react triggers child render not parent render.
            const onIsStarred = () => {
              return section.showStars
                      ? user.isTeacher
                        ? document.isStarredByUser(user.id)
                        : document.isStarred
                      : false;
            };
            const _handleDocumentStarClick = section.showStars && user.isTeacher
                                              ? handleDocumentStarClick
                                              : undefined;
            const isSoftDeleted = document.getProperty("softDelete") === "true";
            return (
              !isSoftDeleted
                ? <ThumbnailDocumentItem
                    key={document.key} dataTestName={`${tab}-list-items`}
                    canvasContext={tab} document={document} scale={scale}
                    captionText={getDocumentCaption(section, stores, document)}
                    onDocumentClick={handleDocumentClick} onDocumentDragStart={handleDocumentDragStart}
                    onIsStarred={onIsStarred} onDocumentStarClick={_handleDocumentStarClick} />
                : null
            );
          })}
          {section.addDocument
            ? <NewDocumentButtonComponent onClick={handleNewDocumentClick} />
            : null}
        </div>
      </div>
    );
  });

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
