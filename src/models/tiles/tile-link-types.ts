export interface ITileLinkMetadata {
  id: string;
  title?: string;
}

export interface ITypedTileLinkMetadata extends ITileLinkMetadata {
  type: string;
  titleBase?: string;
}

export interface ILinkableTiles {
  providers: ITypedTileLinkMetadata[];
  consumers: ITypedTileLinkMetadata[];
}
export const kNoLinkableTiles: ILinkableTiles = { providers: [], consumers: [] };
