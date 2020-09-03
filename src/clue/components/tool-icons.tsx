import { FunctionComponent, SVGProps } from "react";
import DeleteToolIcon from "../assets/icons/delete-tool.svg";
import DrawingToolIcon from "../assets/icons/draw-tool.svg";
import GeometryToolIcon from "../assets/icons/graph-tool.svg";
import ImageToolIcon from "../assets/icons/image-tool.svg";
import RedoToolIcon from "../assets/icons/redo-tool.svg";
import SelectToolIcon from "../assets/icons/select-tool.svg";
import TableToolIcon from "../assets/icons/table-tool.svg";
import TextToolIcon from "../assets/icons/text-tool.svg";
import UndoToolIcon from "../assets/icons/undo-tool.svg";

export const gToolIcons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  "icon-delete-tool": DeleteToolIcon,
  "icon-drawing-tool": DrawingToolIcon,
  "icon-geometry-tool": GeometryToolIcon,
  "icon-image-tool": ImageToolIcon,
  "icon-redo-tool": RedoToolIcon,
  "icon-select-tool": SelectToolIcon,
  "icon-table-tool": TableToolIcon,
  "icon-text-tool": TextToolIcon,
  "icon-undo-tool": UndoToolIcon
};
