import React, { useContext } from "react";
import { AppConfigContext } from "../../app-config-context";
import { CanvasComponent } from "./canvas";
import { DocumentContextReact } from "./document-context";
import { FourUpComponent } from "../four-up";
import { useDocumentContext } from "../../hooks/use-document-context";
import { useGroupsStore } from "../../hooks/use-stores";
import { useToolApiInterface } from "../../hooks/use-tool-api-interface";
import { ToolbarComponent, ToolbarConfig } from "../toolbar";
import { IToolApiInterface, IToolApiMap } from "../tools/tool-tile";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { WorkspaceMode } from "../../models/stores/workspace";

import "./editable-document-content.scss";

interface IToolbarProps {
  document: DocumentModelType;
  toolbar?: ToolbarConfig;
  toolApiMap: IToolApiMap;
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
  toolApiInterface: IToolApiInterface;
}
const OneUpCanvas: React.FC<IOneUpCanvasProps> = props => {
  return (
    <CanvasComponent context="1-up" {...props} />
  );
};

interface IEditableFourUpCanvasProps {
  userId: string;
  toolApiInterface: IToolApiInterface;
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
  const [toolApiMap, toolApiInterface] = useToolApiInterface();

  const isReadOnly = !isPrimary || readOnly || document.isPublished;
  const isShowingToolbar = !!toolbar && !isReadOnly;
  const showToolbarClass = isShowingToolbar ? "show-toolbar" : "hide-toolbar";
  return (
    <DocumentContextReact.Provider value={documentContext}>
      <div key="editable-document" className={`editable-document-content ${showToolbarClass}`} >
        {isShowingToolbar && <DocumentToolbar document={document} toolbar={toolbar} toolApiMap={toolApiMap} />}
        {isShowingToolbar && <div className="canvas-separator"/>}
        <DocumentCanvas mode={mode} isPrimary={isPrimary} document={document} readOnly={isReadOnly}
                        toolApiInterface={toolApiInterface} />
      </div>
    </DocumentContextReact.Provider>
  );
};
