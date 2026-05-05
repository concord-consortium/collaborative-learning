// Module augmentation for react-tippy@1.4. The bundled index.d.ts declares
// `class Tooltip extends React.Component<TooltipProps>` but TooltipProps
// has no `children`. Under @types/react@18, Component no longer implicitly
// allows children, so callers fail with TS2769. This adds children back to
// the published TooltipProps interface via declaration merging.
//
// This file must be a module (the empty export below) for the
// `declare module` block to act as augmentation rather than override.
import type { ReactNode } from "react";

declare module "react-tippy" {
  interface TooltipProps {
    children?: ReactNode;
  }
}

export {};
