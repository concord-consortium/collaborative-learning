
import React, { useEffect } from "react";

import { units, useCurriculum } from "../hooks/use-curriculum";
import LeftNav from "./left-nav";
import Workspace from "./workspace";
import MediaLibrary from "./media-library";
import useAuth from "../hooks/use-auth";
import useAuthoringApi from "../hooks/use-authoring-api";

import "./app.scss";

const App: React.FC = () => {
  const auth = useAuth();
  const api = useAuthoringApi(auth);
  const {
    branch, listBranches, setBranch, unit, setUnit,
    unitConfig, setUnitConfig, error, path, files, reset,
    saveState
  } = useCurriculum(auth, api);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [showMediaLibrary, setShowMediaLibrary] = React.useState(false);

  const toggleMediaLibrary = () => setShowMediaLibrary(value => !value);

  // uncomment when using the manual admin actions below - remove when
  // we have a proper admin UI
  // const pulledRef = React.useRef(false);

  // until we have an admin UI, use direct api calls to set things up
  useEffect(() => {
    /*
    // if needed for debugging in the future, uncomment to use the
    // whoami endpoint that verifies authentication is working
    api.get("/whoami").then((response) => {
      console.log("Whoami response:", response);
    }).catch((err) => {
      console.error("Whoami error:", err);
    });
    */

    /*
    if (auth.firebaseToken && auth.gitHubToken && pulledRef.current !== true) {
      pulledRef.current = true;

      const branchToPull = "authoring-testing";
      const unitToPull = "m2s";

      console.log(`Pulling unit: ${branchToPull}/${unitToPull}`);
      api.post("/pullUnit", { branch: branchToPull, unit: unitToPull }).then(() => {
        console.log(`Pulled unit: ${branchToPull}/${unitToPull}`);
      }).catch((err) => {
        console.error(`Error pulling unit: ${branchToPull}/${unitToPull}`, err);
      });
    }
    */
  }, [api, auth.firebaseToken, auth.gitHubToken]);

  useEffect(() => {
    if (!branch) {
      listBranches().then((b) => {
        setBranches(b);
      });
    }
  }, [branch, listBranches]);

  const maybeSignOut = (force?: boolean) => {
    if (force || confirm("Are you sure you want to sign out?")) {
      auth.signOut();
      reset();
    }
  };

  const renderHeader = () => {
    const title = `CLUE Authoring${unitConfig ? `: ${unitConfig.title}` : ""}`;

    return (
      <header className="header">
        <div className="left-header">
          <div className="title">{title}</div>
          {saveState && <div className="save-state">{saveState}</div>}
        </div>
        <div className="info">
          {auth.user && (
            <div>{auth.user.email} | <span onClick={() => maybeSignOut()}>Logout</span></div>
          )}
          {(branch || unit) && (
            <>
              Branch: <a href="#/">{branch}</a> {unit && "| Unit:"} {unit && <a href={`#/${branch}`}>{unit}</a>}
            </>
          )}
        </div>
      </header>
    );
  };

  const renderMainContent = () => {
    if (auth.loading) {
      return <div className="centered">Checking authentication...</div>;
    }
    if (auth.error) {
      return (
        <div className="centered">
          <div className="error">Authentication error: {auth.error}</div>
          <div>
            <button onClick={() => maybeSignOut(true)}>Try Again</button>
          </div>
        </div>
      );
    }
    if (!auth.user) {
      return (
        <div className="centered">
          <div>
            <form
              className="sign-in-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await auth.signIn();
              }}
            >
              <div>
                <button type="submit" disabled={auth.loading}>
                  {auth.loading ? "Signing in with your GitHub account..." : "Please sign in to GitHub"}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

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

    if (!unitConfig || !files) {
      return (
        <div className="centered">
          <div>Loading unit ...</div>
        </div>
      );
    }

    return (
      <>
        <LeftNav
          branch={branch}
          unit={unit}
          unitConfig={unitConfig}
          files={files}
          showMediaLibrary={showMediaLibrary}
          onMediaLibraryClicked={toggleMediaLibrary}
        />
        <Workspace
          branch={branch}
          unit={unit}
          unitConfig={unitConfig}
          setUnitConfig={setUnitConfig}
          path={path}
          api={api}
          saveState={saveState}
        />
        {showMediaLibrary && (
          <MediaLibrary
            onClose={toggleMediaLibrary}
            files={files}
            branch={branch}
            unit={unit}
            api={api}
          />
        )}
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
