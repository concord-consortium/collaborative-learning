import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";

export const useJsonExport = (
  getMetadata: () => TableMetadataModelType, dataSetRef: React.MutableRefObject<IDataSet>
) => {
  return () => {
    const metadata = getMetadata();
    const dataSet = dataSetRef.current;
    const columns = dataSet.attributes.map((attr, attrIndex, attrs) => {
      const id = attr.id;
      const expression = metadata.expressions.get(id);
      const rawExpression = metadata.rawExpressions.get(id);
      const hasExpression = !!expression || !!rawExpression;
      const values: (string | number)[] = [];
      if (!hasExpression) {
        for (let i = 0; i < dataSet.cases.length; ++i) {
          const value = dataSet.getValueAtIndex(i, attr.id);
          values.push(value != null ? value : "");
        }
      }
      return `    ${JSON.stringify({
        name: attr.name,
        expression,
        rawExpression,
        values: values.length ? values : undefined
      })}${attrIndex < attrs.length - 1 ? "," : ""}`;
    });
    return [
      `{`,
      `  "type": "Table",`,
      `  "name": "${dataSet.name}",`,
      `  "columns": [`,
      ...columns,
      `  ]`,
      `}`
    ].join("\n");
  };
};
