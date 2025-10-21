import React, { useEffect, useMemo } from "react";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import { IInvestigation, IProblem, IUnit } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";
import { CurriculumItem, getCurriculumItem, getUnitItem } from "../../utils/nav-path";
import { WritableDraft } from "immer";

interface Props {
  path: string;
}

interface UnitChild {
  title: string;
  originalIndex?: number;
}

interface IUnitParentFormInputs {
  title: string;
  description?: string;
  // This is used at the unit and investigation level
  firstOrdinal?: number;
  children: UnitChild[];
}

function isUnit(item: CurriculumItem): item is IUnit {
  return "investigations" in item && Array.isArray(item.investigations);
}

function isInvestigation(item: CurriculumItem): item is IInvestigation {
  return "problems" in item && Array.isArray(item.problems);
}

function isProblem(item: CurriculumItem): item is IProblem {
  return "sections" in item && Array.isArray(item.sections);
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
    if (isInvestigation(item)) {
      _itemType = "Investigation";
      _childType = "Problem";
      children = item.problems.map(generateChildrenData);
    }
    if (isProblem(item)) {
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

  const childrenFieldArray = useFieldArray({ control, name: "children" });

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

      if (isInvestigation(currentItem)) {
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

      if (isProblem(currentItem)) {
        // Problems don't have children to update
      }
    };

    if (itemPathParts[0] === "teacher-guides") {
      setTeacherGuideConfig(updateUnitDraft);
    } else {
      setUnitConfig(updateUnitDraft);
    }
  };

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
      { !isProblem(item) && (
        <>
          <div>
            <label htmlFor="firstOrdinal">First {childType} Ordinal</label>
            <input
              type="number"
              id="firstOrdinal"
              defaultValue={defaultValues?.firstOrdinal}
              {...register("firstOrdinal", { required: "First Ordinal is required" })}
            />
            {errors.firstOrdinal && <span className="form-error">{errors.firstOrdinal.message}</span>}
          </div>
          <div className="sectionLabel">{childType}s</div>
          <table className="containerChildrenTable">
            <thead>
              <tr>
                <th className="reorderColumn">Reorder</th>
                <th className="titleColumn">Title</th>
              </tr>
            </thead>
            <tbody>
              {childrenFieldArray.fields.map((child, index) => (
                // The items in the unit don't have ids, however react-hook-form does add an
                // id property to each item in the field array. These ids look like UUIDs.
                // It isn't clear what this id is tied to.
                <React.Fragment key={child.id}>
                  <tr key={index}>
                    <td className="reorderColumn">
                      <button
                        type="button"
                        onClick={() => {
                          if (index > 0) childrenFieldArray.swap(index, index - 1);
                        }}
                        disabled={index === 0}
                        style={{ marginLeft: 4 }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (index < childrenFieldArray.fields.length - 1) childrenFieldArray.swap(index, index + 1);
                        }}
                        disabled={index === childrenFieldArray.fields.length - 1}
                        style={{ marginLeft: 2 }}
                      >
                        ↓
                      </button>
                    </td>
                    <td className="titleColumn">
                      <input
                        type="text"
                        defaultValue={child.title}
                        {...register(`children.${index}.title`, { required: "Title is required" })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          childrenFieldArray.remove(index);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  { errors.children?.[index]?.title && (
                    <tr><td colSpan={2} className="form-error">{errors.children?.[index]?.title?.message}</td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div>
            <button type="button" onClick={() => { childrenFieldArray.append({ title: "" }); }}>
              Add { childType }
            </button>
          </div>
        </>
      )}
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );

};
