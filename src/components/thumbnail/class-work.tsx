import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { DocumentsSection } from "./documents-section";
import { DocumentModelType, DocumentDragKey } from "../../models/document/document";
import { UserStarModel } from "../../models/tools/user-star";
import { ENavTabSectionType, ERightNavTab } from "../../models/view/right-nav";

interface IProps extends IBaseProps {
  scale: number;
}

interface IState {
  showSection: Map<ENavTabSectionType, boolean>;
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

        {classWorkTab.sections.map(section => (
          <DocumentsSection
            key={section.type} tab={classWorkTab.tab} section={section}
            stores={this.stores} scale={this.props.scale}
            isExpanded={this.state.showSection.get(section.type)}
            onToggleExpansion={this.handleToggleExpansion}
            onDocumentClick={this.handleDocumentClick}
            onDocumentDragStart={this.handleDocumentDragStart}
            onDocumentStarClick={_handleDocumentStarClick} />
        ))}
      </div>
    );
  }

  private handleToggleExpansion = (sectionType: ENavTabSectionType) => {
    const isExpanded = this.state.showSection.get(sectionType);
    this.state.showSection.set(sectionType, !isExpanded);
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
