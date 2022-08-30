import { useCallback } from "react";
import { kCellHorizontalPadding, kCellLineHeight, kCellVerticalPadding, kDefaultColumnWidth,
  kRowHeight } from "./table-types";
import { measureTextLines } from "../hooks/use-measure-text";
import { IAttribute } from "src/models/data/attribute";
import { IDataSet } from "src/models/data/data-set";

interface IUseRowHeight {
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
}
export const useRowHeight = ({ dataSet, measureColumnWidth }: IUseRowHeight) => {
  const rowHeight = useCallback((args: any) => {
    const textHeight = (text: string, width?: number) => {
      if (text) {
        const containerWidth = (width || kDefaultColumnWidth) - kCellHorizontalPadding;
        const cellHeight = measureTextLines(text, containerWidth) * kCellLineHeight + 2 * kCellVerticalPadding;
        return cellHeight;
      }
      return kRowHeight;
    };
    let height = kRowHeight;
    if (args.row) {
      for (const [attrId, text] of Object.entries(args.row)) {
        if (attrId !== '__context__' && attrId !== '__id__' && attrId !== '__index__') {
          height = Math.max(height, textHeight(
            (text as string).trim().replace(/\s\s+/g, ' '), // Replace all whitespace with single spaces
            measureColumnWidth(dataSet.attrFromID(attrId))
          ));
        }
      }
    }
    return height;
  }, [measureColumnWidth, dataSet]);

  return { rowHeight };
};
