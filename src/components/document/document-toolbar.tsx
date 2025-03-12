import React, { useContext, useEffect, useState } from "react";
import { reaction } from "mobx";
import { clone } from "mobx-state-tree";
import { AppConfigContext } from "../../app-config-context";
import { DocumentModelType } from "../../models/document/document";
import { IToolbarModel } from "../../models/stores/problem-configuration";
import { OnToolClickedHandler, ToolbarComponent } from "../toolbar";
import { useStores } from "../../hooks/use-stores";

interface IToolbarProps {
  disabledToolIds?: string[];
  // the document is undefined when the toolbar is used in a 4-up view
  document?: DocumentModelType;
  toolbar: IToolbarModel;
  onToolClicked?: OnToolClickedHandler;
}

// This component is used to render the toolbar for a document.
// It is a wrapper around the ToolbarComponent that sets the toolbar model and document for the toolbar.
// It also listens for changes to the primary document key and disables the edit button
// if the document is the primary document.
export const DocumentToolbar: React.FC<IToolbarProps> = ({ document, toolbar, disabledToolIds, ...others }) => {
  const appConfig = useContext(AppConfigContext);
  const { persistentUI } = useStores();
  const [primaryDocumentKey, setPrimaryDocumentKey] =
    useState<string | undefined>(persistentUI.problemWorkspace.primaryDocumentKey);
  const [locallyDisabledToolIds, setLocallyDisabledToolIds] = useState<string[]>([]);

  // listen for changes to the primary document key
  useEffect(() => {
    const dispose = reaction(
      () => persistentUI.problemWorkspace.primaryDocumentKey,
      (docKey) => setPrimaryDocumentKey(docKey),
    );
    return () => dispose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // disable the edit button if this document is the current primary document
  useEffect(() => {
    setLocallyDisabledToolIds(() => {
      if (document?.key === primaryDocumentKey) {
        return ["edit"];
      }
      return [];
    });
  }, [document?.key, primaryDocumentKey]);

  // The toolbar prop represents the app's configuration of the toolbar
  // It is cloned here in the document so changes to one document's toolbar
  // do not affect another document's toolbar.
  // Currently the toolbar model is not modified, but it seems safer to do this.
  // The cloned model is stored in state so it isn't recreated on each render
  const [toolbarModel] = useState<IToolbarModel>(() => {
      // The new model is passed the appIcons as its environment, so the model
      // can lookup an app level Icon if needed.
      return clone(toolbar, { appIcons: appConfig.appIcons });
  });

  return (
    <ToolbarComponent
      key="toolbar"
      toolbarModel={toolbarModel}
      document={document}
      disabledToolIds={[...locallyDisabledToolIds, ...(disabledToolIds ?? [])]}
      {...others}
    />
  );
};
