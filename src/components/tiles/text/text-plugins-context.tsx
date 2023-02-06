import React from "react";
import { ITextPlugin } from "src/models/tiles/text/text-plugin-info";

export const TextPluginsContext = React.createContext<Record<string, ITextPlugin|undefined>>({});
