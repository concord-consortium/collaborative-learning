import React from "react";

import "./user_type_selector.scss";

export default class UserTypeSelector extends React.Component<any, any> {
  constructor (props: any) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.handleLoginClick = this.handleLoginClick.bind(this);
  }

  handleClick (event: any) {
    const value = event.currentTarget.value;
    /*
    // log this event?
    gtag("event", "click", {
      "category": "User Registration",
      "label": "Step 1 Completed - " + value.charAt(0).toUpperCase() + value.slice(1)
    });
    */

    this.props.onUserTypeSelect(value);
  }

  handleLoginClick (event: any) {
    event.preventDefault();
    /*
    // log this event?
    gtag("event", "click", {
      "category": "User Registration",
      "label": "Step 1 Log in Link Clicked"
    });
    */

    // STANDALONE UI TODO
    this.props.onAlert("LOGIN CLICKED");
  }

  render () {
    return (
      <div className="user-type-selector">
        <div className="user-type-buttons">
          <button onClick={this.handleClick} name="type" value="teacher">
            I am a <strong>Teacher</strong>
          </button>
          <button onClick={this.handleClick} name="type" value="student">
            I am a <strong>Student</strong>
          </button>
        </div>
        <p className="login-option">
          Already have an account?{" "}
          <a href="/users/sign_in" onClick={this.handleLoginClick}>
            Log in &raquo;
          </a>
        </p>
      </div>
    );
  }
}
