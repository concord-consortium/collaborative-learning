import React, { useContext, useRef, useState } from "react";
import classNames from "classnames";
import { clone } from "mobx-state-tree";
import { AppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContextReact } from "./document-context";
import { FourUpComponent } from "../four-up";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useDocumentSyncToFirebase } from "../../hooks/use-document-sync-to-firebase";
import { useGroupsStore, useStores, useUIStore, useUserStore } from "../../hooks/use-stores";
import { ToolbarComponent } from "../toolbar";
import { EditableToolApiInterfaceRef, EditableToolApiInterfaceRefContext } from "../tools/tool-api";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { ToolbarModelType } from "../../models/stores/problem-configuration";
import { WorkspaceMode } from "../../models/stores/workspace";

import "./editable-document-content.scss";

interface IToolbarProps {
  document: DocumentModelType;
  toolbar: ToolbarModelType;
}

const DocumentToolbar: React.FC<IToolbarProps> = ({ toolbar, ...others }) => {
  const appConfig = useContext(AppConfigContext);

  // The toolbar prop represents the app's configuration of the toolbar
  // It is cloned here in the document so changes to one document's toolbar
  // do not affect another document's toolbar.
  // Currently the toolbar model is not modified, but it seems safer to do this.
  // The cloned model is stored in state so it isn't recreated on each render
  const [toolbarModel] = useState<ToolbarModelType>(() => {
      // The new model is passed the appIcons as its environment, so the model
      // can lookup an app level Icon if needed.
      return clone(toolbar, { appIcons: appConfig.appIcons });
  });
  return <ToolbarComponent key="toolbar" toolbarModel={toolbarModel} {...others} />;
};

interface IOneUpCanvasProps {
  document: DocumentModelType;
  readOnly: boolean;
}
const OneUpCanvas: React.FC<IOneUpCanvasProps> = props => {
  return (
    <CanvasComponent context="1-up" {...props} />
  );
};

interface IEditableFourUpCanvasProps {
  userId: string;
}
const EditableFourUpCanvas: React.FC<IEditableFourUpCanvasProps> = props => {
  const groups = useGroupsStore();
  const group = groups.groupForUser(props.userId);
  return (
    <FourUpComponent groupId={group?.id} {...props} />
  );
};

interface IDocumentCanvasProps {
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  readOnly: boolean;
}
const DocumentCanvas: React.FC<IDocumentCanvasProps> = props => {
  const { mode, isPrimary, document, readOnly } = props;
  const isFourUp = (document.type === ProblemDocument) && (isPrimary && (mode === "4-up"));
  return (
    <div className="canvas-area">
      {isFourUp
        ? <EditableFourUpCanvas userId={document.uid} />
        : <OneUpCanvas document={document} readOnly={readOnly} />}
    </div>
  );
};

export interface IProps {
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  toolbar?: ToolbarModelType;
  readOnly?: boolean;
}
export const EditableDocumentContent: React.FC<IProps> = props => {
  const { mode, isPrimary, document, toolbar, readOnly } = props;

  const documentContext = useDocumentContext(document);
  const { db: { firebase }, ui, user } = useStores();
  const { isNetworkedTeacher } = user;

  // set by the canvas and used by the toolbar
  const editableToolApiInterfaceRef: EditableToolApiInterfaceRef = useRef(null);

  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  const showToolbarClass = isShowingToolbar ? "show-toolbar" : "hide-toolbar";
  const isChatEnabled = isNetworkedTeacher;
  const documentSelectedForComment = isChatEnabled && ui.showChatPanel && ui.selectedTileIds.length === 0 && !isPrimary;
  const editableDocContentClass = classNames("editable-document-content", showToolbarClass,
                                             {"comment-select" : documentSelectedForComment});

  useDocumentSyncToFirebase(user, firebase, document, readOnly);

  return (
    <DocumentContextReact.Provider value={documentContext}>
      <EditableToolApiInterfaceRefContext.Provider value={editableToolApiInterfaceRef}>
        <div key="editable-document" className={editableDocContentClass}
              data-focus-document={document.key} >
          {isShowingToolbar && <DocumentToolbar document={document} toolbar={toolbar} />}
          {isShowingToolbar && <div className="canvas-separator"/>}
          <DocumentCanvas mode={mode} isPrimary={isPrimary} document={document} readOnly={isReadOnly} />
        </div>
      </EditableToolApiInterfaceRefContext.Provider>
    </DocumentContextReact.Provider>
  );
};
