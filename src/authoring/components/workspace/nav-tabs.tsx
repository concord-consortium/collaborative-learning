import React, { useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { AuthorableNavTab, INavTabSpec } from "../../types";
import { EAuthorableNavTab } from "../../../models/view/nav-tabs";
import { useCurriculum } from "../../hooks/use-curriculum";

interface FormTab {
  tab: AuthorableNavTab;
  defaultLabel: string;
  customLabel: string;
  teacherOnly: boolean;
  show: boolean;
}

interface INavTabsInputs {
  tabs: FormTab[];
}

export const allNavTabs: AuthorableNavTab[] = Object.values(EAuthorableNavTab);
const defaultTabLabels: Record<AuthorableNavTab, string> = {
  problems: "Problems",
  "teacher-guide": "Teacher Guide",
  "student-work": "Student Work",
  "my-work": "My Work",
  "class-work": "Class Work",
  "sort-work": "Sort Work",
};

const NavTabs: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const usedTabs = useMemo(() => {
    return unitConfig?.config.navTabs.tabSpecs.map(t => t.tab);
  }, [unitConfig]);

  // returns allNavTabs sorted so that tabs used in the current configuration appear first,
  // in the order they appear in the configuration followed by any unused tabs in their default order
  const sortedAllNavTabs = useMemo(() => {
    return [...allNavTabs].sort((a, b) => {
      const indexA = usedTabs?.indexOf(a) ?? -1;
      const indexB = usedTabs?.indexOf(b) ?? -1;
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [usedTabs]);

  // build the data for the form, in the order determined above
  const formTabs: FormTab[] = useMemo(() => {
    return sortedAllNavTabs.map(tab => {
      const found = unitConfig?.config.navTabs.tabSpecs.find(t => t.tab === tab);
      const defaultLabel = defaultTabLabels[tab];
      return {
        tab,
        defaultLabel,
        customLabel: found && found.label !== defaultLabel ? found.label : "",
        teacherOnly: found ? !!found.teacherOnly : false,
        show: found ? !found.hidden : false,
      };
    });
  }, [sortedAllNavTabs, unitConfig]);

  const { handleSubmit, register, formState: { errors } } = useForm<INavTabsInputs>();

  const onSubmit: SubmitHandler<INavTabsInputs> = (data) => {
    setUnitConfig(draft => {
      if (draft) {
        formTabs.forEach((tab, index) => {
          const formTab = data.tabs[index];
          const customLabel = formTab.customLabel.trim();
          const existingIndex = draft.config.navTabs.tabSpecs.findIndex(t => t.tab === tab.tab);
          const newTabSpec: INavTabSpec = {
            tab: tab.tab,
            label: customLabel !== "" ? customLabel : tab.defaultLabel,
            teacherOnly: formTab.teacherOnly,
            hidden: !formTab.show
          };
          if (existingIndex !== -1) {
            const tabSpec = draft.config.navTabs.tabSpecs[existingIndex];
            tabSpec.tab = newTabSpec.tab;
            tabSpec.label = newTabSpec.label;
            tabSpec.teacherOnly = newTabSpec.teacherOnly;
            tabSpec.hidden = newTabSpec.hidden;
          } else {
            draft.config.navTabs.tabSpecs.push(newTabSpec);
          }
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <table>
        <thead>
          <tr>
            <th>Teacher Only</th>
            <th>Show</th>
            <th>Default Label</th>
            <th>Custom Label</th>
          </tr>
        </thead>
        <tbody>
          {formTabs.map((formTab, index) => (
            <React.Fragment key={formTab.tab}>
              <tr>
                <td>
                  <input
                    type="checkbox"
                    {...register(`tabs.${index}.teacherOnly`)}
                    defaultChecked={formTab.teacherOnly}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    {...register(`tabs.${index}.show`)}
                    defaultChecked={formTab.show}
                  />
                </td>
                <td className="left">
                  {formTab.defaultLabel}
                </td>
                <td className="wide">
                  <input
                    type="text"
                    {...register(`tabs.${index}.customLabel`)}
                    defaultValue={formTab.customLabel}
                  />
                </td>
              </tr>
              {errors.tabs?.[index]?.customLabel && (
                <tr><td colSpan={3}></td><td>{errors.tabs?.[index]?.customLabel?.message}</td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );
};

export default NavTabs;
