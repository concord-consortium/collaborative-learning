import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { onSnapshot } from "mobx-state-tree";
import { CollapsibleSectionHeader } from "./collapsible-section-header";
import { ThumbnailDocumentItem, ThumbnailDocumentItemRole } from "./thumbnail-document-item";
import { DocumentModelType, isUnpublishedType, isPublishedType, isProblemType, SupportPublication
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
  onDocumentDeleteClick?: (document: DocumentModelType) => void;
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
  const { appConfig, problem, class: _class } = stores;
  const { type, uid } = document;
  if (type === SupportPublication) return document.getProperty("caption") || "Support";
  const user = _class && _class.getUserById(uid);
  const userName = user && user.displayName;
  const namePrefix = isPublishedType(type) ? `${userName}: ` : "";
  const title = isProblemType(type) ? problem.title : document.getDisplayTitle(appConfig);
  return `${namePrefix}${title}`;
}

interface IAutoExpandDocKeys {
  primary?: string;
  comparison?: string;
}

export const DocumentsSection = observer(({ tab, section, stores, scale,
                                  isExpanded, onToggleExpansion,
                                  onDocumentClick, onDocumentDragStart,
                                  onNewDocumentClick, onDocumentStarClick,
                                  onDocumentDeleteClick }: IProps) => {
    const sectionTitle = getSectionTitle(section, stores);
    const { documents, user, ui: { problemWorkspace: { primaryDocumentKey, comparisonDocumentKey }} } = stores;

    let sectionDocs: DocumentModelType[] = [];
    const publishedDocs: { [source: string]: DocumentModelType } = {};
    const [autoExpandToDocKey, setAutoExpandToDocKey] = useState<string|undefined>();
    const [autoExpandDocKeys, setAutoExpandDocKeys] = useState<IAutoExpandDocKeys>({});
    const listRef = useRef<HTMLDivElement>(null);

    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectionDocs.push(...documents.byTypeForUser(type as any, user.id));
      }
      else if (isPublishedType(type)) {
        // only show the most recent publication of each document
        documents
          .byType(type as any)
          .forEach(doc => {
            // personal documents and learning logs have originDocs.
            // problem documents only have the uids of their creator,
            // but as long as we're scoped to a single problem, there
            // shouldn't be published documents from other problems.
            const source = doc.originDoc || doc.uid;
            if (source) {
              const entry = publishedDocs[source];
              if (!entry || (entry.createdAt < doc.createdAt)) {
                publishedDocs[source] = doc;
              }
            }
          });
        sectionDocs.push(...Object.values(publishedDocs));
      }
    });

    // Reverse the order to approximate a most-recently-used ordering.
    sectionDocs = sectionDocs.reverse();

    // filter by additional properties
    if (section.properties && section.properties.length) {
      sectionDocs = sectionDocs.filter(doc => doc.matchProperties(section.properties));
    }

    // listen for changes to the primary and comparison docs
    useEffect(() => {
      const disposer = onSnapshot(stores.ui.problemWorkspace, (workspace) => {
        setAutoExpandDocKeys({
          primary: workspace.primaryDocumentKey,
          comparison: workspace.comparisonDocumentKey
        });
      });
      return () => disposer();
    }, []);

    useEffect(() => {
      // try to find the primary document and fall back to the comparison document
      const docKey = sectionDocs.find(doc => autoExpandDocKeys.primary === doc.key)?.key
                  || sectionDocs.find(doc => autoExpandDocKeys.comparison === doc.key)?.key;
      if (!isExpanded && docKey && (docKey !== autoExpandToDocKey)) {
        // autoexpand when not expanded and the section contains a doc key we haven't expanded to yet
        setAutoExpandToDocKey(docKey);
        onToggleExpansion(section);
      } else if (isExpanded && docKey) {
        // auto scroll to documents when we are expanded and we have a primary or comparison doc in the section
        const thumbnail = listRef.current?.querySelector(`.list-item[data-thumbnail-key="${docKey}"]`);
        if (thumbnail && listRef.current) {
          const listRect = listRef.current.getBoundingClientRect();
          const thumbnailRect = thumbnail.getBoundingClientRect();
          const top = thumbnailRect.top - listRect.top;
          listRef.current.scrollTo({ behavior: "smooth", top });
        }
      }
    }, [sectionDocs, isExpanded, autoExpandToDocKey, autoExpandDocKeys]);

    function handleSectionHeaderClick() {
      onToggleExpansion && onToggleExpansion(section);
    }
    function handleNewDocumentClick() {
      onNewDocumentClick && onNewDocumentClick(section);
    }

    return (
      <div className={`${section.className} section-tab-container`} key={`${tab}-${section.type}`}>
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName={section.dataTestHeader}
          isExpanded={isExpanded} onClick={handleSectionHeaderClick}/>
        <div className="list-container">
          <div className={"list " + (isExpanded ? "shown" : "hidden")} ref={listRef}>
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
              function handleDocumentDeleteClick() {
                onDocumentDeleteClick && onDocumentDeleteClick(document);
              }

              // pass function so logic stays here but access occurs from child
              // so that mobx-react triggers child render not parent render.
              const onIsStarred = () => {
                return section.showStarsForUser(user)
                        ? user.isTeacher
                          ? document.isStarredByUser(user.id)
                          : document.isStarred
                        : false;
              };
              const _handleDocumentStarClick = section.showStarsForUser(user)
                                                ? handleDocumentStarClick
                                                : undefined;
              const _handleDocumentDeleteClick = section.showDeleteForUser(user)
                                                ? handleDocumentDeleteClick
                                                : undefined;

              const role = document.key === primaryDocumentKey
                ? ThumbnailDocumentItemRole.PrimaryDoc
                : (document.key === comparisonDocumentKey ? ThumbnailDocumentItemRole.ComparisonDoc : undefined);

              return (
                <ThumbnailDocumentItem
                  key={document.key}
                  dataTestName={`${tab}-list-items`}
                  canvasContext={tab}
                  document={document}
                  scale={scale}
                  captionText={getDocumentCaption(section, stores, document)}
                  role={role}
                  onDocumentClick={handleDocumentClick} onDocumentDragStart={handleDocumentDragStart}
                  onIsStarred={onIsStarred}
                  onDocumentStarClick={_handleDocumentStarClick}
                  onDocumentDeleteClick={_handleDocumentDeleteClick}
                />
              );
            })}
            {section.addDocument
              ? <NewDocumentButtonComponent onClick={handleNewDocumentClick} />
              : null}
          </div>
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
