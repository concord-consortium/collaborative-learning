import React, { useContext, useRef } from "react";
import { AppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContextReact } from "./document-context";
import { FourUpComponent } from "../four-up";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useGroupsStore } from "../../hooks/use-stores";
import { ToolbarComponent, ToolbarConfig } from "../toolbar";
import { EditableToolApiInterfaceRef, EditableToolApiInterfaceRefContext } from "../tools/tool-api";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { WorkspaceMode } from "../../models/stores/workspace";

import "./editable-document-content.scss";
import classNames from "classnames";

interface IToolbarProps {
  document: DocumentModelType;
  toolbar?: ToolbarConfig;
}
const DocumentToolbar: React.FC<IToolbarProps> = ({ toolbar, ...others }) => {
  const appConfig = useContext(AppConfigContext);
  const toolbarConfig = toolbar?.map(tool => ({ icon: appConfig.appIcons?.[tool.iconId], ...tool }));
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
  documentSelectedForComment?: boolean;
}
export const EditableDocumentContent: React.FC<IProps> = props => {
  const { mode, isPrimary, document, toolbar, readOnly, documentSelectedForComment } = props;

  const documentContext = useDocumentContext(document);

  // set by the canvas and used by the toolbar
  const editableToolApiInterfaceRef: EditableToolApiInterfaceRef = useRef(null);

  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  const showToolbarClass = isShowingToolbar ? "show-toolbar" : "hide-toolbar";
  const editableDocContentClass = classNames("editable-document-content", showToolbarClass,
                                             documentSelectedForComment ? "comment-select" : "");
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
