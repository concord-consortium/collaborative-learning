import { useCallback, useRef } from "react";
import { kExpressionCellPadding, kHeaderCellPadding } from "./table-types";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { prettifyExpression } from "../../../models/data/expression-utils";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";

interface IUseColumnsFromDataSet {
  dataSet: IDataSet;
  metadata: TableMetadataModelType;
  measureText: (text: string) => number;
}
export const useMeasureColumnWidth = ({
  dataSet, metadata, measureText
}: IUseColumnsFromDataSet) => {
  // user-modified column widths aren't currently saved or shared between views of the same document
  const userColumnWidths = useRef<Record<string, number>>({});
  const nameColumnWidths = useRef<Record<string, number>>({});
  const exprColumnWidths = useRef<Record<string, number>>({});

  const measureColumnWidth = useCallback((attr: IAttribute) => {
    const nameCellWidth = measureText(attr.name) + kHeaderCellPadding;
    const xName = dataSet.attributes[0]?.name || "x";
    const expr = metadata.rawExpressions.get(attr.id) ||
                  prettifyExpression(metadata.expressions.get(attr.id) || "", xName);
    const exprCellWidth = (expr ? measureText(`= ${expr}`) : 0) + kExpressionCellPadding;
    if ((nameCellWidth !== nameColumnWidths.current[attr.id]) ||
        (exprCellWidth !== exprColumnWidths.current[attr.id])) {
      // autoWidth changes (e.g. name or formula changes), supersede user-set width
      delete userColumnWidths.current[attr.id];
      nameColumnWidths.current[attr.id] = nameCellWidth;
      exprColumnWidths.current[attr.id] = exprCellWidth;
    }
    return userColumnWidths.current[attr.id] || Math.max(nameCellWidth, exprCellWidth);
  }, [dataSet.attributes, measureText, metadata.expressions, metadata.rawExpressions]);

  return { userColumnWidths, nameColumnWidths, exprColumnWidths, measureColumnWidth };
};
