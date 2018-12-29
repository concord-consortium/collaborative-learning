import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "../header";
import { LeftNavComponent } from "../navigation/left-nav";
import { RightNavComponent } from "../navigation/right-nav";
import { BottomNavComponent } from "../navigation/bottom-nav";
import { DocumentComponent } from "../document/document";
import { BaseComponent, IBaseProps } from "../base";
import { DialogComponent } from "../utilities/dialog";
import { DocumentDragKey, DocumentModelType, DocumentModel, SectionDocument } from "../../models/document/document";
import { parseGhostSectionDocumentKey } from "../../models/stores/workspace";

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
        <HeaderComponent isGhostUser={isGhostUser} />
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
        <div onClick={this.handleClick}>
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
        onClick={this.handleClick}
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
        onClick={this.handleClick}
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

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.contractAll();
  }

  private getPrimaryDocument(documentKey?: string) {
    if (documentKey) {
      const ghostSectionId = parseGhostSectionDocumentKey(documentKey);
      if (ghostSectionId) {
        if (!ghostSectionDocuments[ghostSectionId]) {
          // Ghosts don't store section documents in Firebase, so we create fake ones here for convenience
          ghostSectionDocuments[ghostSectionId] = DocumentModel.create({
            uid: "ghost",
            type: SectionDocument,
            key: ghostSectionId,
            sectionId: ghostSectionId,
            createdAt: 1,
            content: {},
          });

          // The creation of normal documents would start listeners for group documents in the same section
          // Since the creation of ghost documents is faked, listeners must be started manually here
          this.stores.db.listeners.updateGroupUserSectionDocumentListeners(ghostSectionDocuments[ghostSectionId]);
        }
        return ghostSectionDocuments[ghostSectionId];
      }
      return this.stores.documents.getDocument(documentKey);
    }
  }
}
