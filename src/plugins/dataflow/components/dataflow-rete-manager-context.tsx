import React from "react";
import { ReteManager } from "../nodes/rete-manager";

export const DataflowReteManagerContext = React.createContext<ReteManager | null>(null);
