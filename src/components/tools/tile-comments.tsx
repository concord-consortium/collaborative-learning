import React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { TileCommentsModelType, TileCommentModelType } from "../../models/tools/tile-comments";
import { IToolApiInterface } from "./tool-tile";

import "./tile-comments.sass";

interface IProps {
  docKey: string;
  model: TileCommentsModelType;
  toolApiInterface?: IToolApiInterface;
}

@inject("stores")
@observer
export class TileCommentsComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { user } = this.stores;
    const { model } = this.props;
    if (!model.comments.length) return null;
    if (!model.visible) {
      return this.renderClosed();
    }
    const { class: clazz } = this.stores;
    return (
      <div className="tile-comments open">
        <div className="close" title="Close" onClick={this.closeComments}>
          <svg className={`icon icon-delete-tool`}>
            <use xlinkHref={`#icon-delete-tool`} />
          </svg>
        </div>
        <div className="comments">
          <div className="title">Comments</div>
          {
            model.comments.map(comment => {
              const student = clazz.getUserById(comment.uid);
              const name = student ? student.displayName : "Student";
              return (
                <div className="comment" key={comment.key}
                     onMouseEnter={this.handleHover(comment.selectionInfo)}
                     onMouseLeave={this.handleLeave(comment.selectionInfo)}>
                  {user.id === comment.uid ? this.renderDelete(comment) : null}
                  {`${name}: ${comment.text}`}
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  private renderDelete = (comment: TileCommentModelType) => {
    return (
      <div className="delete" title="Delete" onClick={this.handleDelete(comment)}>
        <svg className={`icon icon-delete-tool`}>
          <use xlinkHref={`#icon-delete-tool`} />
        </svg>
      </div>
    );
  }

  private handleHover = (selectionInfo?: string) => () => {
    const { toolApiInterface, model } = this.props;
    const toolApi = toolApiInterface && toolApiInterface.getToolApi(model.tileId);
    if (toolApi && selectionInfo) {
      toolApi.setSelectionHighlight(selectionInfo, true);
    }
  }

  private handleLeave = (selectionInfo?: string) => () => {
    const { toolApiInterface, model } = this.props;
    const toolApi = toolApiInterface && toolApiInterface.getToolApi(model.tileId);
    if (toolApi && selectionInfo) {
      toolApi.setSelectionHighlight(selectionInfo, false);
    }
  }

  private handleDelete = (comment: TileCommentModelType) => () => {
    comment.delete();
  }

  private closeComments = () => {
    const { model } = this.props;
    model.setVisible(false);
  }

  private openComments = () => {
    const { model } = this.props;
    model.setVisible(true);
  }

  private renderClosed() {
    return (
        <div className="tile-comments closed" title="Close" onClick={this.openComments}>
          <svg className={`icon icon-geometry-comment`}>
            <use xlinkHref={`#icon-geometry-comment`} />
          </svg>
        </div>
    );
  }

}
