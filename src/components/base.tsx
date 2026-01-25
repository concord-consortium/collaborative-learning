import React from "react";
import { IStores } from "../models/stores/stores";
import { translate, TranslationKeyType } from "../utilities/translation";

export interface IBaseProps {
  stores?: IStores;
}

interface INullState {}

export class BaseComponent<P, S = INullState> extends React.Component<P, S> {

  // this assumes that stores are injected by the classes that extend BaseComponent
  get stores() {
    return (this.props as IBaseProps).stores as IStores;
  }

  /**
   * Translate a key using module-level term overrides.
   * Available to all class components that extend BaseComponent.
   *
   * Note: Term overrides are set at app initialization via setTermOverrides().
   */
  protected t = (key: TranslationKeyType) => translate(key);

}
