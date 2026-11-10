import { getRoot, getRunningActionContext } from "mobx-state-tree";
import { DEBUG_UNDO } from "../../lib/debug";
import { CallEnv, runningCalls } from "./tree-types";

interface IChildActionOptions {
  unlessChildAction?: boolean;
}

/**
 * When added to the body of a MST action, this will prevent any changes
 * made by the action from being recorded in the CLUE undo stack. The changes
 * will still be recorded in the CLUE document history.
 *
 * If this action was called from another MST action it is considered a child
 * action. Child action changes are always recorded, so by default a warning
 * is printed when withoutUndo is called from a child action.
 *
 * There is is an option so you can record the child action changes, but not
 * record the changes when the action is the initial action:
 *
 *   `withoutUndo({ unlessChildAction: true })`
 *
 */
export function withoutUndo(options?: IChildActionOptions) {
  const env = getRootCallEnv("withoutUndo", options);
  if (!env) return;
  env.undoable = false;
}

/**
 * When added to the body of a MST action, this marks the history entry of the
 * action as background: produced by code, not by direct user activation, such
 * as a tick of a running program. A background entry is not undoable.
 *
 * `producerTileId` is the id of the tile that owns the action, usually
 * `getTileModel(self)?.id`.
 *
 * Like `withoutUndo`, it only applies when the action is the initial action. A
 * child action's changes belong to its parent's entry, which might hold a
 * person's change, so by default a warning is printed and the entry is
 * recorded as the parent's. `unlessChildAction: true` skips the warning.
 */
export function asBackground(options: { producerTileId: string | undefined; unlessChildAction?: boolean }) {
  const env = getRootCallEnv("asBackground", options);
  if (!env) return;
  env.undoable = false;
  env.background = true;
  env.producerTileId = options.producerTileId;
}

/**
 * Returns the environment of the tracked call of the running action, or undefined when the
 * action is a child action or isn't tracked.
 */
function getRootCallEnv(name: string, options?: IChildActionOptions): CallEnv | undefined {
  const actionCall = getRunningActionContext();
  if (!actionCall) {
    throw new Error(`${name} called outside of an MST action`);
  }

  if (actionCall.parentActionEvent) {
    if (options?.unlessChildAction) {
      // The caller has explicity said it is OK to ignore the call
      // when we are in a child action.
      return;
    }
    // It is a little weird to print all this, but it seems like a good way to leave
    // this part unimplemented.
    console.warn([
      `${name}() was called by a child action. If calling a child action ` +
      `with ${name} is something you need to do, you have a few options.` +
      `- If you want to ignore the ${name} when in a child action:` +
      `  ${name}({ unlessChildAction: true })` +
      "  Note: this may cause issues if other code is always assuming this action" +
      "  will never be included in the undo history" +
      "- If you want to do something else you'll need to update this code." +
      "  Here are a couple options you might want:" +
      `    1. Apply the ${name} to the parent action`,
      `    2. Apply the ${name} just to the child action`,
      "  Notes:",
      "   - option 1 might have unintended consequences. Actions can become child actions" +
      "     in strange ways. For example a model action can trigger a re-render of a component." +
      "     If the component has a componentDidUpdate which calls another action, this second" +
      "     action will be considered a child action of the initial model action." +
      "   - option 2 will require changing the undo stack so it can record different " +
      "     entries from the history stack. It will also require changing the recordPatches " +
      "     function to somehow track this child action information."
    ].join('\n'));
    return;
  }

  const call = runningCalls.get(actionCall);
  if (!call){
    // It is normal for there to be no running calls. This can happen in two cases:
    //   - the document isn't being edited so the tree monitor is disabled
    //   - the document content is part of the authored unit. In this case there is no
    //     DocumentModel so there is no middleware.
    if (DEBUG_UNDO) {
      try {
        const {context} = actionCall;
        const root = getRoot(context);
        // Use duck typing to figure out if the root is a tree
        // and its tree monitor is enabled
        if ((root as any).treeMonitor?.enabled) {
          console.warn("cannot find action tracking middleware call");
        }
      } catch ( error ) {
        console.warn("cannot find action tracking middleware call, " +
          "error thrown while trying to find the tree", error);
      }
    }
    return;
  }

  if (!call.env) {
    throw new Error("environment is not setup on action tracking middleware call");
  }
  return call.env;
}
