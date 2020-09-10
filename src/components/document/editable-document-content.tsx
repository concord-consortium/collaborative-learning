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

interface IEditableFourUpCanvasProps {
  userId: string;
  toolApiInterface: IToolApiInterface;
}
const EditableFourUpCanvas: React.FC<IEditableFourUpCanvasProps> = ({ userId, toolApiInterface}) => {
  const groups = useGroupsStore();
  const group = groups.groupForUser(userId);
  return (
    <FourUpComponent userId={userId} groupId={group?.id} toolApiInterface={toolApiInterface} />
  );
};

interface IDocumentCanvasProps {
  mode: WorkspaceMode;
  isPrimary: boolean;
  document: DocumentModelType;
  readOnly: boolean;
  toolApiInterface: IToolApiInterface;
}
const DocumentCanvas: React.FC<IDocumentCanvasProps> = props => {
  const { mode, isPrimary, document, readOnly, toolApiInterface } = props;
  const isFourUp = (document.type === ProblemDocument) && (isPrimary && (mode === "4-up"));
  return (
    <div className="canvas-area">
      {isFourUp
        ? <EditableFourUpCanvas userId={document.uid} toolApiInterface={toolApiInterface} />
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
}
export const EditableDocumentContent: React.FC<IProps> = props => {
  const { mode, isPrimary, document, toolbar, readOnly } = props;

  const documentContext = useDocumentContext(document);
  const [toolApiMap, toolApiInterface] = useToolApiInterface();

  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  return (
    <DocumentContext.Provider value={documentContext}>
      <div key="editable-document" className="editable-document-content" >
        {isShowingToolbar && <DocumentToolbar document={document} toolbar={toolbar} toolApiMap={toolApiMap} />}
        {isShowingToolbar && <div className="canvas-separator"/>}
        <DocumentCanvas mode={mode} isPrimary={isPrimary} document={document} readOnly={isReadOnly}
                        toolApiInterface={toolApiInterface} />
      </div>
    </DocumentContext.Provider>
  );
};
