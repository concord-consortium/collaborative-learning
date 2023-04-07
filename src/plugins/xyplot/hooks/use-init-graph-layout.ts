import { reaction } from "mobx";
import { useEffect } from "react";
import { useMemo } from "use-memo-one";
import { AxisPlace } from "../axis/axis-types";
import { GraphLayout } from "../models/graph-layout";
import { IGraphModel } from "../models/graph-model";

export function useInitGraphLayout(model?: IGraphModel) {
  const layout = useMemo(() => new GraphLayout(), []);

  useEffect(() => {
    // synchronize the number of repetitions from the DataConfiguration to the layout's MultiScales
    return reaction(
      () => {
        const repetitions: Record<string, number> = {};
        layout.axisScales.forEach((multiScale, place) => {
          repetitions[place] = model?.config.numRepetitionsForPlace(place) ?? 1;
        });
        return repetitions;
      },
      (repetitions) => {
        // TODO: Update type declarations. First `place` was originally AxisPlace. Second had no cast to type.
        Object.keys(repetitions).forEach((place: string) => {
          layout.getAxisMultiScale(place as AxisPlace)?.setRepetitions(repetitions[place]);
        });
      }
    );
  }, [layout, model?.config]);

  return layout;
}
