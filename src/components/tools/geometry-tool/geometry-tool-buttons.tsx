import classNames from "classnames";
import React from "react";
// geometry icons
import AngleLabelSvg from "../../../clue/assets/icons/geometry/angle-label.svg";
import CopyPolygonSvg from "../../../clue/assets/icons/geometry/copy-polygon.svg";
import MovableLineSvg from "../../../clue/assets/icons/geometry/movable-line.svg";
// generic icons
import CommentSvg from "../../../assets/icons/comment/comment.svg";
import DeleteSvg from "../../../assets/icons/delete/delete.svg";

type SvgComponent = React.FC<React.SVGProps<SVGSVGElement>>;

export interface IClientToolButtonProps {
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}
interface IGeometryToolButtonProps extends IClientToolButtonProps {
  SvgComponent: SvgComponent;
  title: string;
  className: string;
}
export const GeometryToolButton: React.FC<IGeometryToolButtonProps> = ({
  SvgComponent, title, className, disabled, selected, onClick
}) => {
  const classes = classNames("button", className, { enabled: !disabled, disabled, selected });
  return (
    <div className={classes} title={title} onClick={onClick}>
      <SvgComponent />
    </div>
  );
};

/*
 * Geometry buttons
 */
export const AngleLabelButton: React.FC<IClientToolButtonProps> = (props) => {
  return <GeometryToolButton SvgComponent={AngleLabelSvg} title="Angle Label" className="angle-label" {...props}/>;
};

export const DuplicateButton: React.FC<IClientToolButtonProps> = (props) => {
  return <GeometryToolButton SvgComponent={CopyPolygonSvg} title="Duplicate" className="duplicate" {...props}/>;
};

export const MovableLineButton: React.FC<IClientToolButtonProps> = (props) => {
  return <GeometryToolButton SvgComponent={MovableLineSvg} title="Movable Line" className="movable-line" {...props}/>;
};

/*
 * Generic buttons
 */
export const CommentButton: React.FC<IClientToolButtonProps> = (props) => {
  return <GeometryToolButton SvgComponent={CommentSvg} title="Comment" className="comment" {...props}/>;
};

export const DeleteButton: React.FC<IClientToolButtonProps> = (props) => {
  return <GeometryToolButton SvgComponent={DeleteSvg} title="Delete" className="delete" {...props}/>;
};
