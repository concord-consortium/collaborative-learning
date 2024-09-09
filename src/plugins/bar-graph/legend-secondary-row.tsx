import React from 'react';
import { useBarGraphModelContext } from './bar-graph-content-context';

interface IProps {
  attrValue: string;
}

export function LegendSecondaryRow({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  return (
    <div key={attrValue} className="secondary-value">
      <div className="color-button">
        <div className="color-swatch" style={{ backgroundColor: model.getColorForSecondaryKey(attrValue) }} />
      </div>
      <div className="secondary-value-name">{attrValue}</div>
    </div>
  );
}

export default LegendSecondaryRow;
