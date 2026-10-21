import { LiveOutputNode } from "../nodes/live-output-node";
import { SensorNode } from "../nodes/sensor-node";

/**
 * True if any block in the program can only work with a connected device: a Sensor block that
 * reads a live sensor, or a wired Live Output block without a simulated output. Reads observable
 * state (each block's MST model, the program's connections and the tile's output variables), so
 * calling it inside an autorun re-evaluates when settings, wiring or output variables change.
 */
export function programNeedsDevice(nodes: Iterable<unknown>): boolean {
  for (const node of nodes) {
    if ((node instanceof SensorNode || node instanceof LiveOutputNode) && node.requiresSerial()) {
      return true;
    }
  }
  return false;
}
