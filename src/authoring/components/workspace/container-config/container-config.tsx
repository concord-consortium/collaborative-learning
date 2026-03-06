import React, { useEffect, useMemo, useRef } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { IInvestigation, IProblem, IUnit } from "../../../types";
import { useCurriculum } from "../../../hooks/use-curriculum";
import {
  getCurriculumItem, getUnitItem,
  getProblemBasePath, generateSectionPath,
} from "../../../utils/nav-path";
import { WritableDraft } from "immer";
import { IProblemFormInputs, IUnitParentFormInputs, UnitChild } from "./container-config-types";
import {
  isUnit, isInvestigation, isProblem, buildProblemSectionsFormData, parseItemPath,
} from "./container-config-helpers";
import { UnitItemChildren } from "./unit-item-children";
import { ProblemSections } from "./problem-sections";

interface Props {
  path: string;
}

/**
 * We probably should somehow link the teacher guide structure with the main unit
 * the runtime matches them up by the ordinal. So it looks at the investigation
 * ordinal and the problem ordinal and then tries to find the same thing in the
 * teacher guide.
 *
 * So if we reorder a problem or investigation in the main unit we should re-order
 * the teacher guide to match. Or vice versa.
 */
export const ContainerConfig: React.FC<Props> = ({ path }) => {
  const {
    unitConfig,
    setUnitConfig,
    teacherGuideConfig,
    setTeacherGuideConfig,
    files,
    saveContent,
    saveState
  } = useCurriculum();

  const pathMatch = /^(.*)\/containerConfig$/.exec(path);
  const itemPath = pathMatch?.[1];
  const item = itemPath ? getCurriculumItem(unitConfig, teacherGuideConfig, itemPath) : undefined;

  const { defaultValues, itemType, childType } = useMemo(() => {
    if (!item) {
      return {
        defaultValues: undefined,
        itemType: undefined,
        childType: undefined,
      };
    }

    let _itemType: string | undefined = undefined;
    let _childType: string | undefined = undefined;
    let children: UnitChild[] = [];
    let firstOrdinal: number | undefined = undefined;

    const generateChildrenData = (child: IInvestigation | IProblem, index: number) => {
      if (firstOrdinal === undefined) {
        firstOrdinal = child.ordinal;
      } else if (child.ordinal < firstOrdinal) {
        firstOrdinal = child.ordinal;
      }
      return {
        title: child.title,
        originalIndex: index,
      };
    };

    if (isUnit(item)) {
      _itemType = "Unit";
      _childType = "Investigation";
      children = item.investigations.map(generateChildrenData);
    }
    else if (isInvestigation(item)) {
      _itemType = "Investigation";
      _childType = "Problem";
      children = item.problems.map(generateChildrenData);
    }
    else if (isProblem(item)) {
      _itemType = "Problem";
      _childType = "Section";
    }
    return {
      itemType: _itemType,
      childType: _childType,
      defaultValues: {
        title: item.title,
        firstOrdinal,
        children
      }
    };
  }, [item]);

  const { handleSubmit, register, control, reset, formState: { errors } } = useForm<IUnitParentFormInputs>({
    defaultValues,
    mode: "onChange",
  });

  // The teacher guide config changes after the first render, so we just reset the form whenever the default
  // values change
  useEffect(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

  // --- Problem form hooks ---
  const isSubmitting = useRef(false);

  const pathInfo = useMemo(
    () => itemPath ? parseItemPath(itemPath) : undefined,
    [itemPath]
  );

  const availableSections = useMemo(() => {
    if (!pathInfo) return {};
    if (pathInfo.isTeacherGuide) {
      return teacherGuideConfig?.sections ?? {};
    }
    return unitConfig?.sections ?? {};
  }, [pathInfo, unitConfig, teacherGuideConfig]);

  const sectionPathPrefix = pathInfo?.isTeacherGuide ? "teacher-guide/" : "";

  const problemFormDefaults = useMemo(() => {
    if (!item || !isProblem(item)) return undefined;
    return {
      title: item.title,
      sections: buildProblemSectionsFormData(item, availableSections, files, sectionPathPrefix),
    };
  }, [item, availableSections, files, sectionPathPrefix]);

  const problemFormResolver = useMemo(() => {
    return (values: IProblemFormInputs) => {
      const resolverErrors: Record<string, any> = {};
      const enabledTypes = values.sections.filter(s => s.enabled).map(s => s.type);

      const duplicates = enabledTypes.filter(
        (type, index) => enabledTypes.indexOf(type) !== index
      );
      if (duplicates.length > 0) {
        resolverErrors.sections = { message: `Duplicate section types: ${duplicates.join(", ")}` };
      }

      const invalidTypes = enabledTypes.filter(type => !availableSections[type]);
      if (invalidTypes.length > 0) {
        resolverErrors.sections = { message: `Unknown section types: ${invalidTypes.join(", ")}` };
      }

      return {
        values: Object.keys(resolverErrors).length === 0 ? values : {},
        errors: resolverErrors,
      };
    };
  }, [availableSections]);

  const problemForm = useForm<IProblemFormInputs>({
    defaultValues: problemFormDefaults,
    mode: "onChange",
    resolver: problemFormResolver,
  });

  useEffect(() => {
    if (problemFormDefaults) {
      problemForm.reset(problemFormDefaults);
    }
  }, [problemForm, problemFormDefaults]);

  if (!pathMatch) {
    return <div>Invalid path for ContainerConfig: {path}</div>;
  }

  if (!item) {
    return <div>Could not find curriculum item for path: {itemPath}</div>;
  }

  const onSubmit: SubmitHandler<IUnitParentFormInputs> = (data) => {
    if (!itemPath) {
      return;
    }

    const itemPathParts = itemPath.split("/");

    const updateUnitDraft = (draft: WritableDraft<IUnit> | undefined) => {
      if (!draft) return;

      const currentItem = getUnitItem(draft, itemPathParts);
      if (!currentItem) return;

      currentItem.title = data.title;
      // The firstOrdinal is required, but just to be safe we default to 1
      const firstOrdinal = data.firstOrdinal ?? 1;

      if (isUnit(currentItem)) {
        // update investigations
        // When the unit was loaded store the originalIndex of each child, this way
        // when a new one is added it won't have this originalIndex. And when we support
        // re-ordering we can still find the original child to update its properties.
        currentItem.investigations = data.children.map((child, index) => {
          let investigation: IInvestigation | undefined;
          const { title } = child;
          const ordinal = index + firstOrdinal;
          if (child.originalIndex != null) {
            investigation = currentItem.investigations[child.originalIndex];
            investigation.title = title;
            investigation.ordinal = ordinal;
          } else {
            // This is a new investigation
            investigation = {
              title,
              ordinal,
              description: "",
              problems: [],
            };
          }
          return investigation;
        });
      }
      else if (isInvestigation(currentItem)) {
        currentItem.problems = data.children.map((child, index) => {
          let problem: IProblem | undefined;
          const { title } = child;
          const ordinal = index + firstOrdinal;
          if (child.originalIndex != null) {
            problem = currentItem.problems[child.originalIndex];
            problem.title = title;
            problem.ordinal = ordinal;
          } else {
            // This is a new problem
            problem = {
              title,
              ordinal,
              description: "",
              subtitle: "",
              sections: [],
            };
          }
          return problem;
        });

      }
      else if (isProblem(currentItem)) {
        // Problems don't have children to update
      }
    };

    if (itemPathParts[0] === "teacher-guides") {
      setTeacherGuideConfig(updateUnitDraft);
    } else {
      setUnitConfig(updateUnitDraft);
    }
  };

  const onSubmitProblem: SubmitHandler<IProblemFormInputs> = async (data) => {
    if (!itemPath || !pathInfo || !item || !isProblem(item)) return;
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    const itemPathParts = itemPath.split("/");
    const config = pathInfo.isTeacherGuide ? teacherGuideConfig : unitConfig;
    const investigation = config?.investigations?.[pathInfo.investigationIndex];
    if (!investigation) {
      isSubmitting.current = false;
      return;
    }

    const enabledSections = data.sections.filter(s => s.enabled);
    const existingPaths = enabledSections.filter(s => s.existingPath).map(s => s.existingPath!);
    const problemBasePath = getProblemBasePath(
      existingPaths, config, investigation,
      pathInfo.investigationIndex, item.ordinal
    );

    const newSectionPaths: string[] = [];
    const filesToCreate: { path: string; sectionType: string }[] = [];

    for (const section of enabledSections) {
      if (section.existingPath) {
        newSectionPaths.push(section.existingPath);
      } else {
        const newPath = generateSectionPath(problemBasePath, section.type);
        newSectionPaths.push(newPath);
        if (!files?.[sectionPathPrefix + newPath]) {
          filesToCreate.push({ path: newPath, sectionType: section.type });
        }
      }
    }

    try {
      for (const file of filesToCreate) {
        await saveContent(sectionPathPrefix + file.path, { type: file.sectionType, content: { tiles: [] } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to create section file:", message);
      problemForm.setError("sections", {
        message: "Failed to create section file. Please try again."
      });
      isSubmitting.current = false;
      return;
    }

    const updateUnitDraft = (draft: WritableDraft<IUnit> | undefined) => {
      if (!draft) return;
      const currentItem = getUnitItem(draft, itemPathParts);
      if (!currentItem || !isProblem(currentItem)) return;
      currentItem.title = data.title;
      currentItem.sections = newSectionPaths;
    };

    if (pathInfo.isTeacherGuide) {
      setTeacherGuideConfig(updateUnitDraft);
    } else {
      setUnitConfig(updateUnitDraft);
    }
    isSubmitting.current = false;
  };

  if (isProblem(item)) {
    return (
      <form onSubmit={problemForm.handleSubmit(onSubmitProblem)}>
        <div>
          <label htmlFor="title">{itemType} Title</label>
          <input
            type="text"
            id="title"
            defaultValue={problemFormDefaults?.title}
            {...problemForm.register("title", { required: "Title is required" })}
          />
          {problemForm.formState.errors.title && (
            <span className="form-error">{problemForm.formState.errors.title.message}</span>
          )}
        </div>
        <ProblemSections
          availableSections={availableSections}
          control={problemForm.control}
          errors={problemForm.formState.errors}
        />
        <div className="bottomButtons">
          <button type="submit" disabled={saveState === "saving"}>Save</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="title">{itemType} Title</label>
        <input
          type="text"
          id="title"
          defaultValue={defaultValues?.title}
          {...register("title", { required: "Title is required" })}
        />
        {errors.title && <span className="form-error">{errors.title.message}</span>}
      </div>
      <UnitItemChildren
        childType={childType}
        defaultValues={defaultValues}
        register={register}
        errors={errors}
        control={control}
      />
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );

};
