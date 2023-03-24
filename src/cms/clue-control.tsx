import React from "react";
import { QueryClient } from "react-query";

import { EditorApp, IAppProperties, initializeApp } from "../initialize-app";
import { editorModes } from "../components/doc-editor-app";
import { IStores } from "../models/stores/stores";

import "./clue-control.scss";

// There is a CmsWidgetControlProps type, but it doesn't seem to be
// exported by DecapCMS
interface IProps {
  field: any,
  onChange: (value: any) => void,
  forID: string,
  value: any,
  classNameWrapper: string,
  label?: string
}

interface IState {
  queryClient?: QueryClient;
  stores?: IStores;
}

export class ClueControl extends React.Component<IProps, IState>  {
  constructor(props: IProps) {
    super(props);
    this.state = {};

    initializeApp().then((appProperties: IAppProperties) => {
      this.setState(appProperties);
    });
  }

  render() {
    if (this.state.stores && this.state.queryClient) {
      const docEditorAppProps = {
        contained: true,
        editorMode: "cmsWidget" as editorModes,
        initialValue: this.props.value.toJS?.(),
        onChange: this.props.onChange
      };
      return (
        <EditorApp
          docEditorAppProps={docEditorAppProps}
          queryClient={this.state.queryClient}
          stores={this.state.stores}
        />
      );
    } else {
      return <div className="loading-box">Loading editor...</div>;
    }
  }
}

