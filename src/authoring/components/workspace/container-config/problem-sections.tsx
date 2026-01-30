import React from "react";
import { Control, FieldErrors, useFieldArray, useWatch } from "react-hook-form";
import { IProblemFormInputs } from "./container-config-types";
import { ISection } from "../../../types";

interface ProblemSectionsProps {
  availableSections: Record<string, ISection>;
  control: Control<IProblemFormInputs>;
  errors: FieldErrors<IProblemFormInputs>;
}

export const ProblemSections: React.FC<ProblemSectionsProps> = ({
  availableSections,
  control,
  errors,
}) => {
  const sectionsFieldArray = useFieldArray({
    control,
    name: "sections",
  });

  const watchedSections = useWatch({ control, name: "sections" });

  return (
    <div className="problemSections">
      <div className="sectionLabel">Problem Sections</div>
      {Object.keys(availableSections).length === 0 && (
        <div className="noSectionsMessage">
          No section types defined. Add section types on the Curriculum Tabs page.
        </div>
      )}
      <table className="problemSectionsTable">
        <thead>
          <tr>
            <th>Enabled</th>
            <th>Order</th>
            <th>Section</th>
          </tr>
        </thead>
        <tbody>
          {sectionsFieldArray.fields.map((field, index) => {
            const sectionDef = availableSections[field.type];
            const isEnabled = watchedSections?.[index]?.enabled ?? false;
            const isFirst = index === 0;
            const isLast = index === sectionsFieldArray.fields.length - 1;

            return (
              <tr key={field.id} className={isEnabled ? "enabled" : "disabled"}>
                <td className="checkboxColumn">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {
                      sectionsFieldArray.update(index, {
                        ...watchedSections[index],
                        enabled: !isEnabled,
                      });
                    }}
                  />
                </td>
                <td className="reorderColumn">
                  <button
                    type="button"
                    onClick={() => {
                      if (index > 0) sectionsFieldArray.swap(index, index - 1);
                    }}
                    disabled={!isEnabled || isFirst}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index < sectionsFieldArray.fields.length - 1) {
                        sectionsFieldArray.swap(index, index + 1);
                      }
                    }}
                    disabled={!isEnabled || isLast}
                    style={{ marginLeft: 2 }}
                  >
                    ↓
                  </button>
                </td>
                <td className="sectionNameColumn">
                  {sectionDef?.title ?? field.type}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {errors.sections && (
        <span className="form-error">
          {typeof errors.sections.message === "string"
            ? errors.sections.message
            : "Invalid sections configuration"}
        </span>
      )}
    </div>
  );
};
