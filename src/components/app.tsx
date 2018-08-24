import * as React from "react"
import "./app.sass"

interface Props {
}

interface State {
}

export class AppComponent extends React.Component<Props, State> {
  constructor (props:Props) {
    super(props)

    this.state = {
    }
  }

  render() {
    return (
      <div className="app">Collaborative Learning Environment</div>
    )
  }
}