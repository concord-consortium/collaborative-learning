import { IDataSet } from "../data/data-set";

export interface ITileLinkMetadata {
  id: string;
  title?: string;
  dataSet?: IDataSet;
  providerId?: string;
}

export interface ITypedTileLinkMetadata extends ITileLinkMetadata {
  type: string;
  titleBase?: string;
}

export interface ILinkableTiles {
  providers: ITypedTileLinkMetadata[];
  consumers: ITypedTileLinkMetadata[];
  variableProviders: ITypedTileLinkMetadata[];
}
export const kNoLinkableTiles: ILinkableTiles = { providers: [], consumers: [], variableProviders: [] };
