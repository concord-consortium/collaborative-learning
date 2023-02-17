import { each } from "lodash";
import { inject, observer } from "mobx-react";
import { getSnapshot, destroy } from "mobx-state-tree";
import React from "react";
import { DocumentLoadingSpinner } from "./document-loading-spinner";
import { BaseComponent } from "../base";
import { DocumentContentComponent } from "./document-content";
import { createDocumentModel, ContentStatus, DocumentModelType } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import { transformCurriculumImageUrl } from "../../models/tiles/image/image-import-export";
import { logHistoryEvent } from "../../models/history/log-history-event";
import { TreeManagerType } from "../../models/history/tree-manager";
import { PlaybackComponent } from "../playback/playback";
import {
  ITileApi, ITileApiInterface, ITileApiMap, TileApiInterfaceContext, EditableTileApiInterfaceRefContext
} from "../tiles/tile-api";
import { HotKeys } from "../../utilities/hot-keys";
import { DEBUG_CANVAS, DEBUG_DOCUMENT } from "../../lib/debug";
import { DocumentError } from "./document-error";

import "./canvas.sass";

interface IProps {
  context: string;
  scale?: number;
  readOnly?: boolean;
  document?: DocumentModelType;
  content?: DocumentContentModelType;
  showPlayback?: boolean;
  overlayMessage?: string;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  /**
   * An optional component rendered between the document and history controls
   */
  overlay?: React.ReactNode;
}

interface IState {
  historyDocumentCopy?: DocumentModelType;
  showPlaybackControls: boolean;
}

@inject("stores")
@observer
export class CanvasComponent extends BaseComponent<IProps, IState> {

  private toolApiMap: ITileApiMap = {};
  private tileApiInterface: ITileApiInterface;
  private hotKeys: HotKeys = new HotKeys();

  static contextType = EditableTileApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableTileApiInterfaceRefContext>;

  constructor(props: IProps) {
    super(props);

    this.tileApiInterface = {
      register: (id: string, tileApi: ITileApi) => {
        this.toolApiMap[id] = tileApi;
      },
      unregister: (id: string) => {
        delete this.toolApiMap[id];
      },
      getTileApi: (id: string) => {
        return this.toolApiMap[id];
      },
      forEach: (callback: (api: ITileApi) => void) => {
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
    };
  }

  public render() {
    if (this.context && !this.props.readOnly) {
      // update the editable api interface used by the toolbar
      this.context.current = this.tileApiInterface;
    }
    return (
      <TileApiInterfaceContext.Provider value={this.tileApiInterface}>
        <div key="canvas" className="canvas" data-test="canvas" onKeyDown={this.handleKeyDown}>
          {this.renderContent()}
          {this.renderDebugInfo()}
          {this.renderOverlayMessage()}
        </div>
      </TileApiInterfaceContext.Provider>
    );
  }

  private renderContent() {
    const {content, document, showPlayback, overlay, viaTeacherDashboard, ...others} = this.props;
    const {showPlaybackControls} = this.state;
    const documentToShow = this.getDocumentToShow();
    const documentContent = content || documentToShow?.content; // we only pass in content if it is a problem panel
    const typeClass = document?.type === "planning" ? "planning-doc" : "";

    // Note: If there is an error in the main document, we are currently ignoring documentToShow.
    // It might be useful in the future to support showing the history so a user could try to
    // rewind to a document version that doesn't have an error.
    if (document?.contentStatus === ContentStatus.Error) {
      return <DocumentError document={document} />;
    } else if (documentContent) {
      return (
        <>
          <DocumentContentComponent key={showPlaybackControls ? "history" : "main"} content={documentContent}
                                    documentId={documentToShow?.key}
                                    {...{typeClass, viaTeacherDashboard, ...others}} />
          {overlay}
          {showPlayback && <PlaybackComponent document={documentToShow}
                                              showPlaybackControls={showPlaybackControls}
                                              onTogglePlaybackControls={this.handleTogglePlaybackControlComponent} />
          }
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
    this.props.document?.undoLastAction();
    return true;
  };

  private handleDocumentRedo = () => {
    this.props.document?.redoLastAction();
    return true;
  };

  private handleTogglePlaybackControlComponent = () => {
    this.setState((prevState, props) => {
      const showPlaybackControls = !prevState.showPlaybackControls;
      const historyDocumentCopy = showPlaybackControls ?
        this.createHistoryDocumentCopy() : undefined;

      if (prevState.historyDocumentCopy) {
        destroy(prevState.historyDocumentCopy);
      }
      logHistoryEvent({documentId: this.props.document?.key || '',
        action: showPlaybackControls ? "showControls": "hideControls" });
      return {
        showPlaybackControls,
        historyDocumentCopy
      };
    });
  };

  private createHistoryDocumentCopy = () => {
    if (this.props.document) {
      const docCopy = createDocumentModel(getSnapshot(this.props.document));
      // Make a variable available with the current history document
      if (DEBUG_DOCUMENT) {
        (window as any).currentHistoryDocument = docCopy;
      }
      const treeManager = docCopy.treeManagerAPI as TreeManagerType;
      const firestore = this.stores.db.firestore;
      const user = this.stores.user;
      treeManager.mirrorHistoryFromFirestore(user, firestore);
      return docCopy;
    }
  };

  private getDocumentToShow = () => {
    const {showPlaybackControls, historyDocumentCopy: documentToShow} = this.state;
    if (showPlaybackControls && documentToShow) {
      return documentToShow;
    } else {
      return this.props.document;
    }
  };
}
