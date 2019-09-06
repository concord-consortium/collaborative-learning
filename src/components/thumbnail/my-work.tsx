import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "../base";
import { DocumentDragKey, DocumentModelType } from "../../models/document/document";
import { ENavTabSectionType, ERightNavTab, navTabSectionId, NavTabSectionModelType
      } from "../../models/view/right-nav";
import { DocumentsSection } from "./documents-section";

interface IProps extends IBaseProps {
  scale: number;
}
interface IState {
  showSection: Map<string, boolean>;
}

@inject("stores")
@observer
export class MyWorkComponent extends BaseComponent<IProps, IState> {

  public state = {
    showSection: new Map()
  };

  public render() {
    const { appConfig: { rightNavTabs }} = this.stores;
    const myWorkTab = rightNavTabs && rightNavTabs.find(tab => tab.tab === ERightNavTab.kMyWork);
    if (!myWorkTab) return null;
    return (
      <div className="my-work">
        <div className="header">{myWorkTab.label}</div>

        {myWorkTab.sections.map(section => {
          const sectionId = navTabSectionId(section);
          return (
            <DocumentsSection
              key={sectionId} tab={myWorkTab.tab} section={section}
              stores={this.stores} scale={this.props.scale}
              isExpanded={this.state.showSection.get(sectionId)}
              onToggleExpansion={this.handleToggleExpansion}
              onNewDocumentClick={this.handleNewDocumentClick}
              onDocumentClick={this.handleDocumentClick}
              onDocumentDragStart={this.handleDocumentDragStart} />
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

}
