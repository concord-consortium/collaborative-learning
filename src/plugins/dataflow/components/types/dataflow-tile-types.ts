export enum UpdateMode {
  Increment = "Increment",
  Reset = "Reset",
}

export enum ProgramMode {
  Ready, // if Ready then you can record
  Recording, // if Recording then you can stop
  Done //if Done you can clear
}
