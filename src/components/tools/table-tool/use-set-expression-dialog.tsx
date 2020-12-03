import React, { useCallback, useRef, useState } from "react";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useCurrent } from "../../../hooks/use-current";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IDataSet } from "../../../models/data/data-set";
import { validateExpression } from "./expression-utils";
import { useEditableExpressions } from "./use-editable-expressions";

import "./set-expression-dialog.scss";

interface IProps {
  dataSet: IDataSet;
  rawExpressions: Map<string, string>;        // user-entered
  canonicalExpressions: Map<string, string>;  // canonicalized
  onSubmit: (changedExpressions: Map<string, string>) => void;
}
export const useSetExpressionDialog = ({ dataSet, rawExpressions, canonicalExpressions, onSubmit }: IProps) => {
  const xName = useCurrent(dataSet.attributes.length > 0
                            ? dataSet.attributes[0].name
                            : "x");
  const firstYAttr = useCurrent(dataSet.attributes.length > 1 ? dataSet.attributes[1] : undefined);
  const [currYAttrId, setCurrYAttrId] = useState<string>();
  const [expressions, setExpressions] = useEditableExpressions(rawExpressions, canonicalExpressions, xName.current);
  const selectElt = useRef<HTMLSelectElement>(null);
  const inputElt = useRef<HTMLInputElement>(null);
  const Content: React.FC = useCallback(() => {
    const currYAttr = currYAttrId ? dataSet.attrFromID(currYAttrId) : firstYAttr.current;
    const yAttrs = dataSet.attributes.length <= 2
                    ? <span className="attr-name y">{currYAttr?.name}</span>
                    : <select ref={selectElt} value={currYAttr?.id}
                              onChange={e => {
                                setCurrYAttrId(e.target.value);
                                setTimeout(() => selectElt.current?.focus());
                              }}>
                        {dataSet.attributes
                          .filter((attr, i) => (i >= 1))
                          .map(attr => <option key={attr.id} value={attr.id}>{attr.name}</option>)}
                      </select>;
    const placeholder = `e.g. 3*${xName.current}+2`;
    const expression = currYAttr && expressions.get(currYAttr.id) || "";
    const errorMessage = validateExpression(expression, xName.current);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const expr = e.target.value;
      currYAttr && setExpressions(state => new Map(state.set(currYAttr.id, expr)));
    };

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
          <input ref={inputElt} type="text" id="expression-input" placeholder={placeholder}
                  defaultValue={expression} onBlur={handleBlur}/>
        </div>
        <div className="error">
          {errorMessage}
        </div>
      </>
    );
  }, [currYAttrId, dataSet, expressions, firstYAttr, setExpressions, xName]);

  const handleSubmit = () => {
    const changedExpressions: Map<string, string> = new Map();
    expressions.forEach((expr, id) => {
      if (expr !== (rawExpressions.get(id) || "")) {
        changedExpressions.set(id, expr);
      }
    });
    onSubmit(changedExpressions);
    hideModal();
  };

  const [showModal, hideModal] = useCustomModal({
    className: "set-expression",
    title: "Set Expression",
    Icon: SetExpressionIconSvg,
    Content,
    focusElement: "#expression-input",
    buttons: [
      { label: "Clear", onClick: () => (inputElt.current && (inputElt.current.value = "")) },
      { label: "Cancel", onClick: "close" },
      { label: "OK", isDefault: true, onClick: handleSubmit }
    ]
  }, [Content]);
  return [showModal, hideModal];
};
