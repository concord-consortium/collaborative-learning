import React from 'react';
import classNames from 'classnames';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { isMissingData } from './bar-graph-utils';

interface IProps {
  attrValue: string;
}

export function LegendSecondaryRow({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  const missingData = isMissingData(attrValue);

  return (
    <div key={attrValue} className="secondary-value">
      <div className="color-button">
        <div className="color-swatch" style={{ backgroundColor: model.getColorForSecondaryKey(attrValue) }} />
      </div>
      <div className={classNames("secondary-value-name", { missing: missingData })}>
        {attrValue}
      </div>
    </div>
  );
}

export default LegendSecondaryRow;
