import React, { useMemo } from "react";

import Modal from "./modal";
import { useCurriculum } from "../hooks/use-curriculum";
import { ApiResponse, useAuthoringApi } from "../hooks/use-authoring-api";
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

  const updates = useMemo<Record<string, number>>(() => {
    if (!branch || !unit) {
      return {};
    }
    return branchMetadata[branch]?.units[unit]?.updates ?? {};
  }, [branch, unit, branchMetadata]);

  const renderError = (message: string) => {
    return (
      <>
        <div className="error">{message}</div>
        <div className="commit-ui-bottom-buttons">
          <button onClick={onClose}>Close</button>
        </div>
      </>
    );
  };

  const renderContent = () => {
    if (error) {
      return renderError(error);
    }

    if (!branch || !unit) {
      return renderError("No branch or unit selected.");
    }

    if (!auth.gitHubToken) {
      return renderError("You must be signed in to commit changes.");
    }

    if (Object.keys(updates).length === 0) {
      return renderError("No updates to commit.");
    }

    if (descriptionsState === "loading") {
      return <div>Loading...</div>;
    }

    return (
      <>
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
        <div className="commit-ui-bottom-buttons">
          <button
            className="primary"
            onClick={async () => {
              setError(null);
              try {
                const response: ApiResponse = await api.post("/pushUnit", {
                  branch,
                  unit
                });
                if (response.error) {
                  setError(response.error);
                } else {
                  onClose();
                }
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Commit Updates
          </button>
          <button onClick={onClose}>Cancel</button>
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
