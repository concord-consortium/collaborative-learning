import React from "react";
import { DrawingObjectType, ObjectTypeIconViewBox, isStrokedObject, isFilledObject } from "../objects/drawing-object";
import { getVectorTypeIcon } from "../model/drawing-icons";
import { vectorTypeForEndShapes } from "../model/drawing-basic-types";
import { isVectorObject } from "../objects/vector";
import { isTextObject } from "../objects/text";

// Import all icon components
import EllipseToolIcon from "../assets/ellipse-icon.svg";
import RectToolIcon from "../assets/rectangle-icon.svg";
import TextToolIcon from "../../../assets/icons/comment/comment.svg";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";
import GroupObjectsIcon from "../assets/group-objects-icon.svg";
import FreehandToolIcon from "../assets/freehand-icon.svg";
import ErrorIcon from "../../../assets/icons/error.svg";

interface IObjectIconProps {
  type: string;
  object: DrawingObjectType;
}

export const ObjectIcon: React.FC<IObjectIconProps> = ({ type, object }) => {
  switch (type) {
    case "ellipse": {
      if (!isStrokedObject(object) || !isFilledObject(object)) {
        return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
      }
      return (
        <EllipseToolIcon
          viewBox={ObjectTypeIconViewBox}
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          strokeDasharray={object.strokeDashArray}
        />
      );
    }

    case "rectangle": {
      if (!isStrokedObject(object) || !isFilledObject(object)) {
        return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
      }
      return (
        <RectToolIcon
          viewBox={ObjectTypeIconViewBox}
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          strokeDasharray={object.strokeDashArray}
        />
      );
    }

    case "text": {
      if (!isTextObject(object)) {
        return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
      }
      return (
        <TextToolIcon
          viewBox={ObjectTypeIconViewBox}
          fill={object.stroke}
        />
      );
    }

    case "image":
      return (
        <ImageToolIcon
          viewBox={ObjectTypeIconViewBox}
        />
      );

    case "group":
      return (
        <GroupObjectsIcon
          viewBox={ObjectTypeIconViewBox}
        />
      );

    case "line":
      if (!isStrokedObject(object)) {
        return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
      }
      return (
        <FreehandToolIcon
          viewBox={ObjectTypeIconViewBox}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          strokeDasharray={object.strokeDashArray}
        />
      );

    case "vector": {
      if (!isVectorObject(object) || !isStrokedObject(object)) {
        return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
      }
      const Icon = getVectorTypeIcon(vectorTypeForEndShapes(object.headShape, object.tailShape));
      return (
        <Icon
          viewBox={ObjectTypeIconViewBox}
          stroke={object.stroke}
          fill={object.stroke}
        />
      );
    }

    default:
      // Unknown object type
      return <ErrorIcon viewBox={ObjectTypeIconViewBox} />;
  }
};
