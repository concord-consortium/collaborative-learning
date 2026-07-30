import React from "react";
import { ReteManager } from "../rete/rete-manager";

export const DataflowReteManagerContext = React.createContext<ReteManager | null>(null);
