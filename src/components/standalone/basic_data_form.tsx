import React from "react";
import Formsy from "formsy-react";
import TextInput from "./text_input";

const MIN_PASSWORD_LENGTH = 6;

const PASS_TOO_SHORT = `Password is too short, must be at least ${MIN_PASSWORD_LENGTH} characters.`;
const PASS_NOT_MATCH = "Passwords do not match";
const INVALID_FIRST_NAME = "Invalid first name. Use only letters and numbers.";
const INVALID_LAST_NAME = "Invalid last name. Use only letters and numbers.";

const enableAuthProviders = true;


export default class BasicDataForm extends React.Component<any, any> {
  constructor (props: any) {
    super(props);
    this.state = {
      canSubmit: false
    };

    this.onBasicFormValid = this.onBasicFormValid.bind(this);
    this.onBasicFormInvalid = this.onBasicFormInvalid.bind(this);
    this.submit = this.submit.bind(this);
    this.passwordMatchValidator = this.passwordMatchValidator.bind(this);
    this.nameValidator = this.nameValidator.bind(this);
  }

  nameValidator(value: any) {
    this.props.onAlert("TODO: nameValidator");
  }
  // jQuery.get(Portal.API_V1.NAME_VALID + "?name=" + value);

  passwordMatchValidator({ password, password_confirmation }: {password: string, password_confirmation: string}) {
    if ((password?.length > 0) && (password_confirmation?.length > 0) && (password !== password_confirmation)) {
      return false;
    }
    return true;
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

  submit (model: any) {
    /*
    // log this event?
    gtag("event", "click", {
      "category": "User Registration",
      "label": "Form step 2 completed"
    });
    */
    this.props.onSubmit(model);
  }

  render () {
    const anonymous = this.props.anonymous;

    const providerComponents = [];
    if (enableAuthProviders && this.props.oauthProviders) {
      const providers = this.props.oauthProviders;
      providers.sort(function (a: any, b: any) {
        // sort providers alphabetically by name
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
      });
      for (let i = 0; i < providers.length; i++) {
        if (i === 0) {
          providerComponents.push(
            <p>Sign up with:</p>
          );
        }

        providerComponents.push(
          <a className="badge" id={providers[i].name} href={providers[i].directPath}>
            Sign up with { providers[i].display_name }
          </a>
        );
      }
      if (providers.length > 0) {
        providerComponents.push(
          //
          // Push separator bar
          //
          <div className="or-separator">
            <span className="or-separator-text">Or, create an account</span>
          </div>
        );
      }
    }

    return (
      <Formsy
        onValidSubmit={this.submit}
        onValid={this.onBasicFormValid}
        onInvalid={this.onBasicFormInvalid}
        role="form"
        aria-roledescription="form"
      >
        <div className="third-party-login-options testy" data-testid="third-party-login-options">
          { providerComponents }
        </div>
        {
          anonymous &&
          <div>
            <dl>
              <dt className="two-col">First Name</dt>
              <dd>
                <TextInput
                  name="first_name"
                  placeholder=""
                  required
                  asyncValidation={this.nameValidator}
                  asyncValidationError={INVALID_FIRST_NAME}
                  autoFocus={true}
                />
              </dd>
              <dt className="two-col">Last Name</dt>
              <dd>
                <TextInput
                  name="last_name"
                  placeholder=""
                  required
                  asyncValidation={this.nameValidator}
                  asyncValidationError={INVALID_LAST_NAME}
                />
              </dd>
              <dt>Password</dt>
              <dd>
                <TextInput
                  name="password"
                  placeholder=""
                  type="password"
                  required
                  validations={`minLength:${MIN_PASSWORD_LENGTH}`}
                  validationError={PASS_TOO_SHORT}
                />
              </dd>
              <dt>Confirm Password</dt>
              <dd>
                <TextInput
                  name="password_confirmation"
                  placeholder=""
                  type="password"
                  required
                  validations={{ passwordMatchValidator: this.passwordMatchValidator }}
                  validationError={PASS_NOT_MATCH}
                />
              </dd>
            </dl>
          </div>
        }
        <div className="submit-button-container">
          <button
            className="submit-btn"
            onClick={this.props.onBack}
            type="button"
          >
            Back
          </button>
          <button
            className="submit-btn"
            type="submit"
            disabled={!this.state.canSubmit}
          >
            { this.props.signupText }
          </button>
        </div>
      </Formsy>
    );
  }
}
