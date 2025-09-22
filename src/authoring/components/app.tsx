
import React, { useEffect } from "react";
import { useImmer } from "use-immer";

import { units, useCurriculum } from "../hooks/use-curriculum";
import LeftNav from "./left-nav";
import Workspace from "./workspace";

import "./app.scss";

const App: React.FC = () => {
  const {
    branch, listBranches, setBranch, unit, setUnit,
    unitConfig, setUnitConfig, error, path, loadFile
  } = useCurriculum();
  const [branches, setBranches] = useImmer<string[]>([]);

  useEffect(() => {
    if (!branch) {
      listBranches().then((b) => {
        setBranches(b);
      });
    }
  }, [branch, listBranches, setBranches]);

  const renderHeader = () => {
    const title = `CLUE Authoring${unitConfig ? `: ${unitConfig.title}` : ""}`;

    return (
      <header className="header">
        <div className="title">{title}</div>
        {branch && unit && unitConfig && (
          <div className="info">
            Branch: <a href="#/">{branch}</a> / Unit: <a href={`#/${branch}`}>{unit}</a>
          </div>
        )}
      </header>
    );
  };

  const renderMainContent = () => {
    // skip authState check for now

    if (!branch) {
      if (branches.length === 0) {
        return <div className="centered">Loading branches...</div>;
      }
      return (
        <div className="centered">
          <div>
            <select key="branch-select" defaultValue="" onChange={(e) => setBranch(e.target.value, true)}>
              <option value="" disabled>Please select a branch ...</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (!unit) {
      return (
        <div className="centered">
          <div>
            <select key="unit-select" defaultValue="" onChange={(e) => setUnit(e.target.value, true)}>
              <option value="" disabled>Please select a unit ...</option>
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (!unitConfig) {
      return (
        <div className="centered">
          <div>Loading unit config...</div>
        </div>
      );
    }

    return (
      <>
        <LeftNav branch={branch} unit={unit} unitConfig={unitConfig} />
        <Workspace
          branch={branch}
          unit={unit}
          unitConfig={unitConfig}
          setUnitConfig={setUnitConfig}
          path={path}
          loadFile={loadFile}
        />
      </>
    );
  };

  const maybeRenderError = () => {
    if (error) {
      return (
        <div className="error-container">
          <div className="error">{error}</div>
        </div>
      );
    }
  };

  return (
    <div className="app">
      {renderHeader()}
      <main className="main">
        {renderMainContent()}
      </main>
      {maybeRenderError()}
    </div>
  );
};

export default App;
