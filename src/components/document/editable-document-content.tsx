import React, { useContext, useRef } from "react";
import classNames from "classnames";
import { AppConfigContext, IAppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContextReact } from "./document-context";
import { FourUpComponent } from "../four-up";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useGroupsStore, useUIStore, useUserStore } from "../../hooks/use-stores";
import { ToolbarComponent, ToolbarConfig } from "../toolbar";
import { EditableToolApiInterfaceRef, EditableToolApiInterfaceRefContext } from "../tools/tool-api";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { WorkspaceMode } from "../../models/stores/workspace";

import "./editable-document-content.scss";
import { getToolContentInfoByTool } from "../../models/tools/tool-content-info";
import { IToolButtonConfig } from "../tool-button";

interface IToolbarProps {
  document: DocumentModelType;
  toolbar?: ToolbarConfig;
}

function getToolbarIcon(tool: IToolButtonConfig, appConfig: IAppConfigContext) {
  if (tool.isTileTool) {
    return getToolContentInfoByTool(tool.name).icon;
  } else {
    return appConfig.appIcons?.[tool.iconId];
  }
}

const DocumentToolbar: React.FC<IToolbarProps> = ({ toolbar, ...others }) => {
  const appConfig = useContext(AppConfigContext);
  const toolbarConfig = toolbar?.map(tool => ({ icon: getToolbarIcon(tool, appConfig), ...tool }));
  return toolbarConfig
          ? <ToolbarComponent key="toolbar" config={toolbarConfig} {...others} />
          : null;
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
  toolbar?: ToolbarConfig;
  readOnly?: boolean;
}
export const EditableDocumentContent: React.FC<IProps> = props => {
  const { mode, isPrimary, document, toolbar, readOnly } = props;

  const documentContext = useDocumentContext(document);
  const ui = useUIStore();
  const { isNetworkedTeacher } = useUserStore();

  // set by the canvas and used by the toolbar
  const editableToolApiInterfaceRef: EditableToolApiInterfaceRef = useRef(null);

  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  const showToolbarClass = isShowingToolbar ? "show-toolbar" : "hide-toolbar";
  const isChatEnabled = isNetworkedTeacher;
  const documentSelectedForComment = isChatEnabled && ui.showChatPanel && ui.selectedTileIds.length === 0 && !isPrimary;
  const editableDocContentClass = classNames("editable-document-content", showToolbarClass,
                                             {"comment-select" : documentSelectedForComment});
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
