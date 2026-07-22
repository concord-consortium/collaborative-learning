import React, { useState } from "react";
import { useCurriculum } from "../../hooks/use-curriculum";
import { TemplateEditor } from "../editors/template-editor";
import { ITemplateContent } from "../../types";

// The planning template is a per-planning-section map ({ [sectionType]: { tiles } }). This page lets the
// author pick a planning section and edit that section's template with the shared doc-editor, saving back
// into config.planningTemplate[sectionType].
const PlanningTemplateEditor: React.FC = () => {
  const { unitConfig, setUnitConfig } = useCurriculum();
  const planningSections = unitConfig?.planningDocument?.sections ?? [];
  const sectionInfo = unitConfig?.planningDocument?.sectionInfo ?? {};
  const sectionTypes = planningSections.map(s => s.type);
  const [selected, setSelected] = useState<string | undefined>(sectionTypes[0]);

  if (sectionTypes.length === 0) {
    return <div className="centered muted">This unit has no planning sections defined.</div>;
  }

  const current = selected && sectionTypes.includes(selected) ? selected : sectionTypes[0];
  const value = (unitConfig?.config?.planningTemplate as any)?.[current] as ITemplateContent | undefined;

  const handleChange = (v: ITemplateContent) => {
    setUnitConfig(draft => {
      if (!draft) return;
      if (!draft.config.planningTemplate) draft.config.planningTemplate = {};
      (draft.config.planningTemplate as any)[current] = v;
    });
  };

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
      <TemplateEditor key={current} value={value} onChange={handleChange} />
    </div>
  );
};

export default PlanningTemplateEditor;
