import { useState } from "react";

export const useForceUpdate = () => {
  const [ , setChangeCount] = useState(0);
  return () => setChangeCount(count => count + 1);
};
