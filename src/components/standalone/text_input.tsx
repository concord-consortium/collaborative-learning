import React, { useState, useCallback } from "react";
import { withFormsy } from "formsy-react";
import { debounce } from "throttle-debounce";

const TIMEOUT = 350;

class TextInput extends React.Component<any, any> {
  static defaultProps = {
    type: "text"
  };

  inputRef: any;
  timeoutID: any;
  constructor (props: any) {
    super(props);

    this.state = {
      inputVal: ""
    };

    this.onChange = this.onChange.bind(this);
    this.inputRef = React.createRef();
  }

  onChange (event: any) {
    const cursor = event.target.selectionStart;
    let newVal = event.currentTarget.value;
    const delay = this.props.isValidValue(newVal) ? 0 : TIMEOUT;

    this.setState({
      inputVal: newVal
    }, () => {
      // Reset the cursor in case the user was not appending text.
      // NOTE: while unintuitive the selectionEnd is set to the selectionStart to collapse the cursor.
      // This works for both unselected text and multiple character selections.
      // More info here: https://stackoverflow.com/a/54811848
      if (this.inputRef.current != null) {
        this.inputRef.current.selectionEnd = cursor;
      }
    });

    if (this.timeoutID) {
      window.clearTimeout(this.timeoutID);
    }
    this.timeoutID = window.setTimeout(() => {
      if (this.props.processValue) {
        newVal = this.props.processValue(newVal);
      }
      this.props.setValue(newVal);
      if (this.props.onChangeWithValidationResult) {
        this.props.onChangeWithValidationResult(newVal, this.props.isValidValue(newVal));
      }
    }, delay);
  }

  render () {
    const { type, placeholder, disabled, name } = this.props;

    let className = "text-input " + this.props.name;
    if (this.props.showRequired && !this.props.isPristine) {
      className += " required";
    }
    if (this.props.showError) {
      className += " error";
    }
    if (this.props.isValid && !this.props.isPristine) {
      className += " valid";
    }
    if (disabled) {
      className += " disabled";
    }

    return (
      <div className={className}>
        <input
          ref={this.inputRef}
          type={type}
          name={name}
          onChange={this.onChange}
          value={this.state.inputVal}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={this.props.autoFocus}
        />
        <div className="input-error">
          { this.state.inputVal.length === 0 ? undefined : this.props.errorMessage }
        </div>
      </div>
    );
  }
}

const FormsyTextInput = withFormsy(TextInput);

// A copy of method from https://github.com/formsy/formsy-react/blob/master/src/withFormsy.ts
const convertValidationsToObject = (validations: any) => {
  if (typeof validations === "string") {
    return validations.split(/,(?![^{[]*[}\]])/g).reduce((validationsAccumulator, validation) => {
      let args = validation.split(":");
      const validateMethod = args.shift() as string;

      args = args.map((arg) => {
        try {
          return JSON.parse(arg);
        } catch (e) {
          return arg; // It is a string if it can not parse it
        }
      });

      if (args.length > 1) {
        throw new Error(
          "Formsy does not support multiple args on string validations. Use object format of validations instead."
        );
      }

      // Avoid parameter reassignment
      const validationsAccumulatorCopy: any = { ...validationsAccumulator };
      validationsAccumulatorCopy[validateMethod] = args.length ? args[0] : true;
      return validationsAccumulatorCopy;
    }, {});
  }

  return validations || {};
};

const TextInputWithAsyncValidationSupport = (props: any) => {
  const { asyncValidation, asyncValidationError, validations, ...innerProps } = props;
  const [asyncValidationPassed, setAsyncValidationPassed] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAsyncValidation = useCallback(debounce(TIMEOUT, (newValue) => {
    asyncValidation(newValue).done(() => {
      setAsyncValidationPassed(true);
    }).fail(() => {
      setAsyncValidationPassed(false);
    });
  }), []);

  if (!asyncValidation) {
    return <FormsyTextInput {...innerProps} validations={validations} />;
  }

  // Async validation support will modify the validations object to include a customValidationAsyncResult function.
  const modifiedValidations = typeof validations === "string"
    ? convertValidationsToObject(validations)
    : (validations ?? {});
  if (!asyncValidationPassed) {
    // This will trigger formsy re-validation and set the error to asyncValidationError.
    modifiedValidations.customValidationAsyncResult = () => {
      return asyncValidationError || "Async validation failed";
    };
  }

  const handleChangeWithValidationResult = (newValue: any, isValid: any) => {
    // Delay first async validation until field meets basic validation rules.
    // If async validation fails, it will be re-run on every change, as long as that happens.
    if (isValid || !asyncValidationPassed) {
      debouncedAsyncValidation(newValue);
    }
  };

  return (
    <FormsyTextInput
      {...innerProps}
      validations={modifiedValidations}
      onChangeWithValidationResult={handleChangeWithValidationResult}
    />
  );
};

export default TextInputWithAsyncValidationSupport;
