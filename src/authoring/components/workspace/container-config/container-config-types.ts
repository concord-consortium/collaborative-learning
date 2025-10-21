export interface UnitChild {
  title: string;
  originalIndex?: number;
}

export interface IUnitParentFormInputs {
  title: string;
  description?: string;
  // This is used at the unit and investigation level
  firstOrdinal?: number;
  children: UnitChild[];
}
