import { each } from "lodash";
import { inject, observer } from "mobx-react";
import React from "react";
import { DocumentLoadingSpinner } from "./document-loading-spinner";
import { BaseComponent } from "../base";
import { DocumentContentComponent } from "./document-content";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import { transformCurriculumImageUrl } from "../../models/tools/image/image-import-export";
import { PlaybackComponent } from "../playback/playback";
import {
  IToolApi, IToolApiInterface, IToolApiMap, ToolApiInterfaceContext, EditableToolApiInterfaceRefContext
} from "../tools/tool-api";
import { HotKeys } from "../../utilities/hot-keys";
import { DEBUG_CANVAS, DEBUG_DOCUMENT } from "../../lib/debug";

import "./canvas.sass";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { LoadDocumentHistory } from "../navigation/load-document-history";

interface IProps {
  context: string;
  scale?: number;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
  showPlayback?: boolean;
  showPlaybackControls?: boolean;
  overlayMessage?: string;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  onTogglePlaybackControls?: () => void;
}

interface IState {
  documentToShow?: DocumentModelType;
  showPlaybackControls: boolean;  
}

@inject("stores")
@observer
export class CanvasComponent extends BaseComponent<IProps, IState> {

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
      "cmd-shift-s": this.handleCopyDocumentJson,
      "cmd-z": this.handleDocumentUndo,
      "cmd-shift-z": this.handleDocumentRedo
    });

    this.state = {
      showPlaybackControls: false,
      documentToShow: props.document
    };   
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
          {this.renderDebugInfo()}
          {this.renderOverlayMessage()}
        </div>
      </ToolApiInterfaceContext.Provider>
    );
  }

  private renderContent() {
    // const {content, document, showPlayback, showPlaybackControls, onTogglePlaybackControls, ...others} = this.props;
    const {content, document, showPlayback, ...others} = this.props;
    const {showPlaybackControls, documentToShow} = this.state;
    const documentContent = content || documentToShow?.content; // we only pass in content if it is a problem panel
    const typeClass = document?.type === "planning" ? "planning-doc" : "";

    if (documentContent) {
      return (
        <>
          <DocumentContentComponent content={documentContent}
                                    documentId={documentToShow?.key}
                                    typeClass={typeClass}
                                    {...others} />
          {showPlayback && <PlaybackComponent document={documentToShow}
                                              showPlaybackControls={showPlaybackControls}
                                              onTogglePlaybackControls={this.handleTogglePlaybackControlComponent} />
          }
          { showPlaybackControls && <LoadDocumentHistory document={documentToShow} />}
        </>
      );
    }
    else {
      return <DocumentLoadingSpinner document={document} />;
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
  };

  private handleCopyDocumentJson = () => {
    const {content, document } = this.props;
    const { appConfig, unit } = this.stores;
    const unitBasePath = appConfig.getUnitBasePath(unit.code);
    const documentContent = document?.content ?? content;
    const transformImageUrl = (url?: string, filename?: string) => {
      return transformCurriculumImageUrl(url, unitBasePath, filename);
    };
    const json = documentContent?.exportAsJson({ includeTileIds: true, transformImageUrl });
    json && navigator.clipboard.writeText(json);
  };

  private handleDocumentUndo = () => {
    const { document } = this.props;
    document?.undoLastAction();
  };

  private handleDocumentRedo = () => {
    const { document } = this.props;
    document?.redoLastAction();
  };

  private handleTogglePlaybackControlComponent = () => {
    this.setState((prevState, props) => {
      const newShowPlaybackControls = !prevState.showPlaybackControls;

      return {
        showPlaybackControls: newShowPlaybackControls,
        documentToShow: newShowPlaybackControls ? 
          this.getDocumentToShow() : props.document
      };
    });    
  };

  private getDocumentToShow = () => {
    if (this.props.document) {
      const docCopy = createDocumentModel(getSnapshot(this.props.document));
      // Make a variable available with the current history document
      if (DEBUG_DOCUMENT) {
        (window as any).currentHistoryDocument = docCopy;
      }
      return docCopy;
    }
  };
}
