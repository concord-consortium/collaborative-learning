import React from "react";
import { TextContentModelType, createTextContent } from "../../../models/tiles/text/text-content";

// This default text content should never be used, but it is necessary
// so code using this context doesn't have to check for undefined
// TODO: replace this with generic TileModel content instead
export const TextContentModelContext = React.createContext<TextContentModelType>(createTextContent());
