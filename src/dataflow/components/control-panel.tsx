import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../../components/base";
import { listThings } from "../utilities/aws-iot";

interface IProps extends IBaseProps { }
interface IState {
  localThings: string;
}

@inject("stores")
@observer
export class ControlPanelComponent extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      localThings: "no things"
    };
  }
  public componentDidMount() {
    const { things } = this.stores;
    listThings((thingList: any) => {
      this.setState({ localThings: JSON.stringify(thingList) });
      // console.log(thingList.things);
      for (const t of thingList.things) {
        things.addThing(t.thingArn, t.thingName, "", true);
      }
    });
  }

  public render() {
    const { localThings } = this.state;
    const { things } = this.stores;
    const listOfThings = things.allThings && things.allThings.length > 0 ? things.allThings[0].thingName : "No things";
    return (
      <div className="control-panel">
        {listOfThings}
      </div>
    );
  }
}
