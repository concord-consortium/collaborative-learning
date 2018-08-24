import * as React from "react"
import { observer, inject } from "mobx-react"
import { UserModelType } from "../models/user"
import { ProblemModelType } from "../models/problem"
import { AppContainerComponent } from "./app-container"

import "./app.sass"

interface Props {
}

interface InjectedProps {
  user: UserModelType
  devMode: boolean
}

// import this type into other components when using @inject
export interface AllStores {
  devMode: boolean
  user: UserModelType
  problem: ProblemModelType
}

@inject((allStores:AllStores) => {
  return {
    user: allStores.user,
    devMode: allStores.devMode
  } as InjectedProps
})
@observer
export class AppComponent extends React.Component<Props, {}> {

  get injected() {
    return this.props as InjectedProps
  }

  componentWillMount() {
    if (!this.injected.user.authenticated) {
      // TODO: start user authentication here
      // NOTE: authenticated will always be true in developer mode so you may want to check this.injected.devMode while developing this
    }
  }

  render() {
    if (!this.injected.user.authenticated) {
      return (
        <div className="app">
          <div className="progress">Authenticating</div>
        </div>
      )
    }

    return (
      <div className="app">
        <AppContainerComponent />
      </div>
    )
  }
}