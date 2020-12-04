import { TFormatterProps } from "./table-types";
import { useNumberFormat } from "./use-number-format";

export const formatValue = (formatter: (n: number | { valueOf(): number }) => string, value: any) => {
  if ((value == null) || (value === "")) return "";
  const num = Number(value);
  if (!isFinite(num)) return value;
  return formatter(num);
};

export const CellFormatter: React.FC<TFormatterProps> = ({ column, row }) => {
  const formatter = useNumberFormat();
  return formatValue(formatter, row[column.key]);
};
