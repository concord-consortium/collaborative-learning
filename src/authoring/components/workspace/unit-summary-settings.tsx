import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurriculum } from "../../hooks/use-curriculum";
import { useAuthoringApi } from "../../hooks/use-authoring-api";
import {
  IUnitSummary, IUnitSummaryStatusResponse, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION, UnitSummaryValidationResult,
  validateUnitSummary
} from "../../../../shared/unit-summary-types";
import "./unit-summary-settings.scss";

// One editable row, joining a saved entry's own fields with its title (which lives on
// sourceManifest, not on the entry itself) so the table has everything it needs to render.
interface EntryFormRow {
  ordinal: string;
  title: string;
  problemDigest: string;
  priorKnowledge: string;
}

// The local, unsaved editing state. generatedAt/sourceHash/sourceManifest are carried through
// unedited (the author edits text, never these) so Save can rebuild a complete IUnitSummary.
interface SummaryFormState {
  generatedAt: string;
  sourceHash: string;
  sourceManifest: IUnitSummary["sourceManifest"];
  overview: string;
  rows: EntryFormRow[];
}

function summaryToFormState(summary: IUnitSummary): SummaryFormState {
  return {
    generatedAt: summary.generatedAt,
    sourceHash: summary.sourceHash,
    sourceManifest: summary.sourceManifest,
    overview: summary.overview,
    rows: summary.entries.map((entry, i) => ({
      ordinal: entry.ordinal,
      title: summary.sourceManifest[i]?.title ?? entry.ordinal,
      problemDigest: entry.problemDigest,
      priorKnowledge: entry.priorKnowledge,
    })),
  };
}

function formStateToSummary(form: SummaryFormState): IUnitSummary {
  return {
    generatedAt: form.generatedAt,
    sourceHash: form.sourceHash,
    sourceManifest: form.sourceManifest,
    overview: form.overview,
    entries: form.rows.map(row => ({
      ordinal: row.ordinal,
      priorKnowledge: row.priorKnowledge,
      problemDigest: row.problemDigest,
    })),
  };
}

function formStatesEqual(a: SummaryFormState | undefined, b: SummaryFormState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

interface StalenessInfo {
  stale: boolean;
  // Ordinals whose Markdown content changed (same position, same ordinal, same title -- only the
  // hash differs).
  contentChanged: string[];
  // Human-readable notes about structural changes: a moved/renamed ordinal, or a problem count
  // change. Deliberately a plain index-by-index comparison, not a smart diff.
  structuralNotes: string[];
}

// Compared against whatever is currently shown -- the saved summary, or a freshly generated but
// not-yet-saved one -- not always the saved summary specifically. A result that just came back
// from generation carries its own sourceHash/sourceManifest from the moment it was assembled, and
// the live curriculum can have moved again by the time the panel re-checks status afterward.
function computeStaleness(
  current: { sourceHash: string; sourceManifest: IUnitSummary["sourceManifest"] } | undefined,
  live: IUnitSummaryStatusResponse | undefined
): StalenessInfo {
  if (!current || !live) {
    return { stale: false, contentChanged: [], structuralNotes: [] };
  }
  const savedManifest = current.sourceManifest;
  const liveManifest = live.sourceManifest;
  const contentChanged: string[] = [];
  const structuralNotes: string[] = [];

  if (savedManifest.length !== liveManifest.length) {
    structuralNotes.push(
      `the unit now has ${liveManifest.length} problem${liveManifest.length === 1 ? "" : "s"} ` +
      `(the summary was generated for ${savedManifest.length})`
    );
  }

  const sharedLength = Math.min(savedManifest.length, liveManifest.length);
  for (let i = 0; i < sharedLength; i++) {
    const savedEntry = savedManifest[i];
    const liveEntry = liveManifest[i];
    if (savedEntry.ordinal !== liveEntry.ordinal || savedEntry.title !== liveEntry.title) {
      structuralNotes.push(`problem ${savedEntry.ordinal} (${savedEntry.title}) moved or was renamed`);
    } else if (savedEntry.problemHash !== liveEntry.problemHash) {
      contentChanged.push(savedEntry.ordinal);
    }
  }

  const stale = current.sourceHash !== live.sourceHash || contentChanged.length > 0 || structuralNotes.length > 0;
  return { stale, contentChanged, structuralNotes };
}

const UnitSummarySettings: React.FC = () => {
  const { unitConfig, unitConfigLoading, setUnitConfig, saveState, branch, unit } = useCurriculum();
  const api = useAuthoringApi();

  const savedSummary = unitConfig?.config?.aiUnitSummary;
  const savedFormState = useMemo(
    () => savedSummary ? summaryToFormState(savedSummary) : undefined,
    [savedSummary]
  );

  const [formState, setFormState] = useState<SummaryFormState | undefined>(undefined);
  const formStateRef = useRef(formState);
  useEffect(() => { formStateRef.current = formState; }, [formState]);

  const [liveStatus, setLiveStatus] = useState<IUnitSummaryStatusResponse | undefined>(undefined);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | undefined>(undefined);
  const [saveValidation, setSaveValidation] = useState<UnitSummaryValidationResult | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | undefined>(undefined);

  const branchUnitRef = useRef({ branch, unit });
  useEffect(() => { branchUnitRef.current = { branch, unit }; }, [branch, unit]);

  const fetchStatus = useCallback(async () => {
    if (!branch || !unit) return;
    try {
      const response = await api.get("/unitSummaryStatus", { branch, unit });
      if (branchUnitRef.current.branch !== branch || branchUnitRef.current.unit !== unit) return;
      if (response.success) {
        setLiveStatus(response as unknown as IUnitSummaryStatusResponse);
        setStatusError(undefined);
      } else {
        setStatusError(response.error);
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : String(err));
    }
  }, [api, branch, unit]);

  // Load on mount and on navigation. Clears formState unconditionally -- useCurriculum keeps the
  // previous unit's config in place while the new one loads, so a stale or unsaved summary could
  // otherwise sit on screen, savable into the new unit, until (or unless) the real config arrives.
  // Also keeps Save from enabling early if the status fetch below beats the config fetch.
  useEffect(() => {
    setFormState(undefined);
    setLiveStatus(undefined);
    setGenerationError(undefined);
    setSaveValidation(undefined);
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, unit]);

  // Loads the form once unitConfig is confirmed to belong to the current unit. Keying on
  // unitConfigLoading (not just savedSummary changing) matters on a fresh mount already pointed at
  // the new unit, since unitConfig lags and two units with no summary look identical. Once loaded,
  // only savedSummary's own reference moving resyncs, so an unrelated save (Immer leaves
  // aiUnitSummary untouched) doesn't reset in-progress edits.
  useEffect(() => {
    if (unitConfigLoading) return;
    setFormState(savedSummary ? summaryToFormState(savedSummary) : undefined);
  }, [savedSummary, unitConfigLoading]);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimeoutRef.current);
  }, []);

  const liveOrdinals = useMemo(() => liveStatus?.sourceManifest.map(p => p.ordinal) ?? [], [liveStatus]);
  const staleness = useMemo(() => computeStaleness(formState, liveStatus), [formState, liveStatus]);
  const hasUnsavedEdits = !formStatesEqual(formState, savedFormState);

  const handleGenerate = async () => {
    if (!branch || !unit || unitConfigLoading) return;
    if (hasUnsavedEdits && !window.confirm(
      "Generating a new summary will replace your unsaved changes to the current one. Continue?"
    )) {
      return;
    }

    setGenerating(true);
    setGenerationError(undefined);
    const requestedBranch = branch;
    const requestedUnit = unit;
    const formStateAtRequestStart = formStateRef.current;

    try {
      const response = await api.post("/generateUnitSummary", { branch, unit });

      // The author switched unit/branch while this was in flight: never populate the wrong form.
      if (branchUnitRef.current.branch !== requestedBranch || branchUnitRef.current.unit !== requestedUnit) {
        return;
      }

      if (!response.success) {
        setGenerationError(response.error);
        return;
      }

      // The author edited the (unsaved) form while this was in flight: confirm again before
      // replacing those in-progress edits, the same as confirming before the call.
      const editedWhileGenerating = !formStatesEqual(formStateRef.current, formStateAtRequestStart);
      if (editedWhileGenerating && !window.confirm(
        "A new summary is ready, but you've made further changes since starting generation. " +
        "Replace your changes with the new result?"
      )) {
        return;
      }

      const newSummary: IUnitSummary = response.summary;
      setFormState(summaryToFormState(newSummary));
      setSaveValidation(undefined);
      // If the source changed during the request, this shows the result with the badge already
      // lit rather than discarding it.
      fetchStatus();
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!formState) return;
    const candidate = formStateToSummary(formState);
    const validation = validateUnitSummary(candidate, liveOrdinals);
    setSaveValidation(validation);
    if (!validation.valid) return;

    setUnitConfig(draft => {
      if (!draft) return;
      draft.config.aiUnitSummary = candidate;
    });
  };

  const updateOverview = (overview: string) => {
    setFormState(prev => prev ? { ...prev, overview } : prev);
  };

  const updateRow = (index: number, field: "problemDigest" | "priorKnowledge", value: string) => {
    setFormState(prev => {
      if (!prev) return prev;
      const rows = prev.rows.slice();
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, rows };
    });
  };

  const exportText = useMemo(() => {
    if (!formState || !branch || !unit) return "";
    const lines: string[] = [];
    lines.push(`Unit "${unit}" (branch "${branch}")`);
    lines.push("");
    lines.push("Overview:");
    lines.push(formState.overview);
    formState.rows.forEach(row => {
      lines.push("");
      lines.push(`--- Problem ${row.ordinal}: ${row.title} ---`);
      lines.push(`What a student should know before this problem: ${row.priorKnowledge || "(not recorded)"}`);
      lines.push(`What this problem covers: ${row.problemDigest}`);
    });
    lines.push("");
    lines.push("Instruction for the AI configuration (paste alongside the summary above):");
    lines.push(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    return lines.join("\n");
  }, [formState, branch, unit]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      window.prompt("Copy failed. Select the text below and copy it manually.", exportText);
    });
  };

  return (
    // A <form>, not a <div>, to match every sibling settings panel -- this one has no single
    // submit (Generate, Save and Copy are independent actions), so there's no onSubmit handler,
    // but every button below is explicitly type="button" so an empty form is inert either way.
    <form className="unit-summary-settings">
      <h3>Unit Summary</h3>
      <p className="muted">
        An AI-generated, author-reviewed synopsis of this unit, used as compact context by AI
        features instead of the full unit content. Generating replaces this form&apos;s contents
        (not yet saved); Save writes it to the unit like any other curriculum change.
      </p>

      {statusError && <p className="form-error">Could not check whether this summary is up to date: {statusError}</p>}

      {staleness.stale && (
        <div
          className="staleness-badge"
          title="Detected from a hash of each problem's Markdown export. Changes to image files, or
to table rows beyond the summarizer's row cap, are not detected."
        >
          <strong>Possibly stale</strong> — curriculum content or structure has changed since this
          summary was generated.
          <ul>
            {staleness.contentChanged.map(ordinal => (
              <li key={`content-${ordinal}`}>Problem {ordinal}: content changed</li>
            ))}
            {staleness.structuralNotes.map(note => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bottomButtons">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || unitConfigLoading || !branch || !unit}
          aria-busy={generating}
        >
          {generating ? "Generating…" : "Generate Summary"}
        </button>
        {generating && <span className="muted"> Generating — keep this tab open.</span>}
      </div>
      {generationError && <p className="form-error">Generation failed: {generationError}</p>}

      {!formState && !generating && (
        <p className="muted">No summary yet. Click Generate Summary to create one.</p>
      )}

      {formState && (
        <>
          <p className="muted small">Generated {formState.generatedAt}</p>

          <div className="stacked">
            <label htmlFor="unit-summary-overview">Overview</label>
            <textarea
              id="unit-summary-overview"
              rows={3}
              value={formState.overview}
              onChange={e => updateOverview(e.target.value)}
            />
          </div>

          <table className="unit-summary-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Prior knowledge (before this problem)</th>
                <th>This problem</th>
              </tr>
            </thead>
            <tbody>
              {formState.rows.map((row, i) => (
                <tr key={row.ordinal}>
                  <td>{row.ordinal}: {row.title}</td>
                  <td>
                    <textarea
                      aria-label={`Prior knowledge for problem ${row.ordinal}`}
                      rows={3}
                      value={row.priorKnowledge}
                      onChange={e => updateRow(i, "priorKnowledge", e.target.value)}
                    />
                    {i === 0 && !row.priorKnowledge && (
                      <p className="muted small">
                        No unit-level introduction was found to generate this from — author should
                        fill this in.
                      </p>
                    )}
                  </td>
                  <td>
                    <textarea
                      aria-label={`Digest for problem ${row.ordinal}`}
                      rows={3}
                      value={row.problemDigest}
                      onChange={e => updateRow(i, "problemDigest", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {saveValidation && !saveValidation.valid && (
            <div className="form-error">
              <p>This summary cannot be saved:</p>
              <ul>
                {saveValidation.errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <div className="bottomButtons">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving" || liveOrdinals.length === 0}
              aria-busy={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
          </div>

          <details className="export-view">
            <summary>Export for Forever Learning</summary>
            <p className="muted small">
              Copy this block into Forever Learning&apos;s configuration. Applying it there is a
              manual step outside this tool.
            </p>
            <button type="button" onClick={handleCopyExport}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            <pre>{exportText}</pre>
          </details>
        </>
      )}
    </form>
  );
};

export default UnitSummarySettings;
