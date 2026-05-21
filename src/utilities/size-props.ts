// Replaces the `SizeMeProps` shape from the unmaintained `react-sizeme` package.
// Kept separate so consumers that only need the type don't have to import a
// React component.

export interface SizeProps {
  readonly size: {
    readonly width: number | null;
    readonly height: number | null;
  };
}
