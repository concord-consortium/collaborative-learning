import React, { useRef } from "react";
import classNames from "classnames";
import { getSnapshot } from "mobx-state-tree";
import { appIcons } from "../../app-config";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { useGroupsStore, useStores } from "../../hooks/use-stores";
import { DEBUG_HISTORY_VIEW } from "../../lib/debug";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { IToolbarModel, ToolbarModel } from "../../models/stores/problem-configuration";
import { WorkspaceMode } from "../../models/stores/workspace";
import { FourUpComponent } from "../four-up";
import { EditableTileApiInterfaceRef, EditableTileApiInterfaceRefContext } from "../tiles/tile-api";
import { CanvasComponent } from "./canvas";
import { DocumentContextReact } from "./document-context";
import { DocumentToolbar } from "./document-toolbar";

import "./editable-document-content.scss";
import { clone } from "lodash";

interface IOneUpCanvasProps {
  document: DocumentModelType;
  showPlayback?: boolean;
  readOnly: boolean;
}
const OneUpCanvas: React.FC<IOneUpCanvasProps> = props => {
  const {document, ...others} = props;


  return (
    <CanvasComponent
      context="1-up"
      document={document}
      {...others}
    />
  );
};

interface IEditableFourUpCanvasProps {
  userId: string;
}
const EditableFourUpCanvas: React.FC<IEditableFourUpCanvasProps> = props => {
  const groups = useGroupsStore();
  const group = groups.groupForUser(props.userId);
  return (
    <FourUpComponent group={group} />
  );
};

interface IDocumentCanvasProps {
  document: DocumentModelType;
  mode: WorkspaceMode;
  isPrimary: boolean;
  readOnly: boolean;
  showPlayback?: boolean;
}
const DocumentCanvas: React.FC<IDocumentCanvasProps> = props => {
  const { mode, isPrimary, document, readOnly, showPlayback } = props;
  const isFourUp = (document.type === ProblemDocument) && (isPrimary && (mode === "4-up"));
  return (
    <div className="canvas-area">
      {isFourUp
        ? <EditableFourUpCanvas userId={document.uid} />
        : <OneUpCanvas {...{document, readOnly, showPlayback}} />}
    </div>
  );
};

export interface IProps {
  className?: string;
  contained?: boolean;
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  showPlayback?: boolean;
  toolbar?: IToolbarModel;
  readOnly?: boolean;
  fullHeight?: boolean
  sectionClass?: string;
}
export function EditableDocumentContent({
  className, contained, mode, isPrimary, document, toolbar, readOnly, showPlayback, fullHeight, sectionClass
}: IProps) {
  const documentContext = useDocumentContext(document);
  const { db: { firebase, firestore }, ui, persistentUI, user, appConfig } = useStores();
  // set by the canvas and used by the toolbar
  const editableTileApiInterfaceRef: EditableTileApiInterfaceRef = useRef(null);
  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  let modifiedToolbar = toolbar;
  if (toolbar && isPrimary && DEBUG_HISTORY_VIEW) {
    // The snapshot is read-only so we need to clone it before modifying
    const toolbarSnapshot = clone(getSnapshot(toolbar));
    toolbarSnapshot.push({
      id: "historyView",
      title: "View History",
      iconId: "icon-history-view-tool",
      isPrimary: true,
      isTileTool: false,
      isBottom: true,
      isDefault: false,
      height: undefined
    });
    modifiedToolbar = ToolbarModel.create(toolbarSnapshot, { appIcons });
  }
  const isShowingToolbar = modifiedToolbar?.length;
  const showToolbarClass = isShowingToolbar ? "show-toolbar" : "hide-toolbar";
  const isChatEnabled = appConfig.showCommentPanelFor(user.type);
  const documentSelectedForComment = isChatEnabled && persistentUI.showChatPanel
                                     && ui.selectedTileIds.length === 0 && !isPrimary;
  const editableDocContentClass = classNames("editable-document-content", showToolbarClass, sectionClass,
    contained ? "contained-editable-document-content" : "full-screen-editable-document-content",
    {"comment-select" : documentSelectedForComment, "full-height": fullHeight}, className);

  useDocumentSyncToFirebase(user, firebase, firestore, document, readOnly);
  return (
    <DocumentContextReact.Provider value={documentContext}>
      <EditableTileApiInterfaceRefContext.Provider value={editableTileApiInterfaceRef}>
        <div key="editable-document" className={editableDocContentClass}
              data-focus-document={document.key} >
          {isShowingToolbar && modifiedToolbar && <DocumentToolbar document={document} toolbar={modifiedToolbar} />}
          {isShowingToolbar && <div className="canvas-separator"/>}
          <DocumentCanvas
            readOnly={isReadOnly}
            {...{mode, isPrimary, document, showPlayback}}
          />
        </div>
      </EditableTileApiInterfaceRefContext.Provider>
    </DocumentContextReact.Provider>
  );
}
