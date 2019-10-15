import { inject, observer } from "mobx-react";
import * as React from "react";
import { DocumentContext, IDocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { IGroupVirtualDocument } from "../../models/document/group-vritual-document";
import { IToolApiInterface  } from "../tools/tool-tile";
import { WorkspaceModelType } from "../../models/stores/workspace";

import "./document.sass";

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

  private renderTitleBar() {
    const type = "group";
    return (
      <div>
        <div className={`titlebar ${type}`}/>
        <div className="actions">
          fake buttons
        </div>
        <div className="title" data-test="document-title">
          Title
        </div>
      </div>
    );
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
