import React, { useEffect, useMemo } from "react";

import Modal from "./modal";
import { useCurriculum } from "../hooks/use-curriculum";
import { useAuthoringApi } from "../hooks/use-authoring-api";
import { useAuth } from "../hooks/use-auth";
import { useCommitDescriptions } from "../hooks/use-commit-description";

import "./commit-ui.scss";

interface IProps {
  onClose: () => void;
}

const CommitUI: React.FC<IProps> = ({ onClose }) => {
  const api = useAuthoringApi();
  const auth = useAuth();
  const curriculum = useCurriculum();
  const { branch, unit, branchMetadata } = curriculum;
  const [error, setError] = React.useState<string | null>(null);
  const { descriptionsState, descriptions } = useCommitDescriptions({branch, unit});
  const [status, setStatus] = React.useState<"committing" | "committed" | undefined>();

  const updates = useMemo<Record<string, number>>(() => {
    if (!branch || !unit) {
      return {};
    }
    return branchMetadata[branch]?.units[unit]?.updates ?? {};
  }, [branch, unit, branchMetadata]);

  useEffect(() => {
    if (!branch || !unit) {
      setError("No branch or unit selected.");
      return;
    }

    if (!auth.gitHubToken) {
      setError("You must be signed in to commit changes.");
      return;
    }

    if (Object.keys(updates).length === 0) {
      setError("No updates to commit.");
      return;
    }
  }, [branch, unit, auth.gitHubToken, updates]);

  const handleCommit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!branch || !unit) {
      setError("No branch or unit selected.");
      return;
    }

    setError(null);
    setStatus("committing");

    try {
      const response = await api.post("/pushUnit", { branch, unit });
      if (response.error) {
        setError(response.error);
        setStatus(undefined);
      } else {
        setStatus("committed");
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus(undefined);
    }
  }

  const renderContent = () => {
    if (descriptionsState === "loading") {
      return <div>Loading...</div>;
    }

    if (status === "committed") {
      return (
        <>
          <div className="commit-ui-top-content">
            <div className="success">Commit successful!</div>
          </div>
          <div className="commit-ui-bottom-buttons">
            <button onClick={onClose}>Close</button>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="commit-ui-top-content">
          <div className="commit-ui-description">
            <div>
              The following updated files will be committed to the <strong>{unit}</strong> unit
              in the <strong>{branch}</strong> branch:
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {descriptions.map(({path, description, date}) => (
                  <tr key={path}>
                    <td>{description}</td>
                    <td>{date}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div>
              Once the commit is complete the updates will be cleared from the authoring environment and the
              updates will be able to be merged into the main branch via a pull request on GitHub.
            </div>

            <div>
              Click &quot;Commit Updates&quot; to proceed.
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {status === "committing" && <div className="progress">Committing...</div>}
        </div>

        <div className="commit-ui-bottom-buttons">
          <button className="primary" onClick={handleCommit} disabled={status === "committing"}>
            Commit Updates
          </button>
          <button onClick={onClose} disabled={status === "committing"}>Cancel</button>
        </div>
      </>
    );
  };

  return (
    <Modal onClose={onClose} title="Commit">
      <div className="commit-ui-content">
        {renderContent()}
      </div>
    </Modal>
  );
};

export default CommitUI;
