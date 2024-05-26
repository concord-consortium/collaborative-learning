import React from 'react';
import { observer } from 'mobx-react';
import { ToolbarSettings } from '../model/drawing-basic-types';

export interface IToolbarButtonSvgProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  settings?: Partial<ToolbarSettings>;
}

export const ToolbarButtonSvg: React.FC<IToolbarButtonSvgProps> = observer(({SvgIcon, settings}) => {
  const { fill, stroke, strokeDashArray, strokeWidth, vectorType } = settings || {};

  const lowerCaseSettings = {
    fill,
    stroke,
    strokeWidth,
    "strokeDasharray": strokeDashArray,
    "vectortype": vectorType
  };

  return SvgIcon ? <SvgIcon {...lowerCaseSettings} /> : null;
});
