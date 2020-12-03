import { useSettingFromStores } from "../../../hooks/use-stores";
import { format } from "d3-format";
import { useMemo } from "react";

export function useNumberFormat() {
  const kDefaultFormatStr = ".1~f"; // one decimal place, remove trailing zero
  const formatStr = useSettingFromStores("numFormat", "table") as string | undefined ||
                      kDefaultFormatStr;
  return useMemo(() => format(formatStr), [formatStr]);
}
