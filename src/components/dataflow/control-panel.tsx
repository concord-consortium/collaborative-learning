import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { listThings } from "../../utilities/aws-iot";
import { urlParams } from "../../utilities/url-params";

interface IProps extends IBaseProps { }
interface IState {
  things: string;
}

@inject("stores")
@observer
export class ControlPanelComponent extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      things: "no things"
    };
  }
  public componentDidMount() {
    if (urlParams.dataflow) {
      listThings((thingList: any) => {
        this.setState({ things: JSON.stringify(thingList) });
      });
    }
  }

  public render() {
    const { things } = this.state;
    return (
      <div className="control-panel">
        {things}
      </div>
    );
  }
}
