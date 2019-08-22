import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { UserStarModel } from "../../models/tools/user-star";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  showPublishedDocuments: boolean;
  showStarredDocuments: boolean;
}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      showPublishedDocuments: false,
      showStarredDocuments: false
    };
  }

  public render() {
    const { documents, problem } = this.stores;
    const publications: DocumentModelType[] = [];
    publications.push(...documents.getLatestPublications(this.stores.class));

    return (
      <div className="class-work">
        <div className="header">Class Work</div>
        {this.renderPublishedDocuments(publications)}
        {this.renderStarredDocuments(publications)}
      </div>
    );
  }

  private renderPublishedDocuments = (publications: DocumentModelType[]) => {
    const { user } = this.stores;
    const icon: string = this.state.showPublishedDocuments ? "#icon-down-arrow" : "#icon-right-arrow";
    return (
      <div className="section published">
        <div
            className={"section-header " + (this.state.showPublishedDocuments ? "shown" : "hidden")}
            data-test="class-work-section"
            onClick={this.handlePublishedSectionClicked}
        >
          <svg className="icon">
            <use xlinkHref={icon}/>
          </svg>
          <div className="title">Published</div>
        </div>

        <div className={"list " + (this.state.showPublishedDocuments ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const pubUser = this.stores.class.getUserById(publication.uid);
            const sectionTitle = "Published";
            return (
              <div
                className="list-item"
                data-test="class-work-list-items"
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
                { user.type === "teacher"
                    ? this.renderStarFooter(publication, sectionTitle, true)
                    : <div className="info">
                        <div>{(pubUser && pubUser.fullName) + ": " +  sectionTitle}</div>
                      </div>
                }
              </div>
            );
          })}
          </div>
      </div>
    );
  }

  private renderStarredDocuments = (publications: DocumentModelType[]) => {
    const { user } = this.stores;
    const icon: string = this.state.showStarredDocuments ? "#icon-down-arrow" : "#icon-right-arrow";
    return (
      <div className="section starred">
        <div
            className={"section-header " + (this.state.showStarredDocuments ? "shown" : "hidden")}
            data-test="class-work-section"
            onClick={this.handleStarredSectionClicked}
        >
          <svg className="icon">
            <use xlinkHref={icon}/>
          </svg>
          <div className="title">Starred</div>
        </div>

        <div className={"list " + (this.state.showStarredDocuments ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const pubUser = this.stores.class.getUserById(publication.uid);
            const sectionTitle = "Starred";
            const pubStar = user.type === "teacher" ?
                         publication.stars.find(star => star.uid === user.id && star.starred) :
                         publication.stars.find(star => star.starred);
            return (
              pubStar ?
              <div
                className="list-item"
                data-test="class-work-list-items"
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
                { user.type === "teacher" ?
                  this.renderStarFooter(publication, sectionTitle, true)
                  : <div className="info">
                      <div>{(pubUser && pubUser.fullName) + ": " +  sectionTitle}</div>
                    </div>
                }
              </div>
              : null
            );
          })}
          </div>
      </div>
    );
  }

  private renderStarFooter = (publication: any, sectionTitle: string, starred: boolean) => {
    const pubUser = this.stores.class.getUserById(publication.uid);
    const infoText = (pubUser && pubUser.fullName) + (sectionTitle.length ? (": " +  sectionTitle) : "");
    return (
      <div className="footer">
        <div className="info">
          <div>{infoText}</div>
        </div>
        <div className="icon-holder" onClick={this.handleStarClicked(publication)}>
          <svg className={"icon-star " + (starred ? "starred" : "")} >
            <use xlinkHref="#icon-star"/>
          </svg>
        </div>
      </div>
    );
  }

  private handlePublicationClicked = (publication: DocumentModelType) => {
    const {ui} = this.stores;
    return (e: React.MouseEvent<HTMLDivElement>) => {
      ui.rightNavDocumentSelected(publication);
    };
  }

  private handlePublicationDragStart = (document: DocumentModelType) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DocumentDragKey, document.key);
    };
  }

  private handlePublishedSectionClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState((state) => ({ showPublishedDocuments: !state.showPublishedDocuments }));
  }

  private handleStarredSectionClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState((state) => ({ showStarredDocuments: !state.showStarredDocuments }));
  }

  private handleStarClicked = (publication: DocumentModelType) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      const { user } = this.stores;
      if (publication) {
        const userStar = publication.stars.find( star => star.uid === user.id );
        if (!userStar) {
          const newStar = UserStarModel.create({
            uid: user.id,
          });
          publication.setUserStar(newStar);
        } else {
          publication.toggleUserStar(user.id);
        }
      }
    };
  }
}
