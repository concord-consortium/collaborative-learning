import React from 'react';
import classNames from 'classnames';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { displayValue, isMissingData } from './bar-graph-utils';

interface IProps {
  attrValue: string;
}

export function LegendSecondaryRow({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  const missingData = isMissingData(attrValue);
  const display = displayValue(attrValue);

  return (
    <div key={attrValue} className="secondary-value">
      <div className="color-button">
        <div className="color-swatch" style={{ backgroundColor: model.getColorForSecondaryKey(attrValue) }} />
      </div>
      <div className={classNames("secondary-value-name", { missing: missingData })}>
        {display}
      </div>
    </div>
  );
}

export default LegendSecondaryRow;
