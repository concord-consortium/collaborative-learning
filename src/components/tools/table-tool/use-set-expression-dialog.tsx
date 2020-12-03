import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
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
  const [currYAttrId, setCurrYAttrId] = useState<string>();
  // map of attribute ids to current editable expressions
  const expressions = useEditableExpressions(rawExpressions, canonicalExpressions, xName.current);
  // the currently edited expression (controlled input)
  const [expression, setExpression] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const updateExpression = useCallback((expr: string) => {
    setExpression(expr);
    setErrorMessage(validateExpression(expr, xName.current) || "");
  }, [xName]);
  const contentProps: IContentProps = {
          dataSet, xName: xName.current, currYAttrId, setCurrYAttrId,
          expressions, expression, errorMessage, updateExpression
        };

  const handleClear = () => {
    blurModal();
    updateExpression("");
  };

  const handleSubmit = () => {
    blurModal();
    const changedExpressions: Map<string, string> = new Map();
    expressions.current.forEach((expr, id) => {
      if (expr !== (rawExpressions.get(id) || "")) {
        changedExpressions.set(id, expr);
      }
    });
    onSubmit(changedExpressions);
    hideModal();
  };

  const [showModal, hideModal, blurModal] = useCustomModal({
    className: "set-expression",
    title: "Set Expression",
    Icon: SetExpressionIconSvg,
    Content,
    contentProps,
    focusElement: "#expression-input",
    buttons: [
      { label: "Clear", onClick: handleClear },
      { label: "Cancel", onClick: "close" },
      { label: "OK", isDefault: true, onClick: handleSubmit }
    ]
  }, [currYAttrId, errorMessage, expression]);
  return [showModal, hideModal];
};

interface IContentProps {
  dataSet: IDataSet;
  xName: string;
  currYAttrId: string | undefined;
  setCurrYAttrId: React.Dispatch<React.SetStateAction<string | undefined>>;
  // map of attribute ids to editable expressions
  expressions: React.MutableRefObject<Map<string, string>>;
  // the currently edited expression (controlled input)
  expression: string;
  errorMessage: string;
  updateExpression: (expr: string, isInitializing?: boolean) => void;
}
const Content: React.FC<IContentProps> = ({
  dataSet, xName, currYAttrId, setCurrYAttrId, expressions, expression, errorMessage, updateExpression
}) => {
  const firstYAttr = useCurrent(dataSet.attributes.length > 1 ? dataSet.attributes[1] : undefined);
  const currYAttr = currYAttrId ? dataSet.attrFromID(currYAttrId) : firstYAttr.current;
  const selectElt = useRef<HTMLSelectElement>(null);
  const inputElt = useRef<HTMLInputElement>(null);
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
  const placeholder = `e.g. 3*${xName}+2`;
  useLayoutEffect(() => {
    currYAttr && updateExpression(expressions.current.get(currYAttr.id) || "");
  }, [currYAttr]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateExpression(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    currYAttr && expressions.current.set(currYAttr.id, e.target.value);
  };

  return (
    <>
      <div className="prompt">
        <span>Enter an expression for</span>
        {yAttrs}
        <span>in terms of</span>
        <span className="attr-name x">{xName}</span>
        <span>:</span>
      </div>
      <div className="expression">
        <label htmlFor="expression-input">
          <span className="attr-name y">{currYAttr?.name}</span>
          <span className="equals">=</span>
        </label>
        <input ref={inputElt} type="text" id="expression-input" placeholder={placeholder} autoComplete="off"
                value={expression} onChange={handleInputChange} onBlur={handleBlur}/>
      </div>
      <div className="error">
        {errorMessage}
      </div>
    </>
  );
};
