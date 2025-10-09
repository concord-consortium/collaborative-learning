
import React, { useState } from "react";

import { CurriculumProvider, useCurriculum } from "../hooks/use-curriculum";
import LeftNav from "./left-nav";
import Workspace from "./workspace";
import MediaLibrary from "./media-library";
import { AuthProvider, useAuth } from "../hooks/use-auth";
import { AuthoringApiProvider, useAuthoringApi } from "../hooks/use-authoring-api";
import { AuthoringPreviewProvider, useAuthoringPreview } from "../hooks/use-authoring-preview";
import Admin from "./admin";

import "./app.scss";

const InnerApp: React.FC = () => {
  const auth = useAuth();
  const authoringPreview = useAuthoringPreview();
  const {
    branch, setBranch, unit, setUnit,
    unitConfig, error, files, reset,
    saveState, branchMetadata,
  } = useCurriculum();
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showAdminUI, setShowAdminUI] = useState(false);

  const toggleMediaLibrary = () => setShowMediaLibrary(value => !value);
  const toggleAdminUI = () => setShowAdminUI(value => !value);

  const maybeSignOut = (force?: boolean) => {
    if (force || confirm("Are you sure you want to sign out?")) {
      auth.signOut();
      reset();
    }
  };

  const handlePreviewClick = () => {
    if (branch && unit) {
      authoringPreview.openPreview(branch, unit);
    }
  };

  const renderHeader = () => {
    const title = `CLUE Authoring${unitConfig ? `: ${unitConfig.title}` : ""}`;

    return (
      <header className="header">
        <div className="left-header">
          <div className="title">{title}</div>
          {saveState && <div className="save-state">{saveState}</div>}
          { branch && unit && (
            <button onClick={handlePreviewClick}>
              Preview
            </button>
          )}
          {auth.isAdminUser && (
            <button onClick={toggleAdminUI}>
              Admin
            </button>
          )}
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
    if (error) {
      return null;
    }
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
      const branches = Object.keys(branchMetadata).sort();
      if (branches.length === 0) {
        return <div className="centered">Loading branches...</div>;
      }
      return (
        <div className="centered">
          <div>
            <label className="block" htmlFor="branch-select">Select a branch:</label>
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
      const units = Object.keys(branchMetadata[branch]?.units || {}).map(u => u).sort();
      return (
        <div className="centered">
          <div>
            <label className="block" htmlFor="unit-select">Select a unit</label>
            <select id="unit-select" key="unit-select" defaultValue="" onChange={(e) => setUnit(e.target.value, true)}>
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
          showMediaLibrary={showMediaLibrary}
          onMediaLibraryClicked={toggleMediaLibrary}
        />
        <Workspace />
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
        {showMediaLibrary && (
          <MediaLibrary onClose={toggleMediaLibrary} />
        )}
        {showAdminUI && <Admin onClose={toggleAdminUI} />}
      </main>
      {maybeRenderError()}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthoringApiProvider>
        <AuthoringPreviewProvider>
          <CurriculumProvider>
            <InnerApp />
          </CurriculumProvider>
        </AuthoringPreviewProvider>
      </AuthoringApiProvider>
    </AuthProvider>
  );
};

export default App;
