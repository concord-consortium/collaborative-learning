import React, { useContext, useState } from "react";
import { clone } from "mobx-state-tree";
import { AppConfigContext } from "../../app-config-context";
import { IToolbarModel } from "../../models/stores/problem-configuration";
import { ToolbarComponent } from "../toolbar";
import { SectionModelType } from "src/models/curriculum/section";

interface IToolbarProps {
  section: SectionModelType;
  toolbar: IToolbarModel;
}

export const SectionToolbar: React.FC<IToolbarProps> = ({ toolbar, ...others }) => {
  const appConfig = useContext(AppConfigContext);

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
  return <ToolbarComponent key="toolbar" toolbarModel={toolbarModel} {...others} />;
};
