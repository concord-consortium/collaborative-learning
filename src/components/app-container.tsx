import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { LeftNavComponent } from "./left-nav";
import { RightNavComponent } from "./right-nav";
import { BottomNavComponent } from "./bottom-nav";
import { DocumentComponent } from "./document";
import { BaseComponent, IBaseProps } from "./base";
import { DialogComponent } from "./dialog";

import "./app-container.sass";
import { DocumentDragKey } from "../models/document";

type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppContainerComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        {this.renderDocuments()}
        <LeftNavComponent />
        <BottomNavComponent />
        <RightNavComponent />
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private renderDocuments() {
    const {ui, documents} = this.stores;
    const {sectionWorkspace} = ui;
    const primaryDocument = sectionWorkspace.primaryDocumentKey
                            && documents.getDocument(sectionWorkspace.primaryDocumentKey);
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
            <DocumentComponent document={primaryDocument} workspace={sectionWorkspace} side="primary" />
          )}
          {this.renderDocument("right-workspace", "comparison", comparisonDocument
              ? <DocumentComponent
                  document={comparisonDocument}
                  workspace={sectionWorkspace}
                  readOnly={true}
                  side="comparison"
                />
              : this.renderComparisonPlaceholder())}
        </div>
      );
    }
    else {
      return this.renderDocument(
               "single-workspace",
               "primary",
               <DocumentComponent document={primaryDocument} workspace={sectionWorkspace} side="primary" />
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
}
