import { FunctionComponent, SVGProps } from "react";
// workspace icons
import CopyWorkspaceIcon from "../assets/icons/copy/copy-icon-default.svg";
import DeleteWorkspaceIcon from "../assets/icons/delete/delete-workspace-icon-default.svg";
import OpenWorkspaceIcon from "../assets/icons/1-4-up/1-up-icon-default.svg";
import PublishWorkspaceIcon from "../assets/icons/publish/publish-icon-default.svg";
// tool icons
import DeleteToolIcon from "./assets/icons/delete-tool.svg";
import DuplicateToolIcon from "./assets/icons/duplicate-tool.svg";
import HideAnnotationsIcon from "./assets/icons/hide-annotations-tool.svg";
import RedoToolIcon from "./assets/icons/redo-tool.svg";
import SelectToolIcon from "./assets/icons/select-tool.svg";
import ShowAnnotationsIcon from "./assets/icons/show-annotations-tool.svg";
import SolutionToolIcon from "./assets/icons/solution-tool.svg";
import SparrowToolIcon from "./assets/icons/sparrow-tool.svg";
import UndoToolIcon from "./assets/icons/undo-tool.svg";

export const appIcons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  // workspace icons
  "icon-copy-workspace": CopyWorkspaceIcon,
  "icon-delete-workspace": DeleteWorkspaceIcon,
  "icon-new-workspace": OpenWorkspaceIcon,
  "icon-open-workspace": OpenWorkspaceIcon,
  "icon-publish-workspace": PublishWorkspaceIcon,

  // built in tool action icons
  "icon-delete-tool": DeleteToolIcon,
  "icon-duplicate-tool": DuplicateToolIcon,
  "icon-hide-annotations-tool": HideAnnotationsIcon,
  "icon-redo-tool": RedoToolIcon,
  "icon-select-tool": SelectToolIcon,
  "icon-show-annotations-tool": ShowAnnotationsIcon,
  "icon-solution-tool": SolutionToolIcon,
  "icon-sparrow-tool": SparrowToolIcon,
  "icon-undo-tool": UndoToolIcon

  // Icons for tool tiles are not stored here.
  // Components that need them should get them from the tool content info.
};
