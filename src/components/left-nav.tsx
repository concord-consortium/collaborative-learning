import * as React from "react"
import { observer } from "mobx-react"

import "./left-nav.sass"

interface Props {
}

@observer
export class LeftNavComponent extends React.Component<Props, {}> {

  render() {
    return (
      <div className="left-nav">
        Left Nav
      </div>
    )
  }
}