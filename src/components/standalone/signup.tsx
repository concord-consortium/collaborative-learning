import React from "react";

import StudentForm from "./student_form";
import TeacherForm from "./teacher_form";
import BasicDataForm from "./basic_data_form";
import StudentRegistrationComplete from "./student_registration_complete";
import TeacherRegistrationComplete from "./teacher_registration_complete";
import UserTypeSelector from "./user_type_selector";

import "./signup.scss";

export default class SignUp extends React.Component<any, any> {
  static defaultProps = {
    siteName: "Portal",
    signupText: "Next",
    anonymous: true // TODO: figure out how to set this initially
  };

  constructor (props: any) {
    super(props);
    this.state = {
      userType: null,
      basicData: null,
      studentData: null,
      teacherData: null,
      alert: null,
    };

    this.onUserTypeSelect = this.onUserTypeSelect.bind(this);
    this.onBasicDataSubmit = this.onBasicDataSubmit.bind(this);
    this.onStudentRegistration = this.onStudentRegistration.bind(this);
    this.onTeacherRegistration = this.onTeacherRegistration.bind(this);
    this.onResetUserSelector = this.onResetUserSelector.bind(this);
    this.onAlert = this.onAlert.bind(this);
    this.onResetBasicData = this.onResetBasicData.bind(this);
  }

  onUserTypeSelect (data: any) {
    this.setState({
      userType: data
    });
  }

  onResetUserSelector() {
    this.setState({
      userType: null,
    });
  }

  onBasicDataSubmit (data: any) {
    data.sign_up_path = window.location.pathname;
    this.setState({
      basicData: data
    });
  }

  onStudentRegistration (data: any) {
    this.setState({
      studentData: data
    });
  }

  onTeacherRegistration (data: any) {
    this.setState({
      teacherData: data
    });
  }

  onResetBasicData () {
    this.setState({
      basicData: null,
    });
  }

  onAlert (message: string) {
    this.setState({
      alert: message
    });
    setTimeout(() => {
      this.setState({
        alert: null
      });
    }, 5000);
  }

  getStepNumber () {
    const { basicData, studentData, teacherData } = this.state;

    if (!basicData) {
      return 1;
    }
    if ((basicData && !studentData && !teacherData)) {
      return 2;
    }
    return 3;
  }

  renderForm () {
    const { signupText, oauthProviders, anonymous } = this.props;
    const { userType, basicData, studentData, teacherData } = this.state;

    if (studentData) {
      return <StudentRegistrationComplete anonymous={anonymous} data={studentData} />;
    }

    if (teacherData) {
      return  <TeacherRegistrationComplete anonymous={anonymous} />;
    }

    if (!userType) {
      return <UserTypeSelector
        anonymous={anonymous}
        oauthProviders={oauthProviders}
        onUserTypeSelect={this.onUserTypeSelect}
        onAlert={this.onAlert}
      />;
    }

    if (basicData) {
      if (userType === "teacher") {
        return <TeacherForm
          anonymous={this.props.anonymous}
          basicData={basicData}
          onRegistration={this.onTeacherRegistration}
          onBack={this.onResetBasicData}
          onAlert={this.onAlert}
        />;
      }

      return <StudentForm
        basicData={basicData}
        onRegistration={this.onStudentRegistration}
        onBack={this.onResetBasicData}
        onAlert={this.onAlert}
      />;
    }

    return <BasicDataForm
      anonymous={anonymous}
      userType={userType}
      signupText={signupText}
      oauthProviders={oauthProviders}
      onBack={this.onResetUserSelector}
      onAlert={this.onAlert}
      onSubmit={this.onBasicDataSubmit}
    />;
  }

  render () {
    const { anonymous } = this.props;
    const { userType } = this.state;

    const formTitle = !anonymous
      ? "Finish"
      : (this.state.userType
          ? "Register as a " + userType.charAt(0).toUpperCase() + userType.slice(1)
          : "Register "
      );

    return (
      <div className="signup">
        <h2>
          <strong>{ formTitle }</strong>{
            anonymous
            ? <span> for the { this.props.siteName }</span> : <span>Signing Up</span>
          }
        </h2>
        <div className="signup-form">
          { this.renderForm() }
        </div>
        <footer className="reg-footer">
          <p>
            <strong>Why sign up?</strong> It&apos;s free and you get access to several key features,
            like creating classes for your students, assigning activities, saving work,
            tracking student progress, and more!
          </p>
        </footer>

        {this.state.alert && <div className="alert">{this.state.alert}</div>}
      </div>
    );
  }
}
