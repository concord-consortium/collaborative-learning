import React from "react";
import {
  Menu as ChakraMenu,
  MenuButton as ChakraMenuButton,
  MenuItem as ChakraMenuItem,
  MenuList as ChakraMenuList,
  Portal as ChakraPortal,
} from "@chakra-ui/react";

// Re-export Chakra v1 menu components cast to non-polymorphic types.
// TypeScript 5 produces TS2590 "union type too complex" errors on Chakra v1's
// polymorphic `as`-prop typings, and the errors surface non-deterministically
// across `tsc --noEmit` and webpack's `ts-loader`. Casting away the polymorphism
// drops the cumulative complexity below TS's threshold.
//
// TODO: Delete this file when upgrading to Chakra v2 — v2's typings no longer
// trigger TS2590, and direct imports from "@chakra-ui/react" provide stricter
// prop types and the `as` polymorphism we drop here. Cleanup steps:
//   1. Delete this file.
//   2. Restore `@chakra-ui/react` imports in the files that import from here.
//   3. Remove the `@ts-expect-error` directive in
//      src/plugins/bar-graph/legend-color-row.tsx (same root cause).
//   4. Verify `npm run check:types` and `npm run build:webpack` both pass.

type MenuRenderProps = { isOpen: boolean };
type MenuPropsLite = {
  boundary?: string;
  children?: React.ReactNode | ((props: MenuRenderProps) => React.ReactNode);
};
type MenuButtonPropsLite = React.ButtonHTMLAttributes<HTMLButtonElement>;
type MenuListPropsLite = React.HTMLAttributes<HTMLDivElement>;
type MenuItemPropsLite = React.HTMLAttributes<HTMLButtonElement> & {
  isDisabled?: boolean;
};
type PortalPropsLite = {
  children?: React.ReactNode;
  containerRef?: React.RefObject<HTMLElement | null>;
};

export const Menu = ChakraMenu as React.ComponentType<MenuPropsLite>;
export const MenuButton = ChakraMenuButton as React.ComponentType<MenuButtonPropsLite>;
export const MenuList = ChakraMenuList as React.ComponentType<MenuListPropsLite>;
export const MenuItem = ChakraMenuItem as React.ComponentType<MenuItemPropsLite>;
export const Portal = ChakraPortal as React.ComponentType<PortalPropsLite>;
