import * as React from "react"
import { observer, inject } from "mobx-react"
import { UserModelType } from "../models/user"
import { AllStores } from "./app"

import "./header.sass"

interface Props {
}

interface InjectedProps {
  user: UserModelType
}

@inject((allStores:AllStores) => {
  return {
    user: allStores.user
  } as InjectedProps
})
@observer
export class HeaderComponent extends React.Component<Props, {}> {

  get injected() {
    return this.props as InjectedProps
  }

  render() {
    return (
      <div className="header">Collaborative Learning Environment: {this.injected.user.name}</div>
    )
  }
}