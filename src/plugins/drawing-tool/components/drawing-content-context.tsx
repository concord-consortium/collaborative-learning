import React from "react";
import { DrawingContentModelType, createDrawingContent } from "../model/drawing-content";

// This default drawing content should never be used, but it is necessary
// so code using this context doesn't have to check for undefined

export const DrawingContentModelContext = React.createContext<DrawingContentModelType>(createDrawingContent());
