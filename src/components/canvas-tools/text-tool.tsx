import * as React from 'react'
import { Editor } from 'slate-react'
import { Value } from 'slate'

import './text-tool.sass'
​
const initialValue = Value.fromJSON({
  document: {
    nodes: [
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'It was Prof. Plum, with the rope, in the library! ',
              },
            ],
          },
        ],
      },
    ],
  },
})
​
// Define our app...
export default class TextTool extends React.Component {
  // Set the initial value when the app is first constructed.
  state = {
    value: initialValue,
  }
​
  // On change, update the app's React state with the new editor value.
  onChange = ({ value }: any) => {
    this.setState({ value })
  }
​
  // Render the editor.
  render() {
    return <Editor className="texttool" value={this.state.value} onChange={this.onChange} />
  }
}