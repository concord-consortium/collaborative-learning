
import React, { useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { IWorkspaceConfigComponentProps } from "./common";
import { INavTabSection } from "src/authoring/types";

interface ICurriculumTabFormInputs {
  tabLabel: string;
  sections: INavTabSection[];
}

const CurriculumTabs: React.FC<IWorkspaceConfigComponentProps> = ({ unitConfig, setUnitConfig }) => {
  const problemTabIndex = useMemo(() => {
    return unitConfig.config.navTabs.tabSpecs.findIndex(t => t.tab === "problems") ?? -1;
  }, [unitConfig]);
  const problemTab = useMemo(() => {
    return problemTabIndex >= 0 ? unitConfig.config.navTabs.tabSpecs[problemTabIndex] : undefined;
  }, [unitConfig, problemTabIndex]);

  const { handleSubmit, register, formState: { errors } } = useForm<ICurriculumTabFormInputs>();

  const onSubmit: SubmitHandler<ICurriculumTabFormInputs> = (data) => {
    setUnitConfig(draft => {
      if (draft && problemTabIndex >= 0) {
        draft.config.navTabs.tabSpecs[problemTabIndex].label = data.tabLabel;
        draft.config.navTabs.tabSpecs[problemTabIndex].sections = data.sections;
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="tabLabel">Curriculum Tab Label</label>
        <input
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
            {...register(`sections.${index}.title`, { required: "Section title is required" })}
            defaultValue={section.title}
          />
          {errors.sections?.[index]?.title && <span>{errors.sections?.[index]?.title?.message}</span>}
        </div>
      ))}
      <div className="bottomButtons">
        <button type="submit">Update</button>
      </div>
    </form>
  );
};

export default CurriculumTabs;
