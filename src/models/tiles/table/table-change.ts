import { ILinkProperties } from "../table-link-types";

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
  action: "create" | "update" | "delete" | "import-data";
  target: "table" | "rows" | "columns" | "geometryLink";
  ids?: string | string[];
  props?: ITableChangeProperties;
  links?: ILinkProperties;
}

// early create changes had props at the top-level rather than in "columns" or "rows"
export interface IEarlyCreateColumnsChange {
  action: "create";
  target: "columns";
  ids?: string | string[];
  props: IColumnCreationProperties | IColumnCreationProperties[];
}
export interface IEarlyCreateRowsChange {
  action: "create";
  target: "rows";
  ids?: string | string[];
  props: IRowProperties | IRowProperties[];
}
export type IEarlyTableCreateChange = IEarlyCreateColumnsChange | IEarlyCreateRowsChange;
export function isEarlyCreateColumnsChange(change: any): change is IEarlyCreateColumnsChange {
  return (change.action === "create") && (change.target === "columns") && change.props && !change.props.columns;
}
export function isEarlyCreateRowsChange(change: any): change is IEarlyCreateRowsChange {
  return (change.action === "create") && (change.target === "rows") && change.props && !change.props.rows;
}
