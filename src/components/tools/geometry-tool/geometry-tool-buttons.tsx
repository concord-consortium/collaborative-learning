import classNames from "classnames";
import React from "react";
import { Tooltip } from "react-tippy";
// geometry icons
import AngleLabelSvg from "../../../clue/assets/icons/geometry/angle-label.svg";
import CopyPolygonSvg from "../../../clue/assets/icons/geometry/copy-polygon.svg";
import LineLabelSvg from "../../../clue/assets/icons/geometry/line-label.svg";
import MovableLineSvg from "../../../clue/assets/icons/geometry/movable-line.svg";
// generic icons
import CommentSvg from "../../../assets/icons/comment/comment.svg";
import DeleteSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";

type SvgComponent = React.FC<React.SVGProps<SVGSVGElement>>;

export interface IClientToolButtonProps {
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}
interface IGeometryToolButtonProps extends IClientToolButtonProps {
  SvgComponent: SvgComponent;
  className: string;
}
export const GeometryToolButton: React.FC<IGeometryToolButtonProps> = ({
  SvgComponent, className, disabled, selected, onClick
}) => {
  const classes = classNames("button", className, { enabled: !disabled, disabled, selected });
  return (
    <div className={classes} onClick={onClick}>
      <SvgComponent />
    </div>
  );
};

/*
 * Geometry buttons
 */
const kTooltipYDistance = 2;
export const AngleLabelButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Angle label" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={AngleLabelSvg} className="angle-label" {...props}/>
    </Tooltip>
  );
};

export const DuplicateButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Duplicate" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={CopyPolygonSvg} className="duplicate" {...props}/>
    </Tooltip>
  );
};

export const LineLabelButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Line label" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={LineLabelSvg} className="line-label" {...props}/>
    </Tooltip>
  );
};

export const MovableLineButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Movable line" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={MovableLineSvg} className="movable-line" {...props}/>
    </Tooltip>
  );
};

/*
 * Generic buttons
 */
export const CommentButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Comment" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={CommentSvg} className="comment" {...props}/>
    </Tooltip>
  );
};

export const DeleteButton: React.FC<IClientToolButtonProps> = (props) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });
  return (
    <Tooltip title="Delete" {...tooltipOptions}>
      <GeometryToolButton SvgComponent={DeleteSvg} className="delete" {...props}/>
    </Tooltip>
  );
};
