import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";
import { Parser } from "expr-eval";

import "./update-expression-dialog.sass";

interface IProps {
  id: string;
  isOpen: boolean;
  onUpdateExpression: (id: string, expression: string) => void;
  onClose: () => void;
  expression: string;
  xName?: string;
  yName?: string;
}

interface IState {
  expression: string;
}

export const kSerializedXKey = "__x__";

export default class UpdateExpressionDialog extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      expression: this.prettifyExpression(this.props.expression) || ""
    };
  }

  public render() {
    const { xName, yName } = this.props;
    const prompt = `Enter an expression for "${yName}" in terms of "${xName}"`;
    const errorMessage = this.getValidationError();
    return (
      <Dialog
        icon="text-highlight"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`Update Expression`}
        canOutsideClickClose={false}
        className="update-expression-dialog"
      >
        <div className="nc-attribute-name-prompt">{prompt}:</div>
        <div className="nc-labeled-input">
          <div className="nc-input-label">{`${yName} =`}</div>
          <input
            className="nc-attribute-name-input pt-input"
            type="text"
            maxLength={20}
            placeholder={`Column Expression`}
            value={this.state.expression}
            onChange={this.handleExpressionChange}
            onKeyDown={this.handleKeyDown}
            dir="auto"
            ref={input => input && input.focus()}
          />
        </div>
        <div className="nc-dialog-error">
          {errorMessage}
        </div>
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleSubmitExpression}
            disabled={errorMessage != null}
          />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.props.onClose}/>
        </div>
      </Dialog>
    );
  }

  private getValidationError = () => {
    const { xName } = this.props;
    const expressionStr = this.state.expression;
    if (!expressionStr) return;
    const parser = new Parser();
    try {
      const expression = parser.parse(expressionStr);
      const unknownVar = expression.variables().find(variable => variable !== xName);
      if (unknownVar) {
        return `Unrecognized variable "${unknownVar}" in expression.`;
      }
      if (xName) {
        // Attempt an evaluation to check for errors e.g. invalid function names
        expression.evaluate({[xName]: 1});
      }
    } catch {
      return "Could not understand expression. Make sure you supply all operands " +
      "and use a multiplication sign where necessary, e.g. 3 * x + 4 instead of 3x + 4.";
    }
  }

  private handleExpressionChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ expression: (evt.target as HTMLInputElement).value });
  }

  private handleSubmitExpression = () => {
    if (this.props.onUpdateExpression && !this.getValidationError()) {
      // Store a canonical version of the expression so it does not need to change on column renames
      const canonicalExpression = this.canonicalizeExpression(this.state.expression);
      this.props.onUpdateExpression(this.props.id, canonicalExpression);
    }
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.keyCode === 13) {
      this.handleSubmitExpression();
    }
  }

  private canonicalizeExpression = (displayExpression: string) => {
    const { xName } = this.props;
    if (xName && displayExpression) {
      const parser = new Parser();
      const subbedExpression = parser.parse(displayExpression).substitute(xName, kSerializedXKey);
      return subbedExpression.toString();
    } else {
      return displayExpression;
    }
  }

  private prettifyExpression = (canonicalExpression: string) => {
    const { xName } = this.props;
    if (xName && canonicalExpression) {
      const parser = new Parser();
      let expression = parser.parse(canonicalExpression).substitute(kSerializedXKey, xName).toString();
      if (expression.charAt(0) === "(" && expression.charAt(expression.length - 1) === ")") {
        expression = expression.substring(1, expression.length - 1);
      }
      return expression;
    } else {
      return canonicalExpression;
    }
  }

}
