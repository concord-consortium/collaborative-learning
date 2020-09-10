import React, { useContext } from "react";
import { AppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContext } from "./document-context";
import { FourUpComponent } from "../four-up";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useGroupsStore } from "../../hooks/use-stores";
import { useToolApiInterface } from "../../hooks/use-tool-api-interface";
import { ToolbarComponent, ToolbarConfig } from "../toolbar";
import { IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { DocumentModelType, ProblemDocument } from "../../models/document/document";
import { WorkspaceMode } from "../../models/stores/workspace";

import "./editable-document-content.scss";

interface IToolbarProps {
  document: DocumentModelType;
  toolbar?: ToolbarConfig;
  toolApiMap: IToolApiMap;
}
const DocumentToolbar: React.FC<IToolbarProps> = ({ document, toolbar, toolApiMap }) => {
  const appConfig = useContext(AppConfigContext);
  const toolbarConfig = toolbar?.map(tool => ({ icon: appConfig.appIcons?.[tool.iconId], ...tool }));
  return toolbarConfig
          ? <ToolbarComponent key="toolbar" document={document} config={toolbarConfig} toolApiMap={toolApiMap} />
          : null;
};

interface IOneUpCanvasProps {
  document: DocumentModelType;
  readOnly: boolean;
  toolApiInterface: IToolApiInterface;
}
const OneUpCanvas: React.FC<IOneUpCanvasProps> = ({ document, readOnly, toolApiInterface}) => {
  return (
    <CanvasComponent context="1-up" document={document} readOnly={readOnly} toolApiInterface={toolApiInterface} />
  );
};

interface IFourUpCanvasProps {
  userId: string;
  isGhostUser: boolean;
  toolApiInterface: IToolApiInterface;
}
const FourUpCanvas: React.FC<IFourUpCanvasProps> = ({ userId, isGhostUser, toolApiInterface}) => {
  const groups = useGroupsStore();
  const group = isGhostUser ? undefined : groups.groupForUser(userId);
  const groupId = isGhostUser ? groups.ghostGroupId : group?.id;
  return (
    <FourUpComponent userId={userId} groupId={groupId} isGhostUser={isGhostUser}
                      toolApiInterface={toolApiInterface} />
  );
};

interface IDocumentCanvasProps {
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  readOnly: boolean;
  isGhostUser: boolean;
  toolApiInterface: IToolApiInterface;
}
const DocumentCanvas: React.FC<IDocumentCanvasProps> = props => {
  const { mode, isPrimary, document, readOnly, isGhostUser, toolApiInterface } = props;
  const isFourUp = (document.type === ProblemDocument) && (isGhostUser || (isPrimary && (mode === "4-up")));
  return (
    <div className="canvas-area">
      {isFourUp
        ? <FourUpCanvas userId={document.uid} isGhostUser={isGhostUser} toolApiInterface={toolApiInterface} />
        : <OneUpCanvas document={document} readOnly={readOnly} toolApiInterface={toolApiInterface} />}
    </div>
  );

};

interface IProps {
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  toolbar?: ToolbarConfig;
  readOnly?: boolean;
  isGhostUser?: boolean;
}
export const EditableDocumentContent: React.FC<IProps> = props => {
  const { mode, isPrimary, document, toolbar, readOnly, isGhostUser } = props;

  const documentContext = useDocumentContext(document);
  const [toolApiMap, toolApiInterface] = useToolApiInterface();

  const isReadOnly = !isPrimary || isGhostUser || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  return (
    <DocumentContext.Provider value={documentContext}>
      <div key="editable-document" className="editable-document-content" >
        {isShowingToolbar && <DocumentToolbar document={document} toolbar={toolbar} toolApiMap={toolApiMap} />}
        {isShowingToolbar && <div className="canvas-separator"/>}
        <DocumentCanvas mode={mode} isPrimary={isPrimary} document={document} readOnly={isReadOnly}
                        isGhostUser={!!isGhostUser} toolApiInterface={toolApiInterface} />
      </div>
    </DocumentContext.Provider>
  );
};
