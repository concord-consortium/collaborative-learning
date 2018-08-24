import * as React from "react"
import { observer } from "mobx-react"

import "./learning-log.sass"

interface Props {
}

@observer
export class LearningLogComponent extends React.Component<Props, {}> {

  render() {
    return (
      <div className="learning-log">
        Learning Log
      </div>
    )
  }
}