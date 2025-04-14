import React from "react";
import Select from "react-select";
import { withFormsy } from "formsy-react";

class SelectInput extends React.Component<any, any> {
  options: any;
  constructor (props: any) {
    super(props);
    this.changeValue = this.changeValue.bind(this);
    this.state = {
      loading: true
    };
    this.options = [];
  }

  componentDidMount () {
    this.props.loadOptions((options: any) => {
      this.setState({
        loading: false,
        options
      });
    });
  }

  changeValue (option: any) {
    this.props.setValue(option);
    this.props.onChange(option);
  }

  render () {
    const { loading, options } = this.state;
    const { placeholder, disabled } = this.props;
    let className = "select-input";
    if (this.props.value) {
      className += " valid";
    }

    return (
      <div className={className}>
        <Select
          value={this.props.value || ""}
          onChange={this.changeValue}
          placeholder={placeholder}
          options={options}
          isLoading={loading}
          isSearchable={true}
          isClearable={false}
          isDisabled={disabled}
        />
        { this.props.errorMessage ? <div className="input-error">{ this.props.errorMessage }</div> : undefined }
      </div>
    );
  }
}

export default withFormsy(SelectInput);
