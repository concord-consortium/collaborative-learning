import { inject, observer } from "mobx-react";
import * as React from "react";

import { DocumentsSection } from "./documents-section";
import { EPanelId } from "../app-header";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../four-up";
import { DocumentDragKey, DocumentModelType } from "../../models/document/document";
import { GroupVirtualDocument } from "../../models/document/group-virtual-document";
import { ENavTabSectionType, ERightNavTab, NavTabSectionModelType, navTabSectionId} from "../../models/view/right-nav";

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

    const renderDocumentsSection = (section: NavTabSectionModelType) => {
      const sectionId = navTabSectionId(section);
      const _handleDocumentStarClick = section.showStarsForUser(user)
                                        ? this.handleDocumentStarClick
                                        : undefined;
      return (
        <DocumentsSection
          key={sectionId} tab={myTabSpec!.tab} section={section}
          stores={this.stores} scale={this.props.scale}
          isExpanded={this.state.showSection.get(sectionId)}
          onToggleExpansion={this.handleToggleExpansion}
          onNewDocumentClick={this.handleNewDocumentClick}
          onDocumentClick={this.handleDocumentClick}
          onDocumentDragStart={this.handleDocumentDragStart}
          onDocumentStarClick={_handleDocumentStarClick} />
      );
    };

    if (!myTabSpec) return null;
    return (
      <div className={this.props.className}>
        <div className="header">{myTabSpec.label}</div>

        {myTabSpec.sections.map(section => {
          const showWorkspaces = section.showGroupWorkspaces;
          return (!showWorkspaces ? renderDocumentsSection(section) : this.renderGroups() );
        })}
      </div>
    );
  }

  private renderGroups() {
    const { groups } = this.stores;
    return groups.allGroups.map( group => this.renderFourUpThumbnail(group));
  }

  private renderFourUpThumbnail(group: any) {
    const { ui } = this.stores;
    const showGroupFourUp = () =>  {
      ui.problemWorkspace.setComparisonDocument(new GroupVirtualDocument(group));
      ui.problemWorkspace.toggleComparisonVisible({override: true});
      ui.setTeacherPanelKey(EPanelId.workspace);
    };

    const styles: React.CSSProperties = {
      width: "100px",
      height: "100px",
      position: "relative",
      pointerEvents: "none"
    };

    return (
      <div key={group.id}>
        <div onClick={showGroupFourUp}>
          {group.id}
          <div style={styles}>
            <FourUpComponent groupId={group.id} isGhostUser={true} toggleable={true} />
          </div>
        </div>
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
