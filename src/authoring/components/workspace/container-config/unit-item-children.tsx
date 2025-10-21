import React from "react";
import { Control, FieldErrors, useFieldArray, UseFormRegister } from "react-hook-form";
import { IUnitParentFormInputs } from "./container-config-types";

interface UnitItemChildrenProps {
  childType?: string;
  defaultValues?: IUnitParentFormInputs;
  register: UseFormRegister<IUnitParentFormInputs>;
  errors: FieldErrors<IUnitParentFormInputs>;
  control: Control<IUnitParentFormInputs, any, IUnitParentFormInputs>;
}

export const UnitItemChildren: React.FC<UnitItemChildrenProps> = (
  { childType, defaultValues, register, errors, control }
) => {
  const childrenFieldArray = useFieldArray({ control, name: "children" });

  return (
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
              <tr>
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
  );
};
