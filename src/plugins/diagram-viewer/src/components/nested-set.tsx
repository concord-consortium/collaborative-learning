import { observer } from "mobx-react-lite";
import React from "react";
import { getUnitConversion } from "../models/unit-conversion";

interface INodeProps {
  // this caused an error for some reason
  // node?: Instance<typeof DQNode>;
  node?: any;
  final?: boolean;
  symbolic?: boolean;
}

const url = new URL(window.location.href);
const showConversionFactor = !(url.searchParams.get("conversionFactor") == null);

const _NestedSetNode: React.FC<INodeProps> = ({ node, final, symbolic }) => {
  if (!node) {
    return <>?</>;
  }

  // FIXME: this should be typed
  const nodeString = () => {
      if (symbolic) {
        return node.name || "";
      } else {
        const unit = node.computedUnit;
        const suffix = unit ? ` ${unit}` : "";
        return `${node.computedValueWithSignificantDigits}${suffix}`;
      }
  };

  const conversionString = () => {
      if (symbolic) {
          return "conversionFactor";
      } else {
          const input = node.firstValidInput;
          const convertValue = getUnitConversion((input).computedUnit, node.computedUnit);
          if (convertValue) {
            const factor = convertValue(1);
            const factorString = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 }).format(factor);
            return `${factorString} ${node.computedUnit} / ${input.computedUnit}`;
          } else {
            return "⚠️";
          }
      }
  };

  const renderContent = () => {
      if (node.operation ) {
        return (
        <>
          <NestedSetNode node={node.inputA} symbolic={symbolic}/>
          {node.operation}
          <NestedSetNode node={node.inputB} symbolic={symbolic}/>
        </>);
      } else if (node.numberOfInputs === 1) {
        // This is a tricky case if there is no unit conversion then it is basically a no-op but
        // it is still useful to draw a box around the single input. That is because this box
        // represents a node
        // If there is a unit conversion then what do we draw. What it really is is a multiplication
        // by a factor, in symbolic representation we could say " * conversionFactor "
        const input = node.firstValidInput;
        return (
        <>
          <NestedSetNode node={input} symbolic={symbolic}/>
          {node.computedUnit !== input.computedUnit && showConversionFactor && ` * ${conversionString()} `}
        </>);
      } else {
        return nodeString();
      }
  };

  return (
    <div className="nested-set-node">
      {renderContent()}
      {/* probably want at least 2 modes variables and quantities */}
      {final && ` =  ${nodeString()}` }
    </div>
  );
};

const NestedSetNode = observer(_NestedSetNode);
NestedSetNode.displayName = "NestedSetNode";

interface IProps {
    // this caused an error for some reason
    // node?: Instance<typeof DQNode>;
    node?: any;
    final?: boolean;
    symbolic?: boolean;
}

const _NestedSet: React.FC<IProps> = ({ node, final, symbolic }) => {
    return (
    <>
      <div style={{paddingBottom: "5px"}}>
        <NestedSetNode node={node} final={final} symbolic={true}/>
      </div>
      <div>
        <NestedSetNode node={node} final={final} symbolic={false}/>
      </div>
    </>);
};
export const NestedSet = observer(_NestedSet);
NestedSet.displayName = "NestedSet";
