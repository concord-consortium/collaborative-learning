import React from "react";
import { IDocumentContext } from "../../models/document/document-types";

export const DocumentContextReact = React.createContext<IDocumentContext | undefined>(undefined);

/*
 * Example of use
 *
import { DocumentContext } from "../../../components/document/document-context";

export class GeometryContentComponent extends BaseComponent<{}, {}> {

  public static contextType = DocumentContext;
  public declare context: React.ContextType<typeof DocumentContext>;

  public componentDidUpdate() {
    this.context && this.context.setProperties({ foo: "bar", baz: "roo" });
  }
}
*/
