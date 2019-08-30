import { inject, observer } from "mobx-react";
import * as React from "react";
import { Icon } from "@blueprintjs/core";

import { BaseComponent, IBaseProps } from "../base";
import { CollapsibleSectionHeader } from "./collapsible-section-header";
import { DocumentDragKey, ProblemDocument, DocumentModelType, PersonalDocument } from "../../models/document/document";
import { NavTabSectionSpec, ENavTabSectionType } from "../../models/view/right-nav";
import { ThumbnailDocumentItem } from "./thumbnail-document-item";
import { CanvasComponent } from "../document/canvas";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  showPersonalDocuments: boolean;
  showProblemDocuments: boolean;
}

// will be pulled from unit eventually
const kMyWorkSections: NavTabSectionSpec[] = [
  {
    title: "Workspaces I've Created",
    type: ENavTabSectionType.kPersonalDocuments
  },
  {
    title: "%abbrevInvestigation%",
    type: ENavTabSectionType.kProblemDocuments
  }
];

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, IState> {

  public state = {
    showPersonalDocuments: false,
    showProblemDocuments: false
  };

  public render() {
    return (
      <div className="my-work">
        <div className="header">My Work</div>

        {this.renderSectionContents(kMyWorkSections)}
      </div>
    );
  }

  private getSectionTitle(sectionSpec: NavTabSectionSpec) {
    if (sectionSpec.title === "%abbrevInvestigation%") {
      const { unit, problem } = this.stores;
      const { abbrevTitle } = unit;
      const prefix = abbrevTitle ? `${abbrevTitle}: ` : "";
      // For now pull investigation number from problem title.
      // Teacher dashboard work adds investigation to store, at which
      // point it can be pulled from there directly.
      const problemChar0 = problem.title.length ? problem.title[0] : "";
      const investigationNum = problemChar0 >= "0" && problemChar0 <= "9" ? problemChar0 : "";
      return `${prefix}Investigation ${investigationNum}`;
    }
    return sectionSpec.title;
  }

  private renderSectionContents(sectionSpecs: NavTabSectionSpec[]) {
    return sectionSpecs.map(sectionSpec => {
      switch (sectionSpec.type) {
        case ENavTabSectionType.kPersonalDocuments:
          return this.renderPersonalDocumentsSection(sectionSpec);
        case ENavTabSectionType.kProblemDocuments:
          return this.renderProblemDocumentsSection(sectionSpec);
      }
    });
  }

  private renderPersonalDocumentsSection(sectionSpec: NavTabSectionSpec) {
    const sectionTitle = this.getSectionTitle(sectionSpec);
    const isExpanded = this.state.showPersonalDocuments;
    const { documents, user } = this.stores;
    const userDocs = documents.byTypeForUser(PersonalDocument, user.id);
    return (
      <div key="my-work-personal-documents">
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName="my-work-section"
          isExpanded={isExpanded} onClick={this.handlePersonalSectionHeaderClick}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {userDocs.map((document, index) => {
            return (
              <ThumbnailDocumentItem
                key={document.key} dataTestName="my-work-list-items"
                canvasContext="my-work" document={document} scale={this.props.scale}
                captionText={document.title || "Untitled"}
                onDocumentClick={this.handleDocumentClick} onDocumentDragStart={this.handleDocumentDragStart} />
            );
          })}
          <NewDocumentButtonComponent onClick={this.handleNewDocumentClick} />
        </div>
      </div>
    );
  }

  private renderProblemDocumentsSection(sectionSpec: NavTabSectionSpec) {
    const sectionTitle = this.getSectionTitle(sectionSpec);
    const isExpanded = this.state.showProblemDocuments;
    const { documents, problem, user } = this.stores;
    const userDocs = documents.byTypeForUser(ProblemDocument, user.id);
    return (
      <div key="my-work-problem-documents">
        <CollapsibleSectionHeader
          sectionTitle={sectionTitle} dataTestName="my-work-section"
          isExpanded={isExpanded} onClick={this.handleProblemSectionHeaderClick}/>

        <div className={"list " + (isExpanded ? "shown" : "hidden")}>
          {userDocs.map(document => {
            return (
              <ThumbnailDocumentItem
                key={document.key} dataTestName="my-work-list-items"
                canvasContext="my-work" document={document} scale={this.props.scale}
                captionText={problem.title}
                onDocumentClick={this.handleDocumentClick} onDocumentDragStart={this.handleDocumentDragStart} />
            );
          })}
        </div>
      </div>
    );
  }

  private handlePersonalSectionHeaderClick = () => {
    this.setState(state => ({ showPersonalDocuments: !state.showPersonalDocuments }));
  }

  private handleProblemSectionHeaderClick = () => {
    this.setState(state => ({ showProblemDocuments: !state.showProblemDocuments }));
  }

  private handleNewDocumentClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const { db, ui } = this.stores;
    const { problemWorkspace } = ui;
    const newDocument = await db.createPersonalDocument();
    if (newDocument) {
      problemWorkspace.setAvailableDocument(newDocument);
      ui.contractAll();
    }
  }

  private handleDocumentClick = (document: DocumentModelType) => {
    const {ui} = this.stores;
    const {problemWorkspace, learningLogWorkspace} = ui;
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
  }

  private handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  }
}

interface INewDocumentButtonProps {
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const NewDocumentButtonComponent = ({ onClick }: INewDocumentButtonProps) => {
  return (
    <div className="list-item" data-test="my-work-new-document" >
      <div
        className="scaled-list-item-container new-document-button"
        onClick={onClick} >
        <div className="scaled-list-item">
          <CanvasComponent context="my-work" readOnly={true} />
        </div>
        <div className="new-document-button-label">
          <Icon className="new-document-button-icon" icon="add" iconSize={26} />
          <label>New</label>
        </div>
      </div>
    </div>
  );
};
