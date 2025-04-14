import React from "react";

export default class TeacherRegistrationComplete extends React.Component<any, any> {
  componentDidMount () {
    /*
    // log this event?
    gtag("event", "click", {
      "category": "User Registration",
      "label": "Final Step Completed - Teacher"
    });
    */
  }

  render () {
    const successMessage = this.props.anonymous
      ? (
        <p>
          We&apos;re sending you an email with your activation code. Click the &quot;Confirm Account&quot; link in the
          email to complete the process.
        </p>
      )
      : <p><a href="/">Start using the site.</a></p>;

    return (
      <div className="registration-complete">
        <p className="reg-header">Thanks for signing up!</p>
        { successMessage }
      </div>
    );
  }
}
