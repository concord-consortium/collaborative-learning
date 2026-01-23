import { inject, observer } from "mobx-react";
import { getSnapshot, destroy } from "mobx-state-tree";
import React from "react";
import _ from "lodash";
import { IReactionDisposer, ObservableMap, reaction, runInAction } from "mobx";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import stringify from "json-stringify-pretty-compact";
import { withResizeDetector } from "react-resize-detector";

import { AnnotationLayer } from "./annotation-layer";
import { DocumentLoadingSpinner } from "./document-loading-spinner";
import { BaseComponent } from "../base";
import { DocumentContentComponent } from "./document-content";
import { ContentStatus, DocumentModelType, createDocumentModelWithEnv } from "../../models/document/document";
import { DocumentContentModelType } from "../../models/document/document-content";
import { transformCurriculumImageUrl } from "../../models/tiles/image/image-import-export";
import { TreeManagerType } from "../../models/history/tree-manager";
import { ObjectBoundingBox } from "../../models/annotations/clue-object";
import { FirestoreHistoryManager } from "../../models/history/firestore-history-manager";
import { PlaybackComponent } from "../playback/playback";
import {
  ITileApiInterface, TileApiInterfaceContext, EditableTileApiInterfaceRefContext, AddTilesContext, TileApiInterface
} from "../tiles/tile-api";
import { StringBuilder } from "../../utilities/string-builder";
import { HotKeys } from "../../utilities/hot-keys";
import { DEBUG_CANVAS, DEBUG_DOCUMENT, DEBUG_HISTORY } from "../../lib/debug";
import { DocumentError } from "./document-error";
import { ReadOnlyContext } from "./read-only-context";
import { CanvasMethodsContext, ICanvasMethods } from "./canvas-methods-context";

import "./canvas.scss";

interface IProps {
  content?: DocumentContentModelType;
  context: string;
  document?: DocumentModelType;
  overlayMessage?: string;
  readOnly: boolean;
  scale?: number;
  selectedSectionId?: string | null;
  showPlayback?: boolean;
  viaTeacherDashboard?: boolean;
  width: number;
}

interface IState {
  canvasElement?: HTMLDivElement | null;
  documentScrollX: number;
  documentScrollY: number;
  historyDocumentCopy?: DocumentModelType;
  requestedHistoryId: string | undefined;
}

@inject("stores")
@observer
class _CanvasComponent extends BaseComponent<IProps, IState> {
  private tileApiInterface: ITileApiInterface;
  private hotKeys: HotKeys = new HotKeys();

  static contextType = EditableTileApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableTileApiInterfaceRefContext>;

  // Maps tileId and objectId to a bounding box spec.
  private boundingBoxCache: ObservableMap<string,ObservableMap<string,ObjectBoundingBox>> = new ObservableMap();
  private canvasMethods: ICanvasMethods;

  private showPlaybackControlsDisposer: IReactionDisposer;
  private historyManager: FirestoreHistoryManager | undefined = undefined;

  constructor(props: IProps) {
    super(props);

    this.tileApiInterface = new TileApiInterface();

    this.hotKeys.register({
      "cmd-shift-s": this.handleCopyDocumentJson,
      "cmd-shift-p": this.handleCopyRawDocumentJson,
      "cmd-option-shift-s": this.handleExportSectionJson,
      "cmd-shift-f": this.handleFullWindow,
      "cmd-z": this.handleDocumentUndo,
      "cmd-shift-z": this.handleDocumentRedo
    });

    this.state = {
      documentScrollX: 0,
      documentScrollY: 0,
      requestedHistoryId: undefined,
    };

    this.canvasMethods = { cacheObjectBoundingBox: this.cacheObjectBoundingBox };
  }

  componentDidMount(): void {
    this.checkForHistoryRequest();

    // update the history when the playback controls are toggled
    this.showPlaybackControlsDisposer = reaction(
      () => this.props.document?.showPlaybackControls,
      () => this.maybeUpdateHistoryDocument()
    );

    // update the history on mount
    this.maybeUpdateHistoryDocument();
  }

  private checkForHistoryRequest = () => {
    if (!this.props.document || !this.props.document.key) {
      return;
    }

    // If there is a request to show this document at a point in its history, show the history slider.
    if (this.props.showPlayback) {
      const request = this.stores.sortedDocuments.getDocumentHistoryViewRequest(this.props.document.key);
      if (request) {
        this.props.document.setShowPlaybackControls(true);
        this.setState((prevState, props) => {
          return {
            ...this.updateHistoryDocument(prevState),
            requestedHistoryId: request
          };
        });
      }
    }
  };

  private fallbackRender = ({ error, resetErrorBoundary }: FallbackProps) => {
    return (
      <DocumentError
        action="rendering"
        document={this.props.document}
        errorMessage={error.message}
        content={this.props.document?.content}
      />
    );
  };

  private setCanvasElement(canvasElement?: HTMLDivElement | null) {
    if (!this.state.canvasElement) {
      this.setState({ canvasElement });
    }
  }

  private cacheObjectBoundingBox = (tileId: string, objectId: string, boundingBox: ObjectBoundingBox | undefined) => {
    runInAction(() => {
      if (!this.boundingBoxCache.has(tileId)) {
        this.boundingBoxCache.set(tileId, new ObservableMap());
      }
      const tileBBMap = this.boundingBoxCache.get(tileId);
      const prevValue = tileBBMap?.get(objectId);
      if (!_.isEqual(prevValue, boundingBox)) {
        if (boundingBox) {
          tileBBMap?.set(objectId, boundingBox);
        } else {
          tileBBMap?.delete(objectId);
        }
      }
    });
  };

  componentDidUpdate(prevProps: IProps) {
    if (prevProps.document !== this.props.document) {
      this.maybeUpdateHistoryDocument();
    }
    this.checkForHistoryRequest();
  }

  componentWillUnmount() {
    if (this.state.historyDocumentCopy) {
      destroy(this.state.historyDocumentCopy);
    }
    this.showPlaybackControlsDisposer();
  }

  public render() {
    if (this.context && !this.props.readOnly) {
      // update the editable api interface used by the toolbar
      this.context.current = this.tileApiInterface;
    }
    const content = this.getDocumentToShow()?.content ?? this.getDocumentContent();

    // Provide getWidth method for context using the width prop
    const canvasMethods: ICanvasMethods = {
      ...this.canvasMethods,
      getWidth: () => this.props.width
    };

    return (
      <TileApiInterfaceContext.Provider value={this.tileApiInterface}>
        <AddTilesContext.Provider value={this.getDocumentContent() || null}>
          <ReadOnlyContext.Provider value={this.props.readOnly}>
            <CanvasMethodsContext.Provider value={canvasMethods}>
              <ErrorBoundary fallbackRender={this.fallbackRender}>
                <div
                  key="canvas"
                  className="canvas"
                  data-test="canvas"
                  onKeyDown={this.handleKeyDown}
                  ref={el => this.setCanvasElement(el)}
                >
                  {this.renderContent()}
                  {this.renderDebugInfo()}
                  {this.renderOverlayMessage()}
                </div>
                <AnnotationLayer
                  canvasElement={this.state.canvasElement}
                  content={content}
                  documentScrollX={this.state.documentScrollX}
                  documentScrollY={this.state.documentScrollY}
                  readOnly={this.props.readOnly}
                  boundingBoxCache={this.boundingBoxCache}
                />
              </ErrorBoundary>
            </CanvasMethodsContext.Provider>
          </ReadOnlyContext.Provider>
        </AddTilesContext.Provider>
      </TileApiInterfaceContext.Provider>
    );
  }

  private renderContent() {
    const {content, document, showPlayback, viaTeacherDashboard, ...others} = this.props;
    const showPlaybackControls = this.props.document?.showPlaybackControls;
    const documentToShow = this.getDocumentToShow();
    const documentContent = content || documentToShow?.content; // we only pass in content if it is a problem panel
    const typeClass = content ? "problem-panel" : document?.type === "planning" ? "planning-doc" : "";

    // Note: If there is an error in the main document, we are currently ignoring documentToShow.
    // It might be useful in the future to support showing the history so a user could try to
    // rewind to a document version that doesn't have an error.
    if (document?.contentStatus === ContentStatus.Error) {
      return <DocumentError
        action="loading"
        document={document}
        errorMessage={document.contentErrorMessage}
        content={document.invalidContent}
      />;
    } else if (documentContent) {
      return (
        <>
          <DocumentContentComponent
            key={showPlaybackControls ? "history" : "main"}
            content={documentContent}
            documentId={documentToShow?.key}
            onScroll={(x: number, y: number) => this.setState({ documentScrollX: x, documentScrollY: y })}
            {...{typeClass, viaTeacherDashboard, ...others}}
          />
          {showPlayback && showPlaybackControls && (
            <PlaybackComponent
              document={documentToShow}
              historyManager={this.historyManager}
              requestedHistoryId={this.state.requestedHistoryId}
            />
          )}
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

  private getDocumentContent = () => {
    const { content, document } = this.props;
    return document?.content ?? content;
  };

  private getTransformImageUrl = () => {
    const { curriculumConfig, unit } = this.stores;
    const unitBasePath = curriculumConfig.getUnitBasePath(unit.code);
    return (url?: string, filename?: string) => {
      return transformCurriculumImageUrl(url, unitBasePath, filename);
    };
  };

  private handleCopyDocumentJson = () => {
    const documentContent = this.getDocumentContent();
    const transformImageUrl = this.getTransformImageUrl();
    const json = documentContent?.exportAsJson({ includeTileIds: true, transformImageUrl });
    json && navigator.clipboard.writeText(json);
  };

  private handleCopyRawDocumentJson = () => {
    const documentContent = this.getDocumentContent();
    if (!documentContent) {
      return;
    }
    const json = getSnapshot(documentContent);
    const jsonString =  stringify(json, {maxLength: 100});
    navigator.clipboard.writeText(jsonString);
  };

  // Saves the current document as separate section files on the user's hard drive.
  // Saved in [user selected folder]/CLUE Sections/[section type]/content.json
  private handleExportSectionJson = async () => {
    const documentContent = this.getDocumentContent();
    const transformImageUrl = this.getTransformImageUrl();
    const sections = documentContent?.exportSectionsAsJson({ includeTileIds: true, transformImageUrl });

    if (sections) {
      try {
        const rootHandle = await (window as any).showDirectoryPicker({ mode: "readwrite", startIn: "desktop" });
        if (rootHandle) {
          const sectionDir = await rootHandle.getDirectoryHandle("CLUE Sections", { create: true });
          Object.keys(sections).forEach(async type => {
            const json = sections[type];
            const typeDir = await sectionDir.getDirectoryHandle(type, { create: true });
            const typeFile = await typeDir.getFileHandle("content.json", { create: true });
            const writableStream = await typeFile.createWritable();
            const builder = new StringBuilder();
            builder.pushLine(`{`);
            builder.pushLine(`"type": "${type}",`, 2);
            builder.pushLine(`"content":`, 2);
            builder.pushBlock(json, 4);
            builder.pushLine(`}`);
            await writableStream.write(builder.build());
            await writableStream.close();
          });
        }
      } catch (error) {
        console.error(`Unable to export section json`, error);
      }
    }
  };

  private handleFullWindow = () => {
    const { appConfig } = this.stores;
    appConfig.navTabs.toggleShowNavPanel();
  };

  private handleDocumentUndo = () => {
    this.props.document?.undoLastAction();
    return true;
  };

  private handleDocumentRedo = () => {
    this.props.document?.redoLastAction();
    return true;
  };

  private createHistoryDocumentCopy = () => {
    if (this.props.document) {
      const docCopy = createDocumentModelWithEnv(this.stores.appConfig, getSnapshot(this.props.document));
      // Make a variable available with the current history document
      if (DEBUG_DOCUMENT) {
        (window as any).currentHistoryDocument = docCopy;
      }
      const treeManager = docCopy.treeManagerAPI as TreeManagerType;
      const firestore = this.stores.db.firestore;

      // We don't need to dispose the old history manager because the old document copy will be destroyed
      // by updateHistoryDocument. This document disposal will trigger the tree manager disposal. The
      // mirrorHistoryFromFirestore method adds a disposer to the tree manager so that its firestore
      // listener will be cleaned up when the tree manager is disposed.
      this.historyManager = new FirestoreHistoryManager({
        firestore,
        userContextProvider: this.stores.userContextProvider,
        treeManager,
        uploadLocalHistory: false,
        syncRemoteHistory: true
      });

      // We are counting on the updated document copy to trigger a re-render so this updated
      // historyManager will be passed to the PlaybackComponent.
      return docCopy;
    }
  };

  private maybeUpdateHistoryDocument = () => {
    if (this.props.showPlayback && this.props.document?.showPlaybackControls) {
      this.setState((prevState, props) => {
        return this.updateHistoryDocument(prevState);
      });
    }
  };

  private updateHistoryDocument = (prevState: IState) => {
    const showPlaybackControls = this.props.document?.showPlaybackControls;
    const historyDocumentCopy = showPlaybackControls ?
      this.createHistoryDocumentCopy() : undefined;

    if (DEBUG_HISTORY) {
      (window as any).historyDocument = historyDocumentCopy;
    }

    if (prevState.historyDocumentCopy) {
      destroy(prevState.historyDocumentCopy);
    }
    return {
      historyDocumentCopy
    };
  };

  private getDocumentToShow = () => {
    const {historyDocumentCopy: documentToShow} = this.state;
    const showPlaybackControls = this.props.document?.showPlaybackControls;
    if (showPlaybackControls && documentToShow) {
      return documentToShow;
    } else {
      return this.props.document;
    }
  };
}

// Wrapping so that we can monitor & provide our current width as a context.
export const CanvasComponent = withResizeDetector(_CanvasComponent, { refreshMode: 'throttle' });
