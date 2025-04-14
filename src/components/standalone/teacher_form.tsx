import React from "react";
import Formsy from "formsy-react";

import TextInput from "./text_input";
import CheckboxInput from "./checkbox_input";
import SelectInput from "./select_input";
import SchoolInput from "./school_input";
import PrivacyPolicy from "./privacy_policy";

const LOGIN_TOO_SHORT = "Login is too short";
// eslint-disable-next-line max-len
const LOGIN_INVALID = "Invalid login. This name is either already taken or does not use only letters, numbers and the characters .+-_@";
const EMAIL_REGEXP = "Email doesn't appear to be a valid email";
const EMAIL_TAKEN = "Email belongs to an existing user";
const CANT_FIND_SCHOOL = "I can't find my school in the list.";
const GO_BACK_TO_LIST = "Go back to the school list.";

const newSchoolWarning = (zipOrPostal: any) =>
  `You are adding a new school / institution. Please make sure that the ${zipOrPostal} ` +
  `and school / institution name are correct!`;
const invalidZipcode = (zipOrPostal: any) => `Incorrect ${zipOrPostal}`;

const loginValidValidator = (value: any) => Promise.reject(new Error("TODO: loginValidValidator"));
  // jQuery.get(Portal.API_V1.LOGIN_VALID + "?username=" + value);
const emailAvailableValidator = (value: any) => Promise.reject(new Error("TODO: emailAvailableValidator"));
  // jQuery.get(Portal.API_V1.EMAILS + "?email=" + value);
const getCountries = () => Promise.reject(new Error("TODO: getCountries"));
  // jQuery.get(Portal.API_V1.COUNTRIES);
const registerTeacher = (params: any) => Promise.reject(new Error("TODO: registerTeacher"));
  // jQuery.post(Portal.API_V1.TEACHERS, params);
const isUS = (name: any) => name === "United States" || name === "US" || name === "USA";

export default class TeacherForm extends React.Component<any, any> {
  constructor (props: any) {
    super(props);
    this.state = {
      canSubmit: false,
      currentCountry: null,
      currentZipcode: null,
      isUSSelected: false,
      registerNewSchool: false,
    };

    this.onBasicFormValid = this.onBasicFormValid.bind(this);
    this.onBasicFormInvalid = this.onBasicFormInvalid.bind(this);
    this.submit = this.submit.bind(this);
    this.onChange = this.onChange.bind(this);
    this.getCountries = this.getCountries.bind(this);
    this.addNewSchool = this.addNewSchool.bind(this);
    this.goBackToSchoolList = this.goBackToSchoolList.bind(this);
    this.checkIfUS = this.checkIfUS.bind(this);
    this.zipcodeValidation = this.zipcodeValidation.bind(this);
    this.zipOrPostal = this.zipOrPostal.bind(this);
  }

  onBasicFormValid () {
    this.setState({
      canSubmit: true
    });
  }

  onBasicFormInvalid () {
    this.setState({
      canSubmit: false
    });
  }

  submit (data: any, resetForm: any, invalidateForm: any) {
    const { basicData, onRegistration } = this.props;
    // const params = jQuery.extend({}, basicData, data);
    const params = {...basicData, ...data};
    // the updated react-select element uses {label, value} as the value so pull the value (id) from it
    if (params.country_id?.value) {
      params.country_id = params.country_id.value;
    }
    if (params.school_id?.value) {
      params.school_id = params.school_id.value;
    }
    this.setState({
      canSubmit: false
    });

    this.props.onAlert("TODO: Register Teacher");

    /*
    return registerTeacher(params)
      .done(_data => {
        return onRegistration(_data);
      })
      .fail(err => {
        return invalidateForm(JSON.parse(err.responseText).message);
      });
    */
  }

  onChange (currentValues: any) {
    const countryId = currentValues.country_id?.value;
    const zipcode = currentValues.zipcode;
    const { currentZipcode, registerNewSchool } = this.state;
    const zipcodeValid = this.zipcodeValidation([], zipcode);

    this.setState({
      currentCountry: countryId,
      currentZipcode: (zipcodeValid && zipcode) || null,
      registerNewSchool: registerNewSchool && zipcode === currentZipcode
    });
  }

  getCountries (callback: any) {
    // TODO: replace with API call
    callback([
      { label: "United States", value: "US" },
      { label: "Canada", value: "CA" },
      { label: "Australia", value: "AU" },
      { label: "New Zealand", value: "NZ" },
      { label: "United Kingdom", value: "GB" },
      { label: "Ireland", value: "IE" }
    ]);
    /*
    getCountries().done(data => {
      callback(data.map((country: any) => ({
        label: country.name,
        value: country.id
      })));
    });
    */
  }

  addNewSchool () {
    this.setState({
      registerNewSchool: true
    });
  }

  goBackToSchoolList () {
    this.setState({
      registerNewSchool: false
    });
  }

  checkIfUS (option: any) {
    this.setState({
      isUSSelected: isUS(option.label)
    });
  }

  zipcodeValidation (values: any, value: any) {
    if (!this.state.isUSSelected) {
      return true;
    }
    return value?.match(/\d{5}/);
  }

  zipOrPostal () {
    if (this.state.isUSSelected) {
      return "ZIP code";
    } else {
      return "postal code";
    }
  }

  renderAnonymous (showEnewsSubscription: any) {
    return (
      <div>
        <dl>
          <dt>Username</dt>
          <dd>
            <TextInput
              name="login"
              placeholder=""
              required={true}
              validations={{
                minLength: 3
              }}
              validationErrors={{
                minLength: LOGIN_TOO_SHORT
              }}
              asyncValidation={loginValidValidator}
              asyncValidationError={LOGIN_INVALID}
              autoFocus={true}
            />
          </dd>
          <dt>Email</dt>
          <dd>
            <TextInput
              name="email"
              placeholder=""
              required={true}
              validations={{
                isEmail: true
              }}
              validationErrors={{
                isEmail: EMAIL_REGEXP
              }}
              asyncValidation={emailAvailableValidator}
              asyncValidationError={EMAIL_TAKEN}
            />
          </dd>
          {
            showEnewsSubscription ?
              <dd>
                <CheckboxInput
                  name="email_subscribed"
                  required={false}
                  defaultChecked="true"
                  label="Send me updates about educational technology resources."
                />
              </dd> : undefined }
        </dl>
      </div>
    );
  }

  renderZipcode () {
    return (
      <dl>
        <dt>ZIP Code</dt>
        <dd>
          <div>
            <TextInput
              name="zipcode"
              placeholder={"School / Institution " + (this.zipOrPostal())}
              required={true}
              validations={{
                zipcode: this.zipcodeValidation
              }}
              validationErrors={{
                zipcode: invalidZipcode(this.zipOrPostal())
              }}
              processValue={(val: any) => val.replace(/\s/g, "")}
            />
          </div>
        </dd>
      </dl>
    );
  }

  render () {
    const { anonymous } = this.props;
    const { canSubmit, currentCountry, currentZipcode, registerNewSchool } = this.state;
    const showZipcode = currentCountry != null;
    const showSchool = (currentCountry != null) && (currentZipcode != null);
    const showEnewsSubscription = false;

    return (
      <Formsy
        onValidSubmit={this.submit}
        onValid={this.onBasicFormValid}
        onInvalid={this.onBasicFormInvalid}
        onChange={this.onChange}
      >
        { anonymous ? this.renderAnonymous(showEnewsSubscription) : undefined }
        <dl>
          <dt>Country</dt>
          <dd>
            <SelectInput
              name="country_id"
              placeholder=""
              loadOptions={this.getCountries}
              required
              onChange={this.checkIfUS}
            />
          </dd>
        </dl>
        { showZipcode ? this.renderZipcode() : undefined }
        <dl>
          { showSchool && !registerNewSchool
            ? <dt>School</dt>
            : undefined }
          {
            showSchool && !registerNewSchool ?
              <dd className="signup-form-school-select">
                <SchoolInput
                  name="school_id"
                  placeholder="School / Institution"
                  country={currentCountry}
                  zipcode={currentZipcode}
                  onAddNewSchool={this.addNewSchool}
                  required
                />
              </dd> : undefined
          }
          <dd>
            { showSchool && !registerNewSchool
              ? <a className="signup-form-add-school-link" onClick={this.addNewSchool}>{ CANT_FIND_SCHOOL }</a>
              : undefined }
            {
              showSchool && registerNewSchool ?
                <div>
                  <TextInput
                    name="school_name"
                    placeholder="School / Institution Name"
                    required
                  />
                  <div className="help-text">
                    { newSchoolWarning(this.zipOrPostal()) }
                  </div>
                </div>
                : undefined
            }
            {
              showSchool && registerNewSchool ?
                <a onClick={this.goBackToSchoolList}>{ GO_BACK_TO_LIST }</a>
                : undefined
            }
          </dd>
        </dl>
        {
          !anonymous && showEnewsSubscription ?
            <div className="signup-form-enews-optin-standalone">
              <CheckboxInput
                name="email_subscribed"
                required={false}
                defaultChecked
                label="Send me updates about educational technology resources."
              />
            </div>
            : undefined
        }
        <PrivacyPolicy />
        <div className="submit-button-container">
          <button className="submit-btn" onClick={this.props.onBack}>Back</button>
          <button className="submit-btn" type="submit" disabled={!canSubmit}>Register!</button>
        </div>
      </Formsy>
    );
  }
}
