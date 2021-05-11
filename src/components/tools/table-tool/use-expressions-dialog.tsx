import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useCurrent } from "../../../hooks/use-current";
import { kLeaveModalOpen, useCustomModal } from "../../../hooks/use-custom-modal";
import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { validateDisplayExpression } from "./expression-utils";
import { useEditableExpressions } from "./use-editable-expressions";

import "./expressions-dialog.scss";

interface IProps {
  metadata: TableMetadataModelType;
  dataSet: IDataSet;
  onSubmit: (changedExpressions: Map<string, string>) => void;
}
type IResult = [() => void, () => void, React.Dispatch<React.SetStateAction<string | undefined>>];
export const useExpressionsDialog = ({ metadata, dataSet, onSubmit }: IProps): IResult => {
  const metadataRef = useCurrent(metadata);
  const xName = useCurrent(dataSet.attributes.length > 0
                            ? dataSet.attributes[0].name
                            : "x");
  const [currYAttrId, setCurrYAttrId] = useState<string>();
  // map of attribute ids to current editable expressions
  const expressions = useEditableExpressions(metadata, xName.current);
  // the currently edited expression (controlled input)
  const [currentExpression, setCurrentExpression] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const updateCurrentExpression = useCallback((expr: string) => {
    setCurrentExpression(expr);
    setErrorMessage(validateDisplayExpression(expr, xName.current) || "");
  }, [xName]);
  const acceptExpression = useCallback((yAttrId: string, expr: string) => {
    expressions.current.set(yAttrId, expr);
  }, [expressions]);
  const contentProps: IContentProps = {
          dataSet, xName: xName.current, currYAttrId, setCurrYAttrId,
          expressions, currentExpression, errorMessage, updateCurrentExpression, acceptExpression
        };

  const blurModalRef = useRef<() => void>();

  const handleClear = useCallback(() => {
    blurModalRef.current?.();
    updateCurrentExpression("");
    currYAttrId && acceptExpression(currYAttrId, "");
    return kLeaveModalOpen;
  }, [acceptExpression, currYAttrId, updateCurrentExpression]);

  const handleSubmit = useCallback(() => {
    blurModalRef.current?.();
    const rawExpressions = metadataRef.current.rawExpressions;
    const changedExpressions: Map<string, string> = new Map();
    expressions.current.forEach((expr, id) => {
      if ((expr != null) && (expr !== rawExpressions.get(id))) {
        changedExpressions.set(id, expr);
      }
    });
    onSubmit(changedExpressions);
  }, [expressions, metadataRef, onSubmit]);

  const [showModal, hideModal, blurModal] = useCustomModal({
    className: "set-expression",
    title: "Set Expression",
    Icon: SetExpressionIconSvg,
    Content,
    contentProps,
    focusElement: "#expression-input",
    buttons: [
      { label: "Clear", onClick: handleClear },
      { label: "Cancel" },
      { label: "OK", isDefault: true, onClick: handleSubmit }
    ]
  }, [currYAttrId, errorMessage, currentExpression]);
  blurModalRef.current = blurModal;
  return [showModal, hideModal, setCurrYAttrId];
};

interface IContentProps {
  dataSet: IDataSet;
  xName: string;
  currYAttrId: string | undefined;
  setCurrYAttrId: React.Dispatch<React.SetStateAction<string | undefined>>;
  // map of attribute ids to editable expressions
  expressions: React.MutableRefObject<Map<string, string>>;
  // the currently edited expression (controlled input)
  currentExpression: string;
  errorMessage: string;
  updateCurrentExpression: (expr: string, isInitializing?: boolean) => void;
  acceptExpression: (yAttrId: string, expr: string) => void;
}
const Content: React.FC<IContentProps> = ({
  dataSet, xName, currYAttrId, setCurrYAttrId, expressions,
  currentExpression, errorMessage, updateCurrentExpression, acceptExpression
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
    currYAttr && updateCurrentExpression(expressions.current.get(currYAttr.id) || "");
  }, [currYAttr]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCurrentExpression(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    currYAttr && acceptExpression(currYAttr.id, e.target.value);
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
                value={currentExpression} onChange={handleInputChange} onBlur={handleBlur}/>
      </div>
      <div className="error">
        {errorMessage}
      </div>
    </>
  );
};
