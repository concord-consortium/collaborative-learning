import React from "react";
import { TFormatterProps } from "./table-types";
import { useNumberFormat } from "./use-number-format";

export const formatValue = (formatter: (n: number | { valueOf(): number }) => string, value: any) => {
  if ((value == null) || (value === "")) return <span></span>;
  const num = Number(value);
  if (!isFinite(num)) {
    return (
      <div style={{height: 240, width: 80, whiteSpace: 'normal',
      overflowWrap: 'break-word', textAlign: 'left'}}>
        {value}
      </div>
    );
  }
  return <span>{formatter(num)}</span>;
};

export const CellFormatter: React.FC<TFormatterProps> = ({ column, row }) => {
  const formatter = useNumberFormat();
  return formatValue(formatter, row[column.key]);
};
