import * as React from "react"
import { observer } from "mobx-react"

import "./my-work.sass"

interface Props {
}

@observer
export class MyWorkComponent extends React.Component<Props, {}> {

  render() {
    return (
      <div className="my-work">
        My Work
      </div>
    )
  }
}