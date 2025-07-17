// declare modules that don't have TypeScript bindings here
declare module "d3-v6-tip";

declare module "*.png"

declare module "*.svg" {
  // cf. https://github.com/gregberge/svgr/issues/291#issuecomment-485235978
  // cf. https://github.com/gregberge/svgr/issues/359#issue-526324902
  import { FunctionComponent, SVGProps } from 'react';
  const _: FunctionComponent<SVGProps<SVGSVGElement>>;
  export = _;
}

type Maybe<T> = T | undefined
