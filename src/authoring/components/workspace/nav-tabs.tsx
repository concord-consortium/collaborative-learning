import React, { useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { AuthorableNavTab, INavTabSpec, IUnitConfig } from "../../types";
import { EAuthorableNavTab, kUnsupportedFixedStartTabs } from "../../../models/view/nav-tabs";
import { useCurriculum } from "../../hooks/use-curriculum";

interface FormTab {
  tab: AuthorableNavTab;
  defaultLabel: string;
  customLabel: string;
  teacherOnly: boolean;
  show: boolean;
}

interface INavTabsInputs {
  defaultPanelLayout: IUnitConfig["defaultPanelLayout"];
  contentLayout: IUnitConfig["contentLayout"];
  fixedStartView: boolean;
  fixedStartTab: string;
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

  const currentPanelLayout = useMemo(() => {
    return unitConfig?.config?.defaultPanelLayout ?? "split";
  }, [unitConfig]);
  const currentContentLayout = useMemo(() => {
    return unitConfig?.config?.contentLayout ?? "evenLayout";
  }, [unitConfig]);
  const currentFixedStartView = useMemo(() => {
    return unitConfig?.config?.fixedStartView ?? false;
  }, [unitConfig]);
  const currentFixedStartTab = useMemo(() => {
    return unitConfig?.config?.fixedStartTab ?? "";
  }, [unitConfig]);
  // Seed the form from the saved configuration rather than from `defaultValue`/`defaultChecked`,
  // which React only applies when the input mounts. unitConfig loads asynchronously and is reset when
  // the author switches branches, so a form seeded from the DOM keeps showing the previous unit's
  // values; `values` reseeds it whenever the saved configuration changes.
  const formValues: INavTabsInputs = useMemo(() => ({
    defaultPanelLayout: currentPanelLayout,
    contentLayout: currentContentLayout,
    fixedStartView: currentFixedStartView,
    fixedStartTab: currentFixedStartTab,
    tabs: formTabs
  }), [currentPanelLayout, currentContentLayout, currentFixedStartView, currentFixedStartTab, formTabs]);
  const { handleSubmit, register, watch, formState: { errors } } = useForm<INavTabsInputs>({
    values: formValues
  });
  const fixedStartViewOn = watch("fixedStartView");
  const fixedStartTab = watch("fixedStartTab");
  const watchedTabs = watch("tabs");
  // Only tabs that are actually shown for this unit, not teacher-only, and supported as a start tab
  // can be forced, matching resolveStartView's guards. Read the edited values so a tab shown or hidden
  // in this session is offered right away.
  // Not memoized: react-hook-form mutates its values in place, so the array identity does not change
  // when a row is edited.
  const startTabOptions = formTabs.filter((formTab, index) => {
    if (kUnsupportedFixedStartTabs.includes(formTab.tab)) return false;
    const edited = watchedTabs?.[index];
    return (edited?.show ?? formTab.show) && !(edited?.teacherOnly ?? formTab.teacherOnly);
  });
  // A stored start tab that is no longer offered, e.g. the author has since hidden it.
  const staleStartTab = fixedStartTab && !startTabOptions.some(formTab => formTab.tab === fixedStartTab)
    ? formTabs.find(formTab => formTab.tab === fixedStartTab)
    : undefined;
  const layoutHidesStartTab = fixedStartViewOn && watch("defaultPanelLayout") === "workspace-only";
  const describedBy = [
    errors.fixedStartTab && "fixedStartTab-error",
    layoutHidesStartTab && "fixedStartTab-warning"
  ].filter(Boolean).join(" ");

  const onSubmit: SubmitHandler<INavTabsInputs> = (data) => {
    setUnitConfig(draft => {
      if (draft) {
        // Save panel layout (omit if "split" since that's the default)
        if (data.defaultPanelLayout && data.defaultPanelLayout !== "split") {
          draft.config.defaultPanelLayout = data.defaultPanelLayout;
        } else {
          delete draft.config.defaultPanelLayout;
        }
        // Save content layout (omit if "evenLayout" since that's the default)
        if (data.contentLayout && data.contentLayout !== "evenLayout") {
          draft.config.contentLayout = data.contentLayout;
        } else {
          delete draft.config.contentLayout;
        }
        // Fixed start view: omit the switch when off, but keep any chosen fixedStartTab rather than
        // deleting it, so toggling the switch off preserves the author's choice for when they turn it
        // back on. Clearing the select back to "(choose a tab)" with the switch off is the way to drop
        // it entirely, so a wrong choice is not stored forever. (The select is disabled through a JSX
        // prop, not a register option, so it still submits its value.)
        if (data.fixedStartView && data.fixedStartTab) {
          draft.config.fixedStartView = true;
          draft.config.fixedStartTab = data.fixedStartTab;
        } else {
          delete draft.config.fixedStartView;
          if (data.fixedStartTab) {
            draft.config.fixedStartTab = data.fixedStartTab;
          } else {
            delete draft.config.fixedStartTab;
          }
        }
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
      <fieldset>
        <legend>Panel Layout</legend>
        <p className="muted">
          Controls which panels are visible when a student first opens this problem.
        </p>
        <label htmlFor="defaultPanelLayout">Default panel layout</label>
        <select
          id="defaultPanelLayout"
          aria-describedby={layoutHidesStartTab ? "fixedStartTab-warning" : undefined}
          {...register("defaultPanelLayout")}
        >
          <option value="split">Split (resources and workspace)</option>
          <option value="workspace-only">Workspace only</option>
          <option value="resources-only">Resources only</option>
        </select>
        <p className="muted">
          Content layout controls how the split view divides its width. &ldquo;Wide content&rdquo; keeps the
          resources pane at its comments-open width (~1/3) so the workspace stays wide until comments are
          opened.
        </p>
        <label htmlFor="contentLayout">Content layout</label>
        <select id="contentLayout" {...register("contentLayout")}>
          <option value="evenLayout">Even split (50 / 50)</option>
          <option value="wideContent">Wide content (narrow resources)</option>
        </select>
      </fieldset>
      <fieldset>
        <legend>Fixed Start View</legend>
        <p className="muted">
          When on, every user starts on the selected tab (no document open, divider reset) each load,
          as a session-only override; it never overwrites where they left off.
        </p>
        <label>
          <input type="checkbox" {...register("fixedStartView")} />
          {" "}Always start on a fixed tab
        </label>
        <label htmlFor="fixedStartTab">Start tab</label>
        {/* Controlled rather than uncontrolled, because the option list is not stable. On the first
            render unitConfig has not arrived, so there is no matching option for react-hook-form's
            seeded value to select; and showing or hiding a tab rebuilds the options, which would
            leave the DOM select blank while the form still holds the value.
            `disabled` is gated on the SAVED tab rather than the watched one: watching it would
            disable the select the instant the author clears it, blurring their focus mid-edit and
            leaving no way to pick a different tab. */}
        <select
          id="fixedStartTab"
          disabled={!fixedStartViewOn && !currentFixedStartTab}
          value={fixedStartTab ?? ""}
          aria-invalid={!!errors.fixedStartTab}
          aria-describedby={describedBy || undefined}
          {...register("fixedStartTab", {
            validate: (v, values) =>
              !values.fixedStartView ||
              startTabOptions.some(formTab => formTab.tab === v) ||
              "Choose a tab that is shown and not teacher only, or turn the switch off"
          })}
        >
          <option value="">(choose a tab)</option>
          {startTabOptions.map(formTab => (
            <option key={formTab.tab} value={formTab.tab}>{formTab.customLabel || formTab.defaultLabel}</option>
          ))}
          {/* A saved tab that has since been hidden or made teacher only has no option of its own,
              which would leave the select mysteriously blank. Show it, disabled, so the author can
              see what is stored and why it needs changing. */}
          {staleStartTab &&
            <option value={staleStartTab.tab} disabled>
              {staleStartTab.customLabel || staleStartTab.defaultLabel} (not shown)
            </option>}
        </select>
        {errors.fixedStartTab &&
          <p className="form-error" id="fixedStartTab-error" role="alert">{errors.fixedStartTab.message}</p>}
        {/* The live region is mounted unconditionally and only its text is conditional: a region that
            appears together with its content is announced inconsistently across screen readers. */}
        <p className="form-warning" id="fixedStartTab-warning" role="status">
          {layoutHidesStartTab &&
            <>
              &ldquo;Workspace only&rdquo; collapses the resources panel, so the fixed start view is
              ignored. Choose another panel layout for the start tab to have any effect.
            </>}
        </p>
      </fieldset>
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
                  <input type="checkbox" {...register(`tabs.${index}.teacherOnly`)} />
                </td>
                <td>
                  <input type="checkbox" {...register(`tabs.${index}.show`)} />
                </td>
                <td className="left">
                  {formTab.defaultLabel}
                </td>
                <td className="wide">
                  <input type="text" {...register(`tabs.${index}.customLabel`)} />
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
