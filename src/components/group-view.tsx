import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { LeftNavComponent } from "./left-nav";
import { RightNavComponent } from "./right-nav";
import { BottomNavComponent } from "./bottom-nav";
import { DocumentComponent } from "./document";
import { BaseComponent, IBaseProps } from "./base";
import { DialogComponent } from "./dialog";
import { DocumentDragKey, DocumentModelType, DocumentModel, SectionDocument } from "../models/document";
import { parseGhostSectionDocumentKey } from "../models/workspace";

import "./group-view.sass";

type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {}

// keep ghost documents out of MST
interface GhostDocumentMap {
  [key: string]: DocumentModelType;
}
const ghostSectionDocuments: GhostDocumentMap = {};

@inject("stores")
@observer
export class GroupViewComponent extends BaseComponent<IProps, {}> {

  public render() {
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;
    return (
      <div className="group-view">
        <HeaderComponent />
        {this.renderDocuments(isGhostUser)}
        <LeftNavComponent isGhostUser={isGhostUser} />
        <BottomNavComponent />
        <RightNavComponent isGhostUser={isGhostUser} />
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private renderDocuments(isGhostUser: boolean) {
    const {ui, documents} = this.stores;
    const {sectionWorkspace} = ui;
    const primaryDocument = this.getPrimaryDocument(sectionWorkspace.primaryDocumentKey);
    const comparisonDocument = sectionWorkspace.comparisonDocumentKey
                               && documents.getDocument(sectionWorkspace.comparisonDocumentKey);

    if (!primaryDocument) {
      return this.renderDocument("single-workspace", "primary");
    }

    if (sectionWorkspace.comparisonVisible) {
      return (
        <div onMouseOver={this.handleMouseOver}>
          {this.renderDocument(
            "left-workspace",
            "primary",
            <DocumentComponent
              document={primaryDocument}
              workspace={sectionWorkspace}
              side="primary"
              isGhostUser={isGhostUser}
            />
          )}
          {this.renderDocument("right-workspace", "comparison", comparisonDocument
              ? <DocumentComponent
                  document={comparisonDocument}
                  workspace={sectionWorkspace}
                  readOnly={true}
                  side="comparison"
                  isGhostUser={isGhostUser}
                />
              : this.renderComparisonPlaceholder())}
        </div>
      );
    }
    else {
      return this.renderDocument(
               "single-workspace",
               "primary",
               <DocumentComponent
                 document={primaryDocument}
                 workspace={sectionWorkspace}
                 side="primary"
                 isGhostUser={isGhostUser}
               />
             );
    }
  }

  private renderDocument(className: string, side: WorkspaceSide, child?: JSX.Element) {
    return (
      <div
        className={className}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop(side)}
        onMouseOver={this.handleMouseOver}
      >
        {child}
      </div>
    );
  }

  private renderComparisonPlaceholder() {
    return (
      <div
        className="comparison-placeholder"
        onDragOver={(this.handleDragOver)}
        onDrop={this.handleDrop("comparison")}
        onMouseOver={this.handleMouseOver}
      >
        Click or drag an item in the right tabs to show it here
      </div>
    );
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.find((type) => type === DocumentDragKey)) {
      e.preventDefault();
    }
  }

  private handleDrop = (side: WorkspaceSide) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      const {ui, documents} = this.stores;
      const {sectionWorkspace} = ui;
      const documentKey = e.dataTransfer.getData(DocumentDragKey);
      const document = documentKey ? documents.getDocument(documentKey) : null;
      if (document) {
        if (side === "primary") {
          sectionWorkspace.setPrimaryDocument(document);
        }
        else {
          sectionWorkspace.setComparisonDocument(document);
        }
      }
    };
  }

  private handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.contractAll();
  }

  private getPrimaryDocument(documentKey?: string) {
    if (documentKey) {
      const sectionId = parseGhostSectionDocumentKey(documentKey);
      if (sectionId) {
        if (!ghostSectionDocuments[sectionId]) {
          ghostSectionDocuments[sectionId] = DocumentModel.create({
            uid: "ghost",
            type: SectionDocument,
            key: sectionId,
            sectionId,
            createdAt: 1,
            content: {},
          });

          this.stores.db.listeners.updateGroupUserSectionDocumentListeners(ghostSectionDocuments[sectionId]);
        }
        return ghostSectionDocuments[sectionId];
      }
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
