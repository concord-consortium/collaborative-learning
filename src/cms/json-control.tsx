import React from "react";

import "./json-control.scss";

// There is a CmsWidgetControlProps type, but it doesn't seem to be
// exported by DecapCMS
interface IProps {
  field: any,
  onChange: (value: any) => void,
  forID: string,
  value: any,
  classNameWrapper: string,
  label?: string
}

interface IState {
  valueString: string
}

export class JsonControl extends React.Component<IProps, IState>  {
  static defaultProps = {
    value: '',
  };

  constructor(props: IProps) {
    super(props);
    console.log("init value:", props.value);
    const valueString = props.value?.toJS ? JSON.stringify(props.value.toJS()) : "";
    this.state = {valueString};
  }

  handleChange(e: any) {
    console.log("Handling change: ", e.target.value);
    this.setState({valueString: e.target.value});
    try {
      const json = JSON.parse(e.target.value);
      console.log(`parsed json`, json);
      this.props.onChange(json);
      console.log(`SUCCESS`, json);
    } catch (error) {
      console.log(`illegal json`, e.target.value);
      // this.props.onChange(this.state.valueString);
    }
  }

  render() {
    // `label` is not documented in the Decap docs and it is also not
    // listed in the CmsWidgetControlProps provided by Decap
    // but it does seem to provide the label of the field
    const {
      label,
    } = this.props;

    return (
      <div className="json-control">
        <label htmlFor="jsonControl">{label}</label>
        <textarea
          id="jsonControl"
          value={this.state.valueString}
          onChange={this.handleChange.bind(this)}
        />
      </div>
    );

  }
}

