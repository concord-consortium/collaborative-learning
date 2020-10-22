import { reaction } from "mobx";
import { useEffect, useRef } from "react";

export function useMobXOnChange<T>(getValue: () => T, onChange: (value: T) => void) {
  const valueRef = useRef(getValue());
  useEffect(() => {
    reaction(
      getValue,
      value => {
        if (value !== valueRef.current) {
          valueRef.current = value;
          onChange(value);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
