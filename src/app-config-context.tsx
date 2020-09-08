import React, { FunctionComponent, SVGProps } from "react";

export type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;
export type IconComponents = Record<string, IconComponent>;

export interface IAppConfigContext {
  appIcons?: IconComponents;
}

export const AppConfigContext = React.createContext<IAppConfigContext>({});
