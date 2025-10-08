import React, { useEffect, useMemo } from "react";

import Modal from "./modal";
import { defaultPath, useCurriculum } from "../hooks/use-curriculum";

import { ApiResponse, useAuthoringApi } from "../hooks/use-authoring-api";

import "./admin.scss";

type ActionStatus = {
  status?: "in-progress" | "error" | "done";
}

type AdminBranchAction = {
  kind: "pull-latest" | "reset" | "delete";
  branch: string;
  unit: string;
}
type AdminAction = (AdminBranchAction | {kind: "pull-new"}) & ActionStatus;
interface IProps {
  onClose: () => void;
}

const Admin: React.FC<IProps> = ({ onClose }) => {
  const { get, post } = useAuthoringApi();
  const {branchMetadata} = useCurriculum();
  const [branches, setBranches] = React.useState<string[]>([]);
  const [units, setUnits] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<AdminAction | null>(null);
  const [newBranch, setNewBranch] = React.useState<string | null>(null);
  const [newUnit, setNewUnit] = React.useState<string | null>(null);

  const title = useMemo(() => {
    if (action) {
      const niceName = action.kind
        .replace(/-/g, " ")
        .split(" ")
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
      return `Admin: ${niceName}`;
    }
    return "Admin";
  }, [action]);

  useEffect(() => {
    get("/getRemoteBranches").then((response) => {
      if (response.success) {
        setBranches(response.branches);
      } else {
        setError(response.error ?? "Error fetching remote branches");
        setBranches([]);
      }
    });
  }, [get]);

  useEffect(() => {
    if (newBranch) {
      get("/getRemoteUnits", {branch: newBranch}).then((response) => {
        if (response.success) {
          const alreadyPulledUnits = Object.keys(branchMetadata[newBranch]?.units || {});
          const availableUnits = response.units.filter((u: string) => !alreadyPulledUnits.includes(u));
          setUnits(availableUnits);
        } else {
          setError(response.error ?? "Error fetching remote units");
        }
      });
    } else {
      setUnits([]);
      setNewUnit(null);
    }
  }, [get, newBranch, branchMetadata]);

  const pulledUnits = useMemo(() => {
    const result: {branch: string; unit: string; pulledAt: number}[] = [];
    Object.keys(branchMetadata).forEach((b) => {
      Object.keys(branchMetadata[b].units).forEach((u) => {
        result.push({branch: b, unit: u, pulledAt: branchMetadata[b].units[u].pulledAt});
      });
    });
    return result;
  }, [branchMetadata]);

  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>, branch: string, unit: string) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.hash = `/${encodeURIComponent(branch)}/${encodeURIComponent(unit)}/${defaultPath}`;
    window.open(url.toString(), "_blank"); // open in a new tab
  };

  const handleAction = (e: React.MouseEvent<HTMLButtonElement>, newAction: AdminAction) => {
    e.preventDefault();
    setAction(newAction);
  };

  const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setAction(null);
    setError(null);
  };

  const renderConfirm = (onConfirm: () => Promise<ApiResponse>, options?: {dangerous?: boolean}) => {
    const dangerous = options?.dangerous ?? false;
    const disabled = action?.status === "in-progress";

    const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (dangerous) {
        if (!confirm("Are you REALLY sure you want to proceed? This action cannot be undone.")) {
          return;
        }
      }
      setError(null);
      setAction(prev => prev ? {...prev, status: "in-progress"} : prev);
      const response = await onConfirm();
      setAction(prev => prev ? {...prev, status: response.success ? "done" : "error"} : prev);
      if (!response.success) {
        setError(response.error ?? "Error performing action");
      }
    };

    return (
      <div className="admin-action-buttons">
        <button
          className={dangerous ? "danger" : ""}
          disabled={disabled}
          onClick={handleConfirm}>
          {dangerous ? "Yes, I'm sure" : "Ok"}
        </button>
        <button
          disabled={disabled}
          onClick={handleCancel}>
          {action?.status ? "Close" : "Cancel"}
        </button>
      </div>
    );
  };

  const renderStatus = () => {
    if (action?.status === "in-progress") {
      return <div className="progress">In progress...</div>;
    }
    if (action?.status === "done") {
      return <div className="success">Completed successfully.</div>;
    }
    return null;
  };

  const renderPullLatest = (branch: string, unit: string) => {
    return (
      <div className="admin-action">
        <div className="label">Pull latest for {branch}/{unit}</div>
        <div>
          This will fetch the latest changes from the remote repository for
          the <strong>{unit}</strong> unit on the <strong>{branch}</strong> branch.
        </div>
        <div>
          This is useful if there have been updates made to the unit in the remote
          repository outside the authoring environment.
        </div>
        <div>
          This is a safe action. Any edits made to this unit will be <strong>not be overwritten</strong>.
          However any files that have been edited in both the authoring environment and
          the remote repository will be overwritten with the edited version when the commit
          is done in the authoring environment.
        </div>

        {renderStatus()}

        {renderConfirm(async () => await post("/pullUnit", {branch, unit}))}
      </div>
    );
  };

  const renderReset = (branch: string, unit: string) => {
    return (
      <div className="admin-action">
        <div className="label">Reset {branch}/{unit}</div>
        <div>
          This will fetch the latest changes from the remote repository for the <strong>{unit}</strong> unit
          on the <strong>{branch}</strong> branch <strong>AND</strong> it will reset any edits made to this
          unit in the authoring environment.
        </div>
        <div>
          This is a <strong className="danger">dangerous</strong> action. Any edits made to this unit
          will be <strong className="danger">lost</strong>.
        </div>

        {renderStatus()}

        {renderConfirm(async () => await post("/pullUnit", {branch, unit, reset: "true"}), {dangerous: true})}
      </div>
    );
  };

  const renderDelete = (branch: string, unit: string) => {
    return (
      <div className="admin-action">
        <div className="label">Delete {branch}/{unit}</div>
        <div>
          This will delete all data about the <strong>{unit}</strong> unit on the <strong>{branch}</strong> branch
          from the authoring environment.
        </div>
        <div>
          This does <strong>NOT</strong> delete the unit from the remote repository, it only deletes it from
          the authoring environment.
        </div>
        <div>
          This is a <strong className="danger">dangerous</strong> action. Any edits made to this unit will
          be <strong className="danger">lost</strong> and this unit will need to be pulled again to be edited.
        </div>

        {renderStatus()}

        {renderConfirm(async () => await post("/deleteUnit", {branch, unit}), {dangerous: true})}
      </div>
    );
  };

  const renderPullNew = () => {
    return (
      <div className="admin-action">
        <div className="label">Pull New Unit</div>
        <div>
          This will fetch a selected unit on a branch from the remote repository.
          This is required before a unit can be edited in the authoring environment.
        </div>
        <div>
          This is a safe action. You cannot select a branch/unit combo that has already been pulled.
        </div>

        {branches.length === 0 && (
          <div>Loading branches ...</div>
        )}

        {branches.length > 0 && (
          <div>
            <label htmlFor="branch-select">Select a branch:</label>
            <select id="branch-select" defaultValue="" onChange={(e) => setNewBranch(e.target.value)}>
              <option value="" disabled>Please select a branch ...</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}

        {newBranch && units.length === 0 && (
          <div>Loading units ...</div>
        )}

        {newBranch && units.length > 0 && (
          <div>
            <label htmlFor="unit-select">Select a unit:</label>
            <select id="unit-select" defaultValue="" onChange={(e) => setNewUnit(e.target.value)}>
              <option value="" disabled>Please select a unit ...</option>
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        )}

        {renderStatus()}

        {newBranch && newUnit && renderConfirm(async () => await post("/pullUnit", {branch: newBranch, unit: newUnit}))}
      </div>
    );
  };

  const renderContent = () => {
    return (
      <>
        <div>
          {error && <div className="error">Error: {error}</div>}
          <div className="admin-section">
            {action?.kind === "pull-latest" && renderPullLatest(action.branch, action.unit)}
            {action?.kind === "reset" && renderReset(action.branch, action.unit)}
            {action?.kind === "delete" && renderDelete(action.branch, action.unit)}
            {action?.kind === "pull-new" && renderPullNew()}
            {!action && (
              <>
                <div className="label">Pulled Units</div>
                {pulledUnits.length === 0 ? (
                  <div>No pulled units</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>Unit</th>
                        <th>Pulled</th>
                        <th>Updates</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pulledUnits.map(({branch, unit, pulledAt}) => {
                        const numUpdates = Object.keys(branchMetadata[branch]?.units[unit]?.updates ?? {}).length;
                        return (
                          <tr key={`${branch}/${unit}`}>
                            <td>{branch}</td>
                            <td>{unit}</td>
                            <td>{new Date(pulledAt).toLocaleString()}</td>
                            <td>{numUpdates}</td>
                            <td className="table-buttons">
                              <button onClick={(e) => handleEdit(e, branch, unit)}>
                                Edit
                              </button>
                              <button onClick={(e) => handleAction(e, {kind: "pull-latest", branch, unit})}>
                                Pull Latest
                              </button>
                              <button onClick={(e) => handleAction(e, {kind: "reset", branch, unit})}>
                                Reset
                              </button>
                              <button onClick={(e) => handleAction(e, {kind: "delete", branch, unit})}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
        {!action && (
          <div className="admin-bottom-buttons">
            <button onClick={() => setAction({kind: "pull-new"})}>Pull New Branch/Unit</button>
          </div>
        )}
      </>
    );
  };

  return (
    <Modal onClose={onClose} title={title}>
      <div className="admin-content">
        {renderContent()}
      </div>
    </Modal>
  );
};

export default Admin;
