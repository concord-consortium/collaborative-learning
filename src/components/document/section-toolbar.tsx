import React, { useContext, useState } from "react";
import { clone } from "mobx-state-tree";
import { AppConfigContext } from "../../app-config-context";
import { IToolbarModel } from "../../models/stores/problem-configuration";
import { OnToolClickedHandler, ToolbarComponent } from "../toolbar";
import { useAriaLabels } from "../../hooks/use-aria-labels";
import { SectionModelType } from "src/models/curriculum/section";

interface IToolbarProps {
  section: SectionModelType;
  toolbar: IToolbarModel;
  onToolClicked?: OnToolClickedHandler;
}

// This component is used to render the toolbar for a section.
// It is a wrapper around the ToolbarComponent that sets the toolbar model and section for the toolbar.
// In the future, it will look at elements in the section and update the toolbar model accordingly.
export const SectionToolbar: React.FC<IToolbarProps> = ({ toolbar, ...others }) => {
  const appConfig = useContext(AppConfigContext);
  const ariaLabels = useAriaLabels();

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
    <ToolbarComponent key="toolbar" toolbarModel={toolbarModel} ariaLabel={ariaLabels.lessonToolbar} {...others} />
  );
};
