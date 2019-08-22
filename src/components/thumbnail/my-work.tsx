import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { DocumentDragKey, ProblemDocument, DocumentModelType } from "../../models/document/document";

interface IProps extends IBaseProps {
  scale: number;
}

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {documents, user} = this.stores;
    const userDocs = documents.byTypeForUser(ProblemDocument, user.id);
    if (userDocs.length === 0) return null;
    return (
      <div className="my-work">
        <div className="header">My Work</div>
        <div className="list">
          {userDocs.map((document) => {
            return (
              <div
                className="list-item"
                key={document.key}
                data-test="my-work-list-items"
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handleDocumentClicked(document)}
                  onDragStart={this.handleDocumentDragStart(document)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="my-work" document={document}
                                    readOnly={true} scale={this.props.scale} />
                  </div>
                </div>
                <div className="info">
                  {null}
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
    const {problemWorkspace, learningLogWorkspace} = ui;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (ui.bottomNavExpanded) {
        if (learningLogWorkspace.primaryDocumentKey) {
          learningLogWorkspace.setComparisonDocument(document);
          learningLogWorkspace.toggleComparisonVisible({override: true});
        }
        else {
          ui.alert("Please select a Learning Log first.", "Select for Learning Log");
        }
      }
      else {
        problemWorkspace.setAvailableDocument(document);
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
