import React, { useEffect, useRef } from "react";
import { IToolTileProps } from "./tool-tile";

import "./plugin-tool.sass";

type IProps = IToolTileProps;

const PluginToolComponent: React.FC<IProps> = (props) => {
  const { render, serialize, deserialize } = props;

  const divRef: any = useRef(null);
  useEffect(() => {
    render(divRef);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="plugin-tool" ref={divRef}>
      <button onClick={() => serialize()}>serialize</button>
      <button onClick={() => deserialize(`{"content":"Hola Mundo!"}`)}>deserialize</button>
    </div>
  );
};

(PluginToolComponent as any).tileHandlesSelection = true;
export default PluginToolComponent;