import { inject, observer } from "mobx-react";
import * as React from "react";
import { DocumentContext, IDocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { IGroupVirtualDocument, GroupVirtualDocument } from "../../models/document/group-virtual-document";
import { IToolApiInterface  } from "../tools/tool-tile";
import { WorkspaceModelType } from "../../models/stores/workspace";

import "./group-virtual-document.sass";

export type WorkspaceSide = "primary" | "comparison";

interface IProps extends IBaseProps {
  workspace: WorkspaceModelType;
  document: IGroupVirtualDocument;
}

interface IState {
  documentKey: string;
  documentContext?: IDocumentContext;
  isCommentDialogOpen: boolean;
}

@inject("stores")
@observer
export class GroupVirtualDocumentComponent extends BaseComponent<IProps, IState> {
/*
  NP/DL: 2019-10-15 -- Provides a view component for "GroupVirtualDocuments"
  SEE: `src/models/document/group-virtual-document`

  This work helps teachers quickly switch between multiple compare views of
  different workgroups.

  See PT Stories:
  https://www.pivotaltracker.com/story/show/168619033
  https://www.pivotaltracker.com/story/show/168711827
*/
  private toolApiInterface: IToolApiInterface;

  constructor(props: IProps) {
    super(props);
    this.state = {
      documentKey: props.document.key,
      isCommentDialogOpen: false
    };
  }

  public render() {
    const { document: { type } } = this.props;
    return (
      <DocumentContext.Provider value={this.state.documentContext}>
        <div key="document" className="document">
          {this.renderTitleBar()}
          <div className="canvas-area">{this.render4UpCanvas()}</div>
          {this.renderStatusBar(type)}
        </div>
      </DocumentContext.Provider>
    );
  }

  private groupButton(groupId: string) {
    const { document } = this.props;
    const thisId = document.id;
    const selected = thisId === groupId;
    const className = `icon group-number ${selected ? "active" : ""}`;
    const clickHandler = () => this.handleGroupClicked(groupId);
    return(
      <div key={groupId} className={className} onClick={clickHandler}>
        <div className="number">G{groupId}</div>
      </div>
    );
  }

  private renderTitleBar() {
    const type = "group";
    const { groups } = this.stores;
    const { document } = this.props;
    const thisId = document.id;
    return (
      <div className={`titlebar ${type}`}>
        <div className="actions">
          { groups.allGroups.map( group => this.groupButton(group.id)) }
        </div>
        <div className="group-title" data-test="document-title">
          Group {thisId}
        </div>
      </div>
    );
  }

  private handleGroupClicked(groupID: string) {
    const { ui } = this.stores;
    ui.problemWorkspace.setComparisonDocument(new GroupVirtualDocument({id: groupID}));
  }

  private render4UpCanvas() {
    const { user } = this.stores;
    const { document } = this.props;
    const groupId = document.id;
    return (
      <FourUpComponent
        userId={ user.id }
        groupId={ groupId }
        isGhostUser={true}
        toolApiInterface={this.toolApiInterface} />
    );
  }

  private renderStatusBar(type: string) {
    return (
      <div className={`statusbar ${type}`}>
        <div className="supports">{ null } </div>
        <div className="actions"> { null } </div>
      </div>
    );
  }
}
