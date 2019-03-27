import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { sectionInfo, SectionType } from "../../models/curriculum/section";
import { values } from "lodash";
import { UserStarModel } from "../../models/tools/user-star";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  sectionShown: { [section: string]: boolean };
}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      sectionShown: {
        introduction: false,
        initialChallenge: false,
        whatIf: false,
        nowWhatDoYouKnow: false,
        didYouKnow: false,
        extraWorkspace: false,
        starred: false,
      }
    };
  }

  public render() {
    const { documents, problem } = this.stores;
    const sections = problem.sections;
    const publications: DocumentModelType[] = [];
    sections.forEach((section) => {
      publications.push(...documents.getLatestPublicationsForSection(section.id, this.stores.class));
    });
    const sectionTypes: any = values(SectionType);

    return (
      <div className="class-work">
        <div className="header">Class Work</div>
        {sectionTypes.map((section: any, index: number) => {
          return (
            this.renderSection(section, publications, index)
          );
        })}
        {this.renderStarredWork(publications)}
      </div>
    );
  }

  private renderSection = (sectionType: SectionType, publications: DocumentModelType[], index: number) => {
    const { user } = this.stores;
    if (publications.some(publication => publication.sectionId === sectionType)) {
      const icon: string = this.state.sectionShown[sectionType] ? "#icon-down-arrow" : "#icon-right-arrow";
      return (
        <div className={"section " + sectionType} key={index}>
          <div
            className={"section-header " + (this.state.sectionShown[sectionType] ? "shown" : "hidden")}
            data-test="class-work-section"
            onClick={this.handleSectionClicked(sectionType)}
          >
            <svg className="icon">
              <use xlinkHref={icon}/>
            </svg>
            <div className="title">{sectionInfo[sectionType].title}</div>
          </div>
          <div className={"list " + (this.state.sectionShown[sectionType] ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const publicationUser = this.stores.class.getUserById(publication.uid);
            const pubStar = publication.stars.find( star => star.uid === user.id && star.starred );
            return (
              publication.sectionId === sectionType ?
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
                    this.renderStarFooter(publication, "", pubStar !== undefined)
                  : <div className="info">
                      <div>{publicationUser && publicationUser.fullName}</div>
                    </div>
                }
              </div>
              : null
            );
          })}
          </div>
        </div>
      );
    } else {
      return null;
    }
  }

  private renderStarredWork = (publications: DocumentModelType[]) => {
    const sectionType = "starred";
    const { user } = this.stores;
    const icon: string = this.state.sectionShown[sectionType] ? "#icon-down-arrow" : "#icon-right-arrow";
    return (
      <div className="section starred">
        <div
            className={"section-header " + (this.state.sectionShown[sectionType] ? "shown" : "hidden")}
            data-test="class-work-section"
            onClick={this.handleSectionClicked(sectionType)}
        >
          <svg className="icon">
            <use xlinkHref={icon}/>
          </svg>
          <div className="title">Starred</div>
        </div>

        <div className={"list " + (this.state.sectionShown[sectionType] ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const pubUser = this.stores.class.getUserById(publication.uid);
            const pubSectionType = publication.sectionId;
            const sectionTitle = sectionType !== undefined ?
                                sectionInfo[pubSectionType as keyof typeof sectionInfo].title
                                : "";
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

  private handleSectionClicked = (sectionName: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      const { sectionShown } = this.state;
      sectionShown[sectionName] = !sectionShown[sectionName];
      this.setState({ sectionShown });
    };
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
