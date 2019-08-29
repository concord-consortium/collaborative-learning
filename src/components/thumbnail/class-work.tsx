import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { CollapsibleSectionHeader } from "./collapsible-section-header";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { UserStarModel } from "../../models/tools/user-star";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  showPublishedDocuments: boolean;
  showPersonalPublished: boolean;
  showStarredDocuments: boolean;
}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      showPublishedDocuments: false,
      showPersonalPublished: false,
      showStarredDocuments: false
    };
  }

  public render() {
    const { documents } = this.stores;
    const publications: DocumentModelType[] = [];
    publications.push(...documents.getLatestPublications(this.stores.class));
    const personalPublications = documents.getLatestOtherPublications("personalPublication");

    return (
      <div className="class-work">
        <div className="header">Class Work</div>
        {this.renderPublishedDocuments(publications)}
        {this.renderPublishedPersonalDocuments(personalPublications)}
        {this.renderStarredDocuments(publications)}
      </div>
    );
  }

  private renderPublishedDocuments = (publications: DocumentModelType[]) => {
    const { user } = this.stores;
    const { scale } = this.props;
    const sectionTitle = "Published";
    const isExpanded = this.state.showPublishedDocuments;
    return (
      <div className="section personal-published">
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName="class-work-section"
          isExpanded={isExpanded} onClick={this.handlePublishedSectionClicked}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const captionText = this.getPublicationCaptionText(publication, sectionTitle);
            const pubStar = !!publication.stars.find( star => star.uid === user.id && star.starred );
            const onDocumentStarClick = user.type === "teacher" ? this.handleDocumentStarClick : undefined;
            return (
              <ThumbnailDocumentItem
                key={publication.key} dataTestName="class-work-list-items"
                canvasContext="class-work" document={publication} scale={scale}
                captionText={captionText}
                onDocumentClick={this.handleDocumentClick} onDocumentDragStart={this.handleDocumentDragStart}
                isStarred={pubStar} onDocumentStarClick={onDocumentStarClick} />
            );
          })}
          </div>
      </div>
    );
  }

  private renderPublishedPersonalDocuments = (publications: DocumentModelType[]) => {
    const { user } = this.stores;
    const { scale } = this.props;
    const sectionTitle = "Published Personal Documents";
    const isExpanded = this.state.showPersonalPublished;
    return (
      <div className="section published">
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName="class-work-section"
          isExpanded={isExpanded} onClick={this.handlePersonalPublishedSectionClicked}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const captionText = this.getPublicationCaptionText(publication, sectionTitle);
            const pubStar = !!publication.stars.find( star => star.uid === user.id && star.starred );
            const onDocumentStarClick = user.type === "teacher" ? this.handleDocumentStarClick : undefined;
            return (
              <ThumbnailDocumentItem
                key={publication.key} dataTestName="class-work-list-items"
                canvasContext="class-work" document={publication} scale={scale}
                captionText={captionText}
                onDocumentClick={this.handleDocumentClick} onDocumentDragStart={this.handleDocumentDragStart}
                isStarred={pubStar} onDocumentStarClick={onDocumentStarClick} />
            );
          })}
          </div>
      </div>
    );
  }

  private renderStarredDocuments = (publications: DocumentModelType[]) => {
    const { user } = this.stores;
    const { scale } = this.props;
    const sectionTitle = "Starred";
    const isExpanded = this.state.showStarredDocuments;
    return (
      <div className="section starred">
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName="class-work-section"
          isExpanded={isExpanded} onClick={this.handleStarredSectionClicked}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {publications.map((publication) => {
            const captionText = this.getPublicationCaptionText(publication, sectionTitle);
            const pubStar = user.type === "teacher"
                              ? !!publication.stars.find(star => star.uid === user.id && star.starred)
                              : !!publication.stars.find(star => star.starred);
            const onDocumentStarClick = user.type === "teacher" ? this.handleDocumentStarClick : undefined;
            return (
              pubStar
                ? <ThumbnailDocumentItem
                    key={publication.key} dataTestName="class-work-list-items"
                    canvasContext="class-work" document={publication} scale={scale}
                    captionText={captionText}
                    onDocumentClick={this.handleDocumentClick} onDocumentDragStart={this.handleDocumentDragStart}
                    isStarred={true} onDocumentStarClick={onDocumentStarClick} />
                : null
            );
          })}
          </div>
      </div>
    );
  }

  private getPublicationCaptionText(publication: DocumentModelType, sectionTitle: string) {
    const pubUser = this.stores.class.getUserById(publication.uid);
    const userName = pubUser && pubUser.fullName || "";
    return userName + (sectionTitle.length ? (": " +  sectionTitle) : "");
  }

  private handleDocumentClick = (publication: DocumentModelType) => {
    const {ui} = this.stores;
    ui.rightNavDocumentSelected(publication);
  }

  private handleDocumentDragStart =
            (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  }

  private handlePublishedSectionClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState((state) => ({ showPublishedDocuments: !state.showPublishedDocuments }));
  }

  private handlePersonalPublishedSectionClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState((state) => ({ showPersonalPublished: !state.showPersonalPublished }));
  }

  private handleStarredSectionClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setState((state) => ({ showStarredDocuments: !state.showStarredDocuments }));
  }

  private handleDocumentStarClick = (publication: DocumentModelType) => {
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
  }
}
