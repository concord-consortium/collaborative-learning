import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "mobx-react"

import { AppComponent } from "./components/app"
import { User } from "./models/user"

import "./index.sass"

const user = User.create({
  authenticated: true,
  name: "Example User"
})

ReactDOM.render(
  <Provider user={user}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
)