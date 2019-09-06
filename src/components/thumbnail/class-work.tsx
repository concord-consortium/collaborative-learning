import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { DocumentsSection } from "./documents-section";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { ERightNavTab, navTabSectionId, NavTabSectionModelType } from "../../models/view/right-nav";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  showSection: Map<string, boolean>;
}

@inject("stores")
@observer
export class ClassWorkComponent extends BaseComponent<IProps, IState> {

  public state = {
    showSection: new Map()
  };

  public render() {
    const { appConfig: { rightNavTabs }, user } = this.stores;
    const classWorkTab = rightNavTabs && rightNavTabs.find(tab => tab.tab === ERightNavTab.kClassWork);
    if (!classWorkTab) return null;
    const _handleDocumentStarClick = user.isTeacher
                                      ? this.handleDocumentStarClick
                                      : undefined;
    return (
      <div className="class-work">
        <div className="header">{classWorkTab.label}</div>

        {classWorkTab.sections.map(section => {
          const sectionId = navTabSectionId(section);
          return (
            <DocumentsSection
              key={sectionId} tab={classWorkTab.tab} section={section}
              stores={this.stores} scale={this.props.scale}
              isExpanded={this.state.showSection.get(sectionId)}
              onToggleExpansion={this.handleToggleExpansion}
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
