import { getRowLabelFromLinkProps, ILinkProperties, IRowLabel, ITableLinkProperties } from "../table-links";
export { getRowLabelFromLinkProps, ILinkProperties, IRowLabel, ITableLinkProperties };

export interface IColumnProperties {
  name?: string;
  expression?: string;
  rawExpression?: string;
}

export interface IColumnCreationProperties extends IColumnProperties {
  id?: string;
  name: string;
}

export interface ICreateColumnsProperties {
  columns?: IColumnCreationProperties[];
}

export type IUpdateColumnsProperties = IColumnProperties | IColumnProperties[];

export interface IUpdateTableProperties {
  name?: string;
}
export interface ICreateTableProperties extends IUpdateTableProperties, ICreateColumnsProperties {
}

export type IRowProperties = Record<string, string | number | null | undefined>;

export interface ICreateRowsProperties {
  rows: IRowProperties[];
  beforeId?: string | string[];
}

export type IUpdateRowsProperties = IRowProperties | IRowProperties[];

export type ITableChangeProperties = ICreateTableProperties | IUpdateTableProperties |
                                      ICreateColumnsProperties | IUpdateColumnsProperties |
                                      ICreateRowsProperties | IUpdateRowsProperties;

export interface ITableChange {
  action: "create" | "update" | "delete";
  target: "table" | "rows" | "columns" | "geometryLink";
  ids?: string | string[];
  props?: ITableChangeProperties;
  links?: ILinkProperties;
}
