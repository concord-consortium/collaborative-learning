import { observer } from "mobx-react";
import React, { useRef } from "react";
import { ITileProps } from "../../components/tiles/tile-component";
import { SimulatorContentModelType } from "./simulator-content";
import "./simulator-tile.scss";

export const SimulatorToolComponent: React.FC<ITileProps> = observer((props) => {
  // Note: capturing the content here and using it in handleChange() below may run the risk
  // of encountering a stale closure issue depending on the order in which content changes,
  // component renders, and calls to handleChange() occur. See the PR discussion at
  // (https://github.com/concord-consortium/collaborative-learning/pull/1222/files#r824873678
  // and following comments) for details. We should be on the lookout for such issues.
  const content = props.model.content as SimulatorContentModelType;
  const intervalRef = useRef<any>(null);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    content.setText(event.target.value);
  };

  const handleStart = () => {
    if (intervalRef.current) {
      // don't start twice
      return;
    }
    intervalRef.current = setInterval(() => {
      content.step();
    }, 100);
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const x = content.xVariable?.computedValue;
  const y = content.yVariable?.computedValue;

  return (
    <div className="simulator-tool">
      <button onClick={handleStart}>Start</button>
      <button onClick={handleStop}>Stop</button>
      <div style={{width:20, height:20, backgroundColor:"red", position:"absolute", bottom:`${y}px`, left:`${x}px`}}></div>
      {/* <textarea value={content.text} onChange={handleChange} /> */}
    </div>
  );
});
SimulatorToolComponent.displayName = "SimulatorToolComponent";
