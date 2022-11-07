import { reaction } from "mobx";
import { useEffect, useRef } from "react";

export function useMobXOnChange<T>(getValue: () => T, onChange: (value: T) => void) {
  const valueRef = useRef(getValue());
  useEffect(() => {
    const dispose = reaction(
                      getValue,
                      value => {
                        if (value !== valueRef.current) {
                          valueRef.current = value;
                          onChange(value);
                        }
                      });
    return () => dispose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
