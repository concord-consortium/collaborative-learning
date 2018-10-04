import { inject, observer } from "mobx-react";
import * as React from "react";

import "./my-work.sass";
import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { DocumentDragKey, SectionDocument, DocumentModelType } from "../models/document";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {documents, user} = this.stores;
    const sections = documents.byTypeForUser(SectionDocument, user.id);
    if (sections.length === 0) {
      return null;
    }
    return (
      <div className="my-work">
        <div className="list">
          {sections.map((document) => {
            const section = this.stores.problem.getSectionById(document.sectionId!);
            const title = section ? section.title : undefined;
            return (
              <div
                className="list-item"
                key={document.sectionId}
                title={title}
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handleDocumentClicked(document)}
                  onDragStart={this.handleDocumentDragStart(document)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="my-work" document={document} readOnly={true} />
                  </div>
                </div>
                <div className="info">
                  {title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handleDocumentClicked = (document: DocumentModelType) => {
    const {ui} = this.stores;
    const {sectionWorkspace, learningLogWorkspace} = ui;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.bottomNavExpanded) {
        if (learningLogWorkspace.primaryDocumentKey) {
          learningLogWorkspace.setComparisonDocument(document);
          learningLogWorkspace.toggleComparisonVisible(true);
        }
        else {
          ui.alert("Please select a Learning Log first.", "Select for Learning Log");
        }
      }
      else {
        sectionWorkspace.setAvailableDocument(document);
        ui.contractAll();
      }
    };
  }

  private handleDocumentDragStart = (document: DocumentModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DocumentDragKey, document.key);
    };
  }
}
