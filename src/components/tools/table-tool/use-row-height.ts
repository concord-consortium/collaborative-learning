import { useCallback } from "react";
import { kCellHorizontalPadding, kCellLineHeight, kCellVerticalPadding, kDefaultColumnWidth,
  kRowHeight } from "./table-types";
import { useCurrent } from "../../../hooks/use-current";
import { measureTextLines } from "../hooks/use-measure-text";
import { defaultFont, defaultBoldFont } from "../../constants";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { TableContentModelType } from "../../../models/tools/table/table-content";

interface IUseRowHeight {
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
  model: ToolTileModelType;
}
export const useRowHeight = ({ dataSet, measureColumnWidth, model }: IUseRowHeight) => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const content = getContent();

  const textHeight = (text: string, width?: number, font = defaultFont) => {
    if (text) {
      const containerWidth = (width || kDefaultColumnWidth) - kCellHorizontalPadding;
      const cellHeight = measureTextLines(text.toString(), containerWidth, font) * kCellLineHeight
        + 2 * kCellVerticalPadding;
      return cellHeight;
    }
    return kRowHeight;
  };

  // args.row: TRow
  const rowHeight = useCallback((args: any) => {
    let height = kRowHeight;
    if (args.row) {
      for (const [attrId, text] of Object.entries(args.row)) {
        if (attrId !== '__context__' && attrId !== '__id__' && attrId !== '__index__') {
          height = Math.max(height, textHeight(
            text as string,
            measureColumnWidth(dataSet.attrFromID(attrId)),
            defaultFont
          ));
        }
      }
    }
    return height;
  }, [measureColumnWidth, dataSet]);

  const headerHeight = useCallback(() => {
    let height = kRowHeight;
    dataSet.attributes.forEach(attribute => {
      height = Math.max(height, textHeight(
        attribute.name,
        measureColumnWidth(attribute),
        defaultBoldFont
      ));
    });
    return height;
  }, [measureColumnWidth, dataSet]);

  const headerRowHeight = useCallback(() => headerHeight() + (content.hasExpressions ? kRowHeight : 0),
    [headerHeight, content]);

  return { rowHeight, headerHeight, headerRowHeight };
};
