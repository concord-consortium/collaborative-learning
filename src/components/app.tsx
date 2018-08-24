import * as React from "react"
import { observer, inject } from "mobx-react"
import { UserType } from "../models/user"

import "./app.sass"

interface Props {
  user?: UserType // needs to be optional as it injected by the provider
}

interface State {
}

// import this type into other components when using @inject
export interface AllStores {
  user: UserType
}

@observer
@inject((allStores:AllStores) => ({
  user: allStores.user
}))
export class AppComponent extends React.Component<Props, State> {
  constructor (props:Props) {
    super(props)

    this.state = {
    }
  }

  get user():UserType {
    return this.props.user! // need to append ! to signal the user prop is expected to exist
  }

  componentWillMount() {
    if (!this.user.authenticated) {
      // TODO: do user authentication checks here
    }
  }

  render() {
    return (
      <div className="app">Collaborative Learning Environment: {this.user.name}</div>
    )
  }
}