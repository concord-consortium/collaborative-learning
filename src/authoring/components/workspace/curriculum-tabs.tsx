
import React, { useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { INavTabSection, ISection } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";

interface ICurriculumTabFormInputs {
  tabLabel: string;
  sections: INavTabSection[];
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
      if (draft && problemTabIndex >= 0) {
        const tabSpec = draft.config.navTabs.tabSpecs[problemTabIndex];
        tabSpec.label = data.tabLabel;

        // avoid an O(n²) lookup in the forEach below
        const sectionMap: Record<string, ISection> = {};
        Object.values(draft.sections).forEach(section => {
          sectionMap[section.initials] = section;
        });

        data.sections.forEach(({title}, index) => {
          if (tabSpec.sections && index < tabSpec.sections.length) {
            tabSpec.sections[index].title = title;

            const initials = tabSpec.sections[index].initials;
            if (initials && sectionMap[initials]) {
              sectionMap[initials].title = title;
            }
          }
        });
      }
    });
  };

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
      {(problemTab?.sections ?? []).map((section, index) => (
        <div key={index}>
          <input
            type="text"
            {...register(`sections.${index}.title`, { required: "Section title is required" })}
            defaultValue={section.title}
          />
          {errors.sections?.[index]?.title && <span>{errors.sections?.[index]?.title?.message}</span>}
        </div>
      ))}
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );
};

export default CurriculumTabs;
