import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "mobx-react"

import { AppComponent } from "./components/app"
import { User } from "./models/user"

import "./index.sass"

const host = window.location.host.split(":")[0]
const devMode = (host === "localhost") || (host === "127.0.0.1")

const user = User.create({
  authenticated: devMode,
  name: devMode ? "Developer Mode" : null
})

ReactDOM.render(
  <Provider devMode={devMode} user={user}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
)