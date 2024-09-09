import React from 'react';
import { useBarGraphModelContext } from './bar-graph-content-context';

interface IProps {
  attrValue: string;
}

export function LegendSecondaryRow({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  return (
    <div key={attrValue} className="secondaryValue">
      <div className="colorButton">
        <div className="colorSwatch" style={{ backgroundColor: model.getColorForSecondaryKey(attrValue) }} />
      </div>
      <div className="secondaryValueName">{attrValue}</div>
    </div>
  );
}

export default LegendSecondaryRow;
