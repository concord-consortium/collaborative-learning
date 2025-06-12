import { inject, observer } from "mobx-react";
import React from "react";
import { FourUpComponent } from "../four-up";
import { BaseComponent, IBaseProps } from "../base";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { IGroupVirtualDocument, GroupVirtualDocument } from "../../models/document/group-virtual-document";

import "./group-virtual-document.scss";

interface IProps extends IBaseProps {
  document: IGroupVirtualDocument;
}

interface IState {}

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
  public render() {
    return (
      <div key="document" className="document">
        {this.renderTitleBar()}
        <div className="canvas-area">{this.render4UpCanvas()}</div>
      </div>
    );
  }

  private groupButton(groupId: string, displayId: string) {
    const { document } = this.props;
    const thisId = document.id;
    const selected = thisId === groupId;
    const className = `icon group-number ${selected ? "active" : ""}`;
    const clickHandler = () => this.handleGroupClicked(groupId);
    return(
      <div key={groupId} className={className} onClick={clickHandler}>
        <div className="number">G{displayId}</div>
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
          { groups.allGroups.map( group => this.groupButton(group.id, group.displayId)) }
        </div>
        <div className="group-title" data-test="document-title">
          Group {thisId}
        </div>
      </div>
    );
  }

  private handleGroupClicked(groupID: string) {
    const { persistentUI } = this.stores;
    Logger.log(LogEventName.VIEW_GROUP, {group: groupID, via: "group-document-titlebar"});
    persistentUI.problemWorkspace.setComparisonDocument(new GroupVirtualDocument({id: groupID}));
  }

  private render4UpCanvas() {
    const { groups } = this.stores;
    const { document } = this.props;
    const group = groups.getGroupById(document.id);

    return (group &&
      <FourUpComponent
        group={ group }
        isGhostUser={true} />
    );
  }
}
