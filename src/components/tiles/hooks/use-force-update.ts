import { useCallback, useState } from "react";

export const useForceUpdate = () => {
  const [ , setChangeCount] = useState(0);
  return useCallback(() => setChangeCount(count => count + 1), []);
};
