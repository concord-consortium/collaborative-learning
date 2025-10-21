import React from "react";
import { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { IUnitParentFormInputs } from "./container-config-types";

interface UnitItemChildrenProps {
  defaultValues?: IUnitParentFormInputs;
  register: UseFormRegister<IUnitParentFormInputs>;
  errors: FieldErrors<IUnitParentFormInputs>;
  control: Control<IUnitParentFormInputs, any, IUnitParentFormInputs>;
}

export const ProblemSections: React.FC<UnitItemChildrenProps> = (
  { defaultValues, register, errors, control }
) => {
  // It seems the best UI here would be a list of items with each item having
  // a dropdown to select the section type. The list of section types should come
  // from the unit's `/sections` map.

  // And it should have a validation to prevent duplicate section types being added
  // in a single problem.

  // When the form is saved, then it should decide about whether it needs to add new files
  // for any new sections that don't have files yet. The paths for these files can use:
  // look for any existing section paths in order to figure the path of problem itself.
  // Its possible different section files will have different problem paths, so then it
  // just chose one.
  // Then the type of the section can be appended to this problem path to make the section
  // file path. This path should be checked to see if there is already a file there.
  // If so this existing file can be used. This way a user can recover existing files.
  // There is a possibility that the section file will already be used by another section
  // this problem or another problem. So for existing files, that should be checked too.
  // In that case it should probably create a new file.
  // If there isn't a file there then a new one would be created.
  // Probably we should show the paths of the section files, to help debug any issues.

  // See unit-configuration.md documentation for more details about problem sections.

  return (
    <div className="problemSections">
    </div>
  );
};
