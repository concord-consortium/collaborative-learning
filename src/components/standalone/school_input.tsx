import React from "react";
import Select from "react-select";
import { withFormsy } from "formsy-react";

const TIMEOUT = 500;

const getSchools = (country: any, zipcode: any) => {
  alert("TODO: getSchools");
  return Promise.reject(new Error("getSchools not implemented"));
};
/*
  jQuery.get(
    Portal.API_V1.SCHOOLS + "?country_id=" + country + "&zipcode=" + zipcode
  );
*/

class SchoolInput extends React.Component<any, any> {
  timeoutID: any;
  constructor (props: any) {
    super(props);
    this.state = {
      isLoading: false,
      options: []
    };
    this.changeValue = this.changeValue.bind(this);
    this.setOptions = this.setOptions.bind(this);
    this.newSchoolLink = this.newSchoolLink.bind(this);
  }

  componentDidMount () {
    this.updateOptions();
  }

  componentDidUpdate (prevProps: any) {
    const { country, zipcode } = this.props;
    if (prevProps.country !== country || prevProps.zipcode !== zipcode) {
      this.props.setValue("");
      this.updateOptions();
    }
  }

  newSchoolLink () {
    return <div className="new-school-link" onClick={this.props.onAddNewSchool}>Add a new school</div>;
  }

  changeValue (option: any) {
    this.props.setValue(option);
  }

  setOptions (country: any, zipcode: any) {
    // TODO: replace with actual API call
    this.setState({
      options: [
        {label: "School 1", value: "1"},
        {label: "School 2", value: "2"},
        {label: "School 3", value: "3"},
        {label: this.newSchoolLink(), disabled: true}
      ],
      isLoading: false
    });
    /*
    getSchools(country, zipcode).done((data) => {
      const options = data.map((school: any) => ({
        label: school.name,
        value: school.id
      }));
      options.push({
        label: this.newSchoolLink(),
        disabled: true
      });
      this.setState({
        options,
        isLoading: false
      });
    });
    */
  }

  updateOptions () {
    const { country, zipcode } = this.props;
    if ((country == null) || (zipcode == null)) {
      return;
    }
    if (this.timeoutID) {
      window.clearTimeout(this.timeoutID);
    }
    this.setState({
      isLoading: true
    });
    this.timeoutID = window.setTimeout(() => this.setOptions(country, zipcode), TIMEOUT);
  }

  render () {
    let className = "select-input";
    const { placeholder, disabled } = this.props;
    const { options, isLoading } = this.state;

    if (this.props.value) {
      className += " valid";
    }

    const noResultsText: any = <div><div>No schools found</div>{ this.newSchoolLink() }</div>;

    return (
      <div className={className}>
        <Select
          placeholder={placeholder}
          options={options}
          isLoading={isLoading}
          isDisabled={disabled}
          value={this.props.value || ""}
          onChange={this.changeValue}
          noOptionsMessage={noResultsText}
        >
          { /* <div className='input-error'>
            {this.props.errorMessage}
          </div> */ }
        </Select>
      </div>
    );
  }
}

export default withFormsy(SchoolInput);
