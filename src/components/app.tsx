import * as React from "react"
import { observer, inject } from "mobx-react"
import { UserType } from "../models/user"

import "./app.sass"

interface Props {
}

interface InjectedProps {
  user: UserType
}

// import this type into other components when using @inject
export interface AllStores {
  user: UserType
}

@inject((allStores:AllStores) => {
  return {
    user: allStores.user
  } as InjectedProps
})
@observer
export class AppComponent extends React.Component<Props, {}> {

  get injected() {
    return this.props as InjectedProps
  }

  componentWillMount() {
    if (!this.injected.user) {
      // TODO: do user authentication checks here
    }
  }

  handleClick = (e:React.MouseEvent<HTMLDivElement>) => {
    // testing user model updates
    this.injected.user.setName(`Example User clicked at ${Date.now()}`)
  }

  render() {
    return (
      <div className="app" onClick={this.handleClick}>Collaborative Learning Environment: {this.injected.user.name}</div>
    )
  }
}