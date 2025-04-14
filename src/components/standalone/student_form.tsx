import React from "react";
import TextInput from "./text_input";
import PrivacyPolicy from "./privacy_policy";
import Formsy from "formsy-react";

const INVALID_CLASS_WORD = "You must enter a valid class word";

/*
const classWordValidator = (value: any) => Promise.reject(new Error("TODO: classWordValidator"));
  // jQuery.get(Portal.API_V1.CLASSWORD + "?class_word=" + value);
const registerStudent = (params: any) => Promise.reject(new Error("TODO: registerStudent"));
  // jQuery.post(Portal.API_V1.STUDENTS, params);
*/

export default class StudentForm extends React.Component<any, any> {
  constructor (props: any) {
    super(props);
    this.state = {
      canSubmit: false
    };
    this.onBasicFormValid = this.onBasicFormValid.bind(this);
    this.onBasicFormInvalid = this.onBasicFormInvalid.bind(this);
    this.submit = this.submit.bind(this);
    this.classWordValidator = this.classWordValidator.bind(this);
  }

  classWordValidator (value: any) {
    // TODO: replace with actual API call
    this.props.onAlert("TODO: Validate Class Word");
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
    // const { basicData, onRegistration } = this.props;
    // const params = jQuery.extend({}, basicData, data);
    // const params = {...basicData, ...data};

    this.setState({
      canSubmit: false
    });

    this.props.onAlert("TODO: Register Student");
    /*
    return registerStudent(params)
      .done(_data => onRegistration(_data))
      .fail(err => invalidateForm(JSON.parse(err.responseText).message));
    */
  }

  render () {
    return (
      <Formsy
        onValidSubmit={this.submit}
        onValid={this.onBasicFormValid}
        onInvalid={this.onBasicFormInvalid}
      >
        <dl>
          <dt>Class Word</dt>
          <dd>
            <TextInput
              name="class_word"
              placeholder="Class Word (not case sensitive)"
              required
              asyncValidation={this.classWordValidator}
              asyncValidationError={INVALID_CLASS_WORD}
              autoFocus={true}
            />
          </dd>
        </dl>
        <PrivacyPolicy />
        <div className="submit-button-container">
          <button className="submit-btn" onClick={this.props.onBack}>Back</button>
          <button className="submit-btn" type="submit" disabled={!this.state.canSubmit}>
            Register!
          </button>
        </div>
      </Formsy>
    );
  }
}
