import { useCallback } from "react";
import { RowHeightArgs } from "react-data-grid";
import { kCellHorizontalPadding, kCellLineHeight, kCellVerticalPadding,
  kDefaultImageCellHeight,
  kHeaderCellHorizontalPadding, kHeaderRowHeight, kRowHeight, TRow } from "./table-types";
import { useCurrent } from "../../../hooks/use-current";
import { measureTextLines } from "../hooks/use-measure-text";
import { defaultFont } from "../../constants";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { ITileModel } from "../../../models/tiles/tile-model";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { gImageMap } from "../../../models/image-map";

interface IUseRowHeight {
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
  model: ITileModel;
}
export const useRowHeight = ({ dataSet, measureColumnWidth, model }: IUseRowHeight) => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const content = getContent();

  const textHeight = (text: string, width: number, font = defaultFont) => {
    if (text) {
      const cellHeight = measureTextLines(text.toString(), width, font) * kCellLineHeight
        + 2 * kCellVerticalPadding;
      return cellHeight;
    }
    return kRowHeight;
  };

  const rowHeight = useCallback((args: RowHeightArgs<TRow>) => {
    let height = kRowHeight;
    if (args.row) {
      for (const [attrId, text] of Object.entries(args.row)) {
        if (attrId !== '__context__' && attrId !== '__id__' && attrId !== '__index__') {
          const testableString = text.length > 0 ? text : ' ';
          if (gImageMap.isImageUrl(testableString)){
            height = Math.max(height, kDefaultImageCellHeight);
          } else {
            height = Math.max(height, textHeight(
              text as string,
              measureColumnWidth(dataSet.attrFromID(attrId)) - kCellHorizontalPadding,
              defaultFont
            ));
          }
        }
      }
    }
    return height;
  }, [measureColumnWidth, dataSet]);

  const headerHeight = useCallback(() => {
    let height = kHeaderRowHeight;
    const font = `700 ${defaultFont}`;
    dataSet.attributes.forEach(attribute => {
      height = Math.max(height, textHeight(
        attribute.name,
        measureColumnWidth(attribute) - kHeaderCellHorizontalPadding,
        font
      ));
    });
    return height;
  }, [measureColumnWidth, dataSet]);

  const headerRowHeight = useCallback(() => headerHeight() + (content.hasExpressions ? kHeaderRowHeight : 0),
    [headerHeight, content]);

  return { rowHeight, headerHeight, headerRowHeight };
};
