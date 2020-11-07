import { observer } from "mobx-react";
import React from "react";
import { IBaseProps } from "../base";
import { DocumentContentComponent } from "./document-content";
import { DocumentModelType } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import { IToolApiInterface } from "../tools/tool-tile";
import { DEBUG_CANVAS } from "../../lib/debug";

import "./canvas.sass";

export type EditabilityLocation = "north east" | "north west" | "south east" | "south west";

interface IProps extends IBaseProps {
  context: string;
  scale?: number;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
  editabilityLocation?: EditabilityLocation;
  toolApiInterface?: IToolApiInterface;
  overlayMessage?: string;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
}

@observer
export class CanvasComponent extends React.Component<IProps> {

  public render() {
    return (
      <div key="canvas" className="canvas" data-test="canvas">
        {this.renderContent()}
        {this.renderEditability()}
        {this.renderDebugInfo()}
        {this.renderOverlayMessage()}
      </div>
    );
  }

  private renderEditability() {
    const {editabilityLocation, readOnly} = this.props;
    if (editabilityLocation) {
      const iconName = readOnly ? "icon-copy-only" : "icon-edit";
      return (
        <svg key="edit" className={`icon editability ${iconName} ${editabilityLocation}`}>
          <use xlinkHref={`#${iconName}`} />
        </svg>
      );
    }
    return null;
  }

  private renderContent() {
    const {content, document, ...others} = this.props;
    const documentContent = document ? document.content : content;

    if (documentContent) {
      return (
        <DocumentContentComponent content={documentContent} {...others} />
      );
    }
    else {
      return null;
    }
  }

  private renderDebugInfo() {
    const { document } = this.props;
    if (document && DEBUG_CANVAS) {
      return (
        <div className="canvas-debug">
          <span style={{fontSize: "1.5em"}}>{document.key}</span>
        </div>
      );
    }
  }

  private renderOverlayMessage() {
    const { overlayMessage } = this.props;
    if (overlayMessage) {
      return (
        <div className="canvas-overlay-message">
          <span style={{fontSize: "1.5em"}}>{overlayMessage}</span>
        </div>
      );
    }
  }
}
