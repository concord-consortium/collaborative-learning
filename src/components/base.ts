import * as React from "react";
import { IStores } from "../models/stores";

export interface IBaseProps {
  stores?: IStores;
}

export class BaseComponent<P, S> extends React.Component<P, S> {

  // this assumes that stores are injected by the classes that extend BaseComponent
  get stores() {
    return (this.props as IBaseProps).stores as IStores;
  }

}
