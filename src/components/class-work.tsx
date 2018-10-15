import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { CanvasComponent } from "./canvas";
import { DocumentModelType, DocumentDragKey } from "../models/document";

import "./my-work.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { documents, problem } = this.stores;
    const sections = problem.sections;
    const publications: DocumentModelType[] = [];
    sections.forEach((section) => {
      publications.push(...documents.getLatestPublicationsForSection(section.id, this.stores.class));
    });

    return (
      <div className="class-work">
        <div className="list">
          {publications.map((publication) => {
            const user = this.stores.class.getStudentById(publication.uid);
            return (
              <div
                className="list-item"
                key={publication.key}
              >
                <div
                  className="scaled-list-item-container"
                  onClick={this.handlePublicationClicked(publication)}
                  onDragStart={this.handlePublicationDragStart(publication)}
                  draggable={true}
                >
                  <div className="scaled-list-item">
                    <CanvasComponent context="class-work" document={publication} readOnly={true} />
                  </div>
                </div>
                <div className="info">
                  <div>{problem.getSectionById(publication.sectionId!)!.title}</div>
                  <div>{user && user.fullName}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private handlePublicationClicked = (publication: DocumentModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      this.stores.ui.rightNavDocumentSelected(publication);
    };
  }

  private handlePublicationDragStart = (document: DocumentModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DocumentDragKey, document.key);
    };
  }
}
