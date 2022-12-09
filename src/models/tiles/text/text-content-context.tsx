import React from "react";
import { TextContentModelType, createTextContent } from "./text-content";

// This default text content should never be used, but it is necessary
// so code using this context doesn't have to check for undefined
// FIXME: replace this with generic TileModel content instead

export const TextContentModelContext = React.createContext<TextContentModelType>(createTextContent());