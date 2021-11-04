import { FunctionComponent, SVGProps } from "react";
// workspace icons
import CopyWorkspaceIcon from "../assets/icons/copy/copy-icon-default.svg";
import DeleteWorkspaceIcon from "../assets/icons/delete/delete-workspace-icon-default.svg";
import OpenWorkspaceIcon from "../assets/icons/1-4-up/1-up-icon-default.svg";
// tool icons
import DeleteToolIcon from "./assets/icons/delete-tool.svg";
import RedoToolIcon from "./assets/icons/redo-tool.svg";
import SelectToolIcon from "./assets/icons/select-tool.svg";
import UndoToolIcon from "./assets/icons/undo-tool.svg";

export const appIcons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  // workspace icons
  "icon-copy-workspace": CopyWorkspaceIcon,
  "icon-delete-workspace": DeleteWorkspaceIcon,
  "icon-new-workspace": OpenWorkspaceIcon,
  "icon-open-workspace": OpenWorkspaceIcon,
  
  // built in tool action icons
  "icon-delete-tool": DeleteToolIcon,
  "icon-redo-tool": RedoToolIcon,
  "icon-select-tool": SelectToolIcon,
  "icon-undo-tool": UndoToolIcon

  // icons for tool tiles are added by registerToolContentInfo
};
