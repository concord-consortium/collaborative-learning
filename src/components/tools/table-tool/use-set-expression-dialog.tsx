import React, { useCallback, useRef, useState } from "react";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useCurrent } from "../../../hooks/use-current";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IDataSet } from "../../../models/data/data-set";

import "./set-expression-dialog.scss";

interface IProps {
  dataSet: IDataSet;
}
export const useSetExpressionDialog = ({ dataSet }: IProps) => {
  const xName = useCurrent(dataSet.attributes.length > 0
                            ? dataSet.attributes[0].name
                            : "x");
  const [currYAttr, setCurrYAttr] = useState(dataSet.attributes.length > 1 ? dataSet.attributes[1] : undefined);
  const selectEl = useRef<HTMLSelectElement>(null);
  const Content: React.FC = useCallback(() => {
    const yAttrs = dataSet.attributes.length <= 2
                    ? <span className="attr-name y">{currYAttr?.name}</span>
                    : <select ref={selectEl} value={currYAttr?.id}
                              onChange={e => {
                                setCurrYAttr(dataSet.attrFromID(e.target.value));
                                setTimeout(() => selectEl.current?.focus());
                              }}>
                        {dataSet.attributes
                          .filter((attr, i) => (i >= 1))
                          .map(attr => <option key={attr.id} value={attr.id}>{attr.name}</option>)}
                      </select>;
    const placeholder = `e.g. 3*${xName.current}+2`;
    return (
      <>
        <div className="prompt">
          <span>Enter an expression for</span>
          {yAttrs}
          <span>in terms of</span>
          <span className="attr-name x">{xName.current}</span>
          <span>:</span>
        </div>
        <div className="expression">
          <label htmlFor="expression-input">
            <span className="attr-name y">{currYAttr?.name}</span>
            <span className="equals">=</span>
          </label>
          <input type="text" id="expression-input" placeholder={placeholder}/>
        </div>
      </>
    );
  }, [currYAttr, dataSet, xName]);

  const [showModal, hideModal] = useCustomModal({
    className: "set-expression",
    title: "Set Expression",
    Icon: SetExpressionIconSvg,
    Content,
    focusElement: "#expression-input",
    buttons: [
      { label: "Clear", onClick: () => { /* no-op */} },
      { label: "Cancel", onClick: "close" },
      { label: "OK", isDefault: true, onClick: () => { /* no-op */} }
    ]
  }, [currYAttr]);
  return [showModal, hideModal];
};
