import { IDataSet } from "../../data/data-set";
import { TableMetadataModelType } from "./table-content";
import { StringBuilder } from "../../../utilities/string-builder";

export const exportTableContentAsJson = (
  metadata: TableMetadataModelType, dataSet: IDataSet, columnWidth: (attrId: string) => number
) => {
  // TODO - since we have disabled former table export, we must replace with SharedModel-inclusive implementation
  // const columns = dataSet.attributes.map((attr, attrIndex, attrs) => {
  //   const id = attr.id;
  //   const expression = metadata.expressions.get(id);
  //   const rawExpression = metadata.rawExpressions.get(id);
  //   const hasExpression = !!expression || !!rawExpression;
  //   const values: (string | number)[] = [];
  //   if (!hasExpression) {
  //     for (let i = 0; i < dataSet.cases.length; ++i) {
  //       const value = dataSet.getValueAtIndex(i, attr.id);
  //       values.push(value != null ? value : "");
  //     }
  //   }
  //   return `${JSON.stringify({
  //     name: attr.name,
  //     width: columnWidth(id),
  //     expression,
  //     rawExpression,
  //     values: values.length ? values : undefined
  //   })}${comma(attrIndex < attrs.length - 1)}`;
  // });

  const builder = new StringBuilder();
  builder.pushLine("{");
  const typeComma = dataSet.name ? "," : "";
  builder.pushLine(`"type": "Table"${typeComma}`, 2);
  dataSet.name && builder.pushLine(`"name": "${dataSet.name}"`, 2);
  builder.pushLine("}");
  return builder.build();
};
