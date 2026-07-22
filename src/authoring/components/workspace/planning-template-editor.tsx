import React, { useState } from "react";
import { useCurriculum } from "../../hooks/use-curriculum";
import { TemplateEditor } from "../editors/template-editor";
import { ITemplateContent } from "../../types";

interface IProps {
  // The planning template map ({ [sectionType]: { tiles } }) for the scope being edited (unit or problem).
  planningTemplate?: Record<string, ITemplateContent>;
  onChange: (sectionType: string, content: ITemplateContent) => void;
}

// Lets the author pick a planning section and edit that section's template with the shared doc-editor.
// The planning sections are defined at the unit level (unitConfig.planningDocument); only the content
// location (unit vs problem config) differs, which the caller supplies via `planningTemplate` + `onChange`.
const PlanningTemplateEditor: React.FC<IProps> = ({ planningTemplate, onChange }) => {
  const { unitConfig } = useCurriculum();
  const planningSections = unitConfig?.planningDocument?.sections ?? [];
  const sectionInfo = unitConfig?.planningDocument?.sectionInfo ?? {};
  const sectionTypes = planningSections.map(s => s.type);
  const [selected, setSelected] = useState<string | undefined>(sectionTypes[0]);

  if (sectionTypes.length === 0) {
    return <div className="centered muted">This unit has no planning sections defined.</div>;
  }

  const current = selected && sectionTypes.includes(selected) ? selected : sectionTypes[0];
  const value = planningTemplate?.[current];

  return (
    <div className="planning-template-editor">
      <div className="section-selector">
        {sectionTypes.map(type => (
          <button
            key={type}
            type="button"
            className={type === current ? "active" : ""}
            onClick={() => setSelected(type)}
          >
            {sectionInfo[type]?.title ?? type}
          </button>
        ))}
      </div>
      {/* key forces the iframe to reload with the selected section's content */}
      <TemplateEditor key={current} value={value} onChange={(v) => onChange(current, v)} />
    </div>
  );
};

export default PlanningTemplateEditor;
