import React, { FunctionComponent, SVGProps } from "react";

export type IToolIcon = FunctionComponent<SVGProps<SVGSVGElement>>;
export type IToolIcons = Record<string, IToolIcon>;

export interface IAppConfigContext {
  toolIcons?: IToolIcons;
}

export const AppConfigContext = React.createContext<IAppConfigContext>({});
