import React from 'react';
import { observer } from 'mobx-react';
import { ToolbarSettings } from '../model/drawing-basic-types';

export interface IToolbarButtonSvgProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  settings?: Partial<ToolbarSettings>;
}

export const ToolbarButtonSvg: React.FC<IToolbarButtonSvgProps> = observer(({SvgIcon, settings}) => {
  const { fill, stroke, strokeDashArray, strokeWidth } = settings || {};

  // The basic properties are both set on the SVG itself, for simple icons,
  /// and passed in as CSS variables for use in more complex icons (where certain elements'
  // fill needs to be set to the stroke color, for instance).
  const style = {
    "--fill-color": fill,
    "--stroke-color": stroke,
    "--stroke-width": strokeWidth,
    "--stroke-dasharray": strokeDashArray } as React.CSSProperties;

  const lowerCaseSettings = {
    fill,
    stroke,
    strokeWidth,
    "strokeDasharray": strokeDashArray,
    style
  };

  return SvgIcon ? <SvgIcon {...lowerCaseSettings} /> : null;
});
