import { each } from "lodash";
import { observer } from "mobx-react";
import React from "react";
import { DocumentContentComponent } from "./document-content";
import { DocumentModelType } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import {
  IToolApi, IToolApiInterface, IToolApiMap, ToolApiInterfaceContext, EditableToolApiInterfaceRefContext
} from "../tools/tool-api";
import { HotKeys } from "../../utilities/hot-keys";
import { DEBUG_CANVAS } from "../../lib/debug";

import "./canvas.sass";

export type EditabilityLocation = "north east" | "north west" | "south east" | "south west";

interface IProps {
  context: string;
  scale?: number;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
  editabilityLocation?: EditabilityLocation;
  overlayMessage?: string;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
}

@observer
export class CanvasComponent extends React.Component<IProps> {

  private toolApiMap: IToolApiMap = {};
  private toolApiInterface: IToolApiInterface;
  private hotKeys: HotKeys = new HotKeys();

  static contextType = EditableToolApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableToolApiInterfaceRefContext>;

  constructor(props: IProps) {
    super(props);

    this.toolApiInterface = {
      register: (id: string, toolApi: IToolApi) => {
        this.toolApiMap[id] = toolApi;
      },
      unregister: (id: string) => {
        delete this.toolApiMap[id];
      },
      getToolApi: (id: string) => {
        return this.toolApiMap[id];
      },
      forEach: (callback: (api: IToolApi) => void) => {
        each(this.toolApiMap, api => callback(api));
      }
    };

    this.hotKeys.register({
      "cmd-option-s": this.handleCopyDocumentJson
    });
  }

  public render() {
    if (this.context && !this.props.readOnly) {
      // update the editable api interface used by the toolbar
      this.context.current = this.toolApiInterface;
    }
    return (
      <ToolApiInterfaceContext.Provider value={this.toolApiInterface}>
        <div key="canvas" className="canvas" data-test="canvas" onKeyDown={this.handleKeyDown}>
          {this.renderContent()}
          {this.renderEditability()}
          {this.renderDebugInfo()}
          {this.renderOverlayMessage()}
        </div>
      </ToolApiInterfaceContext.Provider>
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
    const documentId = document?.key;

    if (documentContent) {
      return (
        <DocumentContentComponent content={documentContent} documentId={documentId} {...others} />
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

  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    this.hotKeys.dispatch(e);
  }

  private handleCopyDocumentJson = () => {
    const {content, document } = this.props;
    const documentContent = document?.content ?? content;
    const json = documentContent?.exportAsJson({ includeTileIds: true });
    json && navigator.clipboard.writeText(json);
  }
}
