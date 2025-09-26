
import React, { useEffect } from "react";

import { units, useCurriculum } from "../hooks/use-curriculum";
import LeftNav from "./left-nav";
import Workspace from "./workspace";
import useAuth from "../hooks/use-auth";
import useAuthoringApi from "../hooks/use-authoring-api";

import "./app.scss";

const App: React.FC = () => {
  const auth = useAuth();
  const api = useAuthoringApi(auth);
  const { branch, listBranches, setBranch, unit, setUnit, unitConfig, error, path, files } = useCurriculum(auth, api);
  const [branches, setBranches] = React.useState<string[]>([]);

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
    console.log("Pulling unit");
    api.post("/pullUnit", { branch: "main", unit: "cas" }).then(() => {
      console.log("Pulled unit");
    }).catch((err) => {
      console.error("Error pulling unit:", err);
    });
    */
  }, [api]);

  useEffect(() => {
    if (!branch) {
      listBranches().then((b) => {
        setBranches(b);
      });
    }
  }, [branch, listBranches]);

  const maybeSignOut = () => {
    if (confirm("Are you sure you want to sign out?")) {
      auth.signOut();
    }
  };

  const renderHeader = () => {
    const title = `CLUE Authoring${unitConfig ? `: ${unitConfig.title}` : ""}`;

    return (
      <header className="header">
        <div className="title">{title}</div>
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
            <button onClick={auth.reset}>Try Again</button>
          </div>
        </div>
      );
    }
    if (!auth.user) {
      return (
        <div className="centered">
          <div>
            <h2>Please Sign In</h2>
            <form
              className="sign-in-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const email = (form.elements.namedItem("email") as HTMLInputElement).value;
                const password = (form.elements.namedItem("password") as HTMLInputElement).value;
                await auth.signIn(email, password);
              }}
            >
              <div>
                <label htmlFor="email">Email:</label>
                <input id="email" type="email" name="email" required autoFocus disabled={auth.loading} />
              </div>
              <div>
                <label htmlFor="password">Password:</label>
                <input id="password" type="password" name="password" required disabled={auth.loading} />
              </div>
              <div>
                <button type="submit" disabled={auth.loading}>
                  {auth.loading ? "Signing in..." : "Sign In"}
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
        <LeftNav branch={branch} unit={unit} unitConfig={unitConfig} files={files} />
        <Workspace branch={branch} unit={unit} unitConfig={unitConfig} path={path} api={api} />
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
