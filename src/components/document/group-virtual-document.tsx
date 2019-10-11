import { inject, observer } from "mobx-react";
import * as React from "react";
import * as FileSaver from "file-saver";

import { CanvasComponent } from "./canvas";
import { DocumentContext, IDocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { DocumentModelType, ISetProperties, LearningLogDocument, LearningLogPublication,
         ProblemDocument } from "../../models/document/document";
import { IGroupVirtualDocument } from "../../models/document/group-vritual-document";
import { ToolbarComponent } from "../toolbar";
import { IToolApi, IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { WorkspaceModelType } from "../../models/stores/workspace";
import { TileCommentModel, TileCommentsModel } from "../../models/tools/tile-comments";
import { ToolbarConfig } from "../../models/tools/tool-types";
import { IconButton } from "../utilities/icon-button";
import SingleStringDialog from "../utilities/single-string-dialog";

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
  commentTileId: string;
}

@inject("stores")
@observer
export class GroupVirtualDocumentComponent extends BaseComponent<IProps, IState> {

  // public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
  //   const { document } = nextProps;
  //   const documentContext: IDocumentContext = {
  //           getProperty: (key: string) => document.properties.get(key),
  //           setProperties: (properties: ISetProperties) => document.setProperties(properties)
  //         };
  //   return document.key === prevState.documentKey
  //           ? {}
  //           : { documentKey: document.key, documentContext };
  // }
  // private toolApiMap: IToolApiMap = {};
  private toolApiInterface: IToolApiInterface;

  constructor(props: IProps) {
    super(props);
    this.state = {
      documentKey: props.document.key,
      isCommentDialogOpen: false,
      commentTileId: ""
    };
  }

  public render() {
    const { document: { type } } = this.props;
    return (
      <DocumentContext.Provider value={this.state.documentContext}>
        <div key="document" className="document">
          {this.renderTitleBar()}
          {this.renderCanvas()}
          {this.renderStatusBar(type)}
        </div>
      </DocumentContext.Provider>
    );
  }

  private renderTitleBar() {
    const type = "problem";
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
  private renderCanvas() {
    return (
      <div className="canvas-area">{this.render4UpCanvas()}</div>
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
        <div className="supports">
          {null}
        </div>
        <div className="actions">
          {null}
        </div>
      </div>
    );
  }
}
