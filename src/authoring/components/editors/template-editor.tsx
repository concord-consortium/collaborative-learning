import React, { useCallback } from "react";
import { IframeControl } from "./iframe-control";
import { ITemplateContent } from "../../types";

interface IProps {
  value?: ITemplateContent;
  onChange: (value: ITemplateContent) => void;
}

// Edits an inline template ({ tiles }) with the same doc-editor used for section content. Unlike the
// file-based content editor in the workspace, changes are saved back into the unit/teacher-guide config
// slice by the caller's onChange (via setUnitConfig / setTeacherGuideConfig). Document templates are
// pre-seeded with a section divider per unit section when enabled, so authors just fill each section.
export const TemplateEditor: React.FC<IProps> = ({ value, onChange }) => {
  const content = value?.tiles ? value : { tiles: [] };

  const handleChange = useCallback((updated: string) => {
    try {
      onChange(JSON.parse(updated));
    } catch (e) {
      console.error("Error parsing template content as JSON:", e);
    }
  }, [onChange]);

  return (
    <IframeControl
      initialValue={content as any}
      rawContent={content as any}
      onChange={handleChange}
      onRawChange={handleChange}
    />
  );
};
