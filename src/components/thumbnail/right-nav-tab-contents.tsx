import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { DocumentDragKey, DocumentModelType } from "../../models/document/document";
import { ENavTabSectionType, ERightNavTab, navTabSectionId, NavTabSectionModelType } from "../../models/view/right-nav";
import { DocumentsSection } from "./documents-section";

interface IProps extends IBaseProps {
  tabId: ERightNavTab;
  className: string;
  scale: number;
}
interface IState {
  showSection: Map<string, boolean>;
}

@inject("stores")
@observer
export class RightNavTabContents extends BaseComponent<IProps, IState> {

  public state = {
    showSection: new Map()
  };

  public render() {
    const { appConfig: { rightNavTabs }, user } = this.stores;
    const myTabSpec = rightNavTabs && rightNavTabs.find(tab => tab.tab === this.props.tabId);
    if (!myTabSpec) return null;
    return (
      <div className={this.props.className}>
        <div className="header">{myTabSpec.label}</div>

        {myTabSpec.sections.map(section => {
          const sectionId = navTabSectionId(section);
          const _handleDocumentStarClick = section.showStars && user.isTeacher
                                            ? this.handleDocumentStarClick
                                            : undefined;
          return (
            <DocumentsSection
              key={sectionId} tab={myTabSpec.tab} section={section}
              stores={this.stores} scale={this.props.scale}
              isExpanded={this.state.showSection.get(sectionId)}
              onToggleExpansion={this.handleToggleExpansion}
              onNewDocumentClick={this.handleNewDocumentClick}
              onDocumentClick={this.handleDocumentClick}
              onDocumentDragStart={this.handleDocumentDragStart}
              onDocumentStarClick={_handleDocumentStarClick} />
          );
        })}
      </div>
    );
  }

  private handleToggleExpansion = (section: NavTabSectionModelType) => {
    const sectionId = navTabSectionId(section);
    const isExpanded = this.state.showSection.get(sectionId);
    this.state.showSection.set(sectionId, !isExpanded);
    this.setState(state => ({ showSection: this.state.showSection }));
  }

  private handleNewDocumentClick = async (section: NavTabSectionModelType) => {
    const { appConfig: { defaultDocumentContent }, db, ui } = this.stores;
    const { problemWorkspace } = ui;
    const newDocument = section.type === ENavTabSectionType.kPersonalDocuments
                          ? await db.createPersonalDocument({ content: defaultDocumentContent })
                          : await db.createLearningLogDocument();
    if (newDocument) {
      problemWorkspace.setAvailableDocument(newDocument);
      ui.contractAll();
    }
  }

  private handleDocumentClick = (document: DocumentModelType) => {
    const {ui} = this.stores;
    ui.rightNavDocumentSelected(document);
  }

  private handleDocumentDragStart = (e: React.DragEvent<HTMLDivElement>, document: DocumentModelType) => {
    e.dataTransfer.setData(DocumentDragKey, document.key);
  }

  private handleDocumentStarClick = (document: DocumentModelType) => {
    const { user } = this.stores;
    document && document.toggleUserStar(user.id);
  }

}
