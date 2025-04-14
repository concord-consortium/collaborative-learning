import React from "react";
import { withFormsy } from "formsy-react";

class RadioInput extends React.Component<any, any> {
  constructor (props: any) {
    super(props);
    this.changeValue = this.changeValue.bind(this);
  }

  renderOptions (options: any) {
    return options.map((option: any, index: any) => (
      <label key={index}>
        <input
          type="radio"
          onChange={this.changeValue}
          value={option.value}
          name={this.props.name}
          checked={this.props.value === option.value}
        />
        {option.label}
      </label>
    ));
  }

  changeValue (e: any) {
    if (this.props.handleChange) {
      this.props.handleChange(e);
    }
    this.props.setValue(e.currentTarget.value);
  }

  render () {
    return (
      <div className="radio-input stacked">
        <div className="title inline">
          { this.props.title }
        </div>
        { this.renderOptions(this.props.options) }
      </div>
    );
  }
}

export default withFormsy(RadioInput);
