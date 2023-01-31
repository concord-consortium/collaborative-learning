import React from "react";
import { TextContentModelType, createTextContent } from "../../../models/tiles/text/text-content";

// This default text content should never be used, but it is necessary
// so code using this context doesn't have to check for undefined
// FIXME: replace this with generic TileModel content instead
// FIXME: do we have to start this out with an empty content?
export const TextContentModelContext = React.createContext<TextContentModelType>(createTextContent());
