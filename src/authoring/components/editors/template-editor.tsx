import React, { useCallback, useState } from "react";
import { IframeControl } from "./iframe-control";
import { ITemplateContent } from "../../types";

interface IProps {
  value?: ITemplateContent;
  onChange: (value: ITemplateContent) => void;
}

// Edits an inline template ({ tiles }) with the same doc-editor used for section content. Unlike the
// file-based content editor in the workspace, changes are saved back into the unit/teacher-guide config
// slice by the caller's onChange (via setUnitConfig / setTeacherGuideConfig). Document templates are
// pre-seeded with a section divider + placeholder per section when enabled, so authors just fill each section.
export const TemplateEditor: React.FC<IProps> = ({ value, onChange }) => {
  const content = value?.tiles ? value : { tiles: [] };
  const [parseError, setParseError] = useState<string | undefined>();

  const handleChange = useCallback((updated: string) => {
    try {
      onChange(JSON.parse(updated));
      setParseError(undefined);
    } catch (e) {
      // Template edits are precious and low-frequency, so surface the failure instead of silently dropping it.
      const message = e instanceof Error ? e.message : String(e);
      console.error("Error parsing template content as JSON:", e);
      setParseError(`This edit was not saved — the template content is not valid JSON: ${message}`);
    }
  }, [onChange]);

  return (
    <>
      {parseError && <div className="form-error" role="alert">{parseError}</div>}
      <IframeControl
        initialValue={content}
        rawContent={content}
        onChange={handleChange}
        onRawChange={handleChange}
      />
    </>
  );
};
