import React from 'react';
import { observer } from 'mobx-react';
import { ToolbarSettings } from '../model/drawing-basic-types';

export interface IToolbarButtonSvgProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  settings?: Partial<ToolbarSettings>;
  // HEY: will need to pass `title` and use a tooltip...
}

export const ToolbarButtonSvg: React.FC<IToolbarButtonSvgProps> = observer(({SvgIcon, settings}) => {
  return SvgIcon
    ? <SvgIcon {...settings} />
    : null;
});
