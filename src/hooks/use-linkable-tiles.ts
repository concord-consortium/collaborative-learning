import { ITypedTileLinkMetadata, kNoLinkableTiles } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { getDocumentContentFromNode } from "../utilities/mst-utils";

interface IUseLinkableTilesProps {
  model: ITileModel;
}
export const useLinkableTiles = ({ model }: IUseLinkableTilesProps) => {
  // See document-scope.md for notes about how linkable tiles
  // are accessed here.
  const documentContent = getDocumentContentFromNode(model);
  const { providers, consumers } = documentContent?.getLinkableTiles() || kNoLinkableTiles;

  // add default title if there isn't a title
  const countsOfType = {} as Record<string, number>;
  function addDefaultTitle({ id, type, title, titleBase }: ITypedTileLinkMetadata) {
    if (!countsOfType[type]) {
      countsOfType[type] = 1;
    } else {
      countsOfType[type]++;
    }
    return { id, type, title: title || `${titleBase || type} ${countsOfType[type]}` };
  }

  return {
    providers: providers.map(addDefaultTitle),
    consumers: consumers.map(addDefaultTitle)
  };
};
