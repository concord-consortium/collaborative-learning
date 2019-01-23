import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CanvasComponent } from "../document/canvas";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { sectionInfo, SectionType } from "../../models/curriculum/section";
import { values } from "lodash";

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
      </div>
    );
  }

  private renderSection = (sectionType: SectionType, publications: DocumentModelType[], index: number) => {
    const { problem } = this.stores;
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
            const user = this.stores.class.getStudentById(publication.uid);
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
                <div className="info">
                  <div>{user && user.fullName}</div>
                </div>
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
}
