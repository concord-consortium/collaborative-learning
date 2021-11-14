import { inject, observer } from "mobx-react";
import React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType } from "../../models/document/document";
import { DocumentDragKey, LearningLogPublication } from "../../models/document/document-types";

interface IProps extends IBaseProps {
  scale: number;
}

@inject("stores")
@observer
export class ClassLogsComponent extends BaseComponent<IProps> {

  public render() {
    const { documents } = this.stores;
    const publications = documents.getLatestOtherPublications(LearningLogPublication);

    return (
      <div className="class-logs">
        <div className="header">Class Logs</div>
        <div className="list">
          {publications.map((publication) => {
            const user = this.stores.class.getUserById(publication.uid);
            return (
              <div
                className="list-item"
                data-test="class-log-list-items"
                key={publication.key}
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handlePublicationClicked(publication)}
                  onDragStart={this.handlePublicationDragStart(publication)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="class-work" document={publication}
                                      readOnly={true} scale={this.props.scale} />
                  </div>
                </div>
                <div className="info">
                  <div>{user && user.displayName}</div>
                  <div>{publication.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handlePublicationClicked = (publication: DocumentModelType) => {
    const { appConfig } = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      this.stores.ui.rightNavDocumentSelected(appConfig, publication);
    };
  };

  private handlePublicationDragStart = (document: DocumentModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DocumentDragKey, document.key);
    };
  };
}
