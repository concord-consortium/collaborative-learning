
import React, { useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { useCurriculum } from "../../hooks/use-curriculum";

interface ICurriculumTabFormInputs {
  tabLabel: string;
  sections: Record<string, { title: string; initials: string }>;
}

const CurriculumTabs: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const problemTabIndex = useMemo(() => {
    return unitConfig?.config.navTabs.tabSpecs.findIndex(t => t.tab === "problems") ?? -1;
  }, [unitConfig]);
  const problemTab = useMemo(() => {
    return problemTabIndex >= 0 ? unitConfig?.config.navTabs.tabSpecs[problemTabIndex] : undefined;
  }, [unitConfig, problemTabIndex]);

  const { handleSubmit, register, formState: { errors } } = useForm<ICurriculumTabFormInputs>();

  const onSubmit: SubmitHandler<ICurriculumTabFormInputs> = (data) => {
    setUnitConfig(draft => {
      if (draft) {
        if (problemTabIndex >= 0) {
          const tabSpec = draft.config.navTabs.tabSpecs[problemTabIndex];
          tabSpec.label = data.tabLabel;

          // Remove tabSpec.sections from tabSpec as they are no longer used in runtime
          if (tabSpec.sections) {
            delete tabSpec.sections;
          }
        }

        Object.entries(data.sections).forEach(([type, {title, initials}]) => {
          const section = draft.sections[type];
          if (section) {
            section.title = title;
            section.initials = initials;
          }
        });
      }
    });
  };

  const sectionEntries = Object.entries(unitConfig?.sections || {});

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="tabLabel">Curriculum Tab Label</label>
        <input
          type="text"
          id="tabLabel"
          defaultValue={problemTab?.label}
          {...register("tabLabel", { required: "Tab label is required" })}
        />
        {errors.tabLabel && <span>{errors.tabLabel.message}</span>}
      </div>
      <div className="sectionLabel">Curriculum Tab Subtab Labels</div>
      {sectionEntries.map(([sectionType, section]) => (
        <div key={sectionType} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input
            type="text"
            style={{ width: 80 }}
            placeholder="Abbrev"
            aria-label={`Abbreviation for ${section.title || sectionType} section`}
            {...register(`sections.${sectionType}.initials`, { required: "Abbreviation is required" })}
            defaultValue={section.initials}
          />
          {errors.sections?.[sectionType]?.initials && (
            <span>{errors.sections?.[sectionType]?.initials?.message}</span>
          )}
          <input
            type="text"
            style={{ flex: 1 }}
            aria-label={`Title for ${sectionType} section`}
            {...register(`sections.${sectionType}.title`, { required: "Section title is required" })}
            defaultValue={section.title}
          />
          {errors.sections?.[sectionType]?.title && <span>{errors.sections?.[sectionType]?.title?.message}</span>}
        </div>
      ))}
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );
};

export default CurriculumTabs;
