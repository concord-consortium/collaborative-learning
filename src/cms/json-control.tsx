import React from "react";

import "./json-control.scss";

// There is a CmsWidgetControlProps type which includes a few of the
// properties passed to the control component by DecapCMS.
// A more complete list can be found in Widget.js in the DecapCMS
// source code. However even that list is missing the `label` property.
// It isn't clear where this label property is coming from.
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
    const valueString = props.value?.toJS ? JSON.stringify(props.value.toJS(), null, 2) : "";
    this.state = {valueString};
  }

  handleChange(e: any) {
    this.setState({valueString: e.target.value});
    try {
      const json = JSON.parse(e.target.value);
      this.props.onChange(json);
    } catch (error) {
      // console.log(`illegal json`, e.target.value);
    }
  }

  render() {
    const { label } = this.props;

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

