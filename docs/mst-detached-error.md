# MST Detached or Destroyed Object Warning

When working with MST you might run into console warnings like this one:

> Error: [mobx-state-tree] You are trying to read or write to an object that is no longer part of a state tree. (Object type: 'Todo', Path upon death: '/todos/0', Subpath: 'name', Action: '/todos/0.removeFirstTodo()'). Either detach nodes first, or don't use objects after removing / replacing them in the tree.

This can happen for a number of reasons. If you look at the stack trace that goes with the warning, sometimes the cause is obvious. Other times the cause is not obvious. For example it might not be clear why some of our code is being called. There might be some top level action and then way up/down the stack is a call to one of our functions and there is no obvious connection between these two.

Below is a strategy for tracking down the cause and a solution for one particular cause.

## Tracking down the cause of the error

Hopefully from the message you can figure out the rough area of the code where the problem is happening. If you can pin point the UI action that causes the warning to be printed then you can use the following approach.

In your local code find `kEnableLivelinessChecking` located in `initialize-app.tsx` and set to be `true`. This will cause these console warnings to actually be thrown errors instead. In many cases these thrown errors will be caught and ignored so after you set this to true you probably won't see any messages in the console if you try to duplicate the problem again.

Instead of looking in the console, what you should do is use the dev tools debugger to track it down. Setup the app to just before the error would normally be printed to the console. Then in the debug panel turn on "pause on exceptions" and check the box "pause on caught exceptions". Now trigger the error. The app should pause and you should be in the debugger.

Now you can use the Call Stack section to navigate up/down the stack and inspect the state of the MobX internals to figure out why the function was called that is causing the problem.

Below is a stack trace from a computed value that is accessing an object after it has been destroyed. This case is described in the next section, but its stack trace illustrates in general where to look for information. In the debugger the trace will look different. It will only show the function name

```js
ObjectNode.value ("mobx-state-tree.js:1854:25")
ObjectNode.value ("mobx-state-tree.js:1959:18")
ObservableValue.dehancer ("mobx@observablevalue.ts:95:25")
ObservableValue.dehanceValue ("mobx@observablevalue.ts:156:21")
ObservableObjectAdministration.get ("mobx@observableobject.ts:121:39")
Object.getObservablePropValue_ ("mobx@observableobject.ts:701:36")
ObservableObjectAdministration.get_ ("mobx@observableobject.ts:182:16")
Object.get_ ("mobx@dynamicobject.ts:30:31")
Proxy.get prefixedName ("/src/models/mst.test.ts:676:27")
// ⬆⬆ This is the actual function that is causing the problem.
// You can tell it is our code by the name of the file.
// In the developer tools it won't have the `/src/models/...` part
// So you'll have to identify it just by the final filename.
// If you click on it it should open the file at the line with the
// problem.
call ("mobx@derivation.ts:183:24")
ComputedValue.trackDerivedFunction ("mobx@computedvalue.ts:251:19")
ComputedValue.computeValue_ ("mobx@computedvalue.ts:219:31")
ComputedValue.trackAndCompute ("mobx@computedvalue.ts:184:26")
get ("mobx@derivation.ts:104:33")
Reaction.shouldCompute ("mobx@reaction.ts:98:17")
// ⬆⬆ This is where you can try to figure out which reaction is causing
// the computed value to be re-evaluated.
// You should have access to a variable called `derivation`
// The `name` property of the derivation might give you a hint.
// You can also look at the `obs` array to find out what values
// this derivation (reaction) is observing. These values have names
// which usually include the name of the property that was accessed
runReaction_ ("mobx@reaction.ts:260:35")
f ("mobx@reaction.ts:230:56")
reactionScheduler ("mobx@reaction.ts:237:5")
runReactions ("mobx@observable.ts:112:9")
```

## Item destroyed in a list

This is one case that can cause these MST detached or destroyed object warnings. This will happen under these conditions:
- there is `observer` component
- this component is observing a MST model that is destroyed in some cases
- this component is directly or indirectly depending on another observable that changes when the MST model is destroyed

Because MobX React `observer` components use reactions under-the-hood, they will trigger computed value checks for any computed value they access whenever one of these observed computed values changes. This is done by MobX to see if the reaction should be run again. So let’s say you have a component rendering an item in a MST list and it uses a computed value from the item. This computed value accesses some global observable object to get some extra info about the item.

```js
const descriptions = observable({
  one: "description of one",
  two: "description of two"
});

const Item = types.model("Item", {
  name: types.string
})
.views(self => ({
  get nameWithDescription() {
    return `${self.name}: ${descriptions[self.name]}`;
  }
}));

const ItemComponent = observer(function ItemComponent({item})) {
  return <span>{ item.nameWithDescription }</span>
});
```

A working version of this code can be found in `mobx-react-mst.test.tsx`.

If you remove the item from the list by destroying it using `destroy(item)` and at the same time you modify the `descriptions` to clean up the entry for this item, you will see a confusing warning from MST. The change of `descriptions` triggers a `shouldCompute` test of `nameWithDescription`. But at this point the item has been destroyed so the reading of `self.name` will print the detached or destroyed object warning. This is confusing because the item is destroyed so why is `nameWithDescription` being read? On top of this you might see that the `ItemComponent` for the item is never even re-rendered because its parent component is only rendering the remaining children.

Here is what is going on: even though `ItemComponent` isn't re-rendered, the fact that it was rendered once means there is a MobX reaction monitoring `item.nameWithDescription`. `item.nameWithDescription` is accessing `descriptions`. When `descriptions` changes MobX goes up the dependency tree and finds this reaction. It then goes through the reaction's dependencies to see if any of them have actually changed. To tell if a dependency has changed it needs to "evaluate" or compute it. So it actually evaluates `nameWithDescription`. And because the item has been destroyed MST prints a warning about the reading of `self.name`.

If this was a regular MobX reaction (autorun or reaction), you could solve this by telling MST to call the reaction's disposer when the model was destroyed by calling `addDisposer(item, reactionDisposer)`. However MobX React doesn't give you access to the disposer.

Instead you can use MST's isAlive combined with an optimization that MobX has to remove the warning. Here is what `ItemComponent` should be:

```
const ItemComponent = observer(function ItemComponent({item})) {
  if (!isAlive(item)) {
    console.warn("rendering destroyed item");
  }
  return <span>{ item.nameWithDescription }</span>;
});
```

It turns out that MST's isAlive is observable itself. So the "aliveness" of item is now another dependency of the `ItemComponent` observer reaction. If MobX evaluated all of the dependencies in parallel for changes, this wouldn't fix the problem because `nameWithDescription` would still be evaluated to see if it changed. In reality, MobX evaluates the dependencies in the order that they are referenced, and it stops going through the list if a dependency has changed. It is implemented this way because as soon as MobX sees a change it knows it is has to run the reaction, so there is no reason to keep looking for changes. Because of this optimization, when the "aliveness" of `item` changes, `nameWithDescription` will not be evaluated/computed. If the component actually gets re-rendered there will be a console warning from us to help find the problem, and then a second warning from MST about accessing `nameWithDescription` on a destroyed object. If this happens it is probably some kind of memory leaking error since the parent component should only be rendering `ItemComponent`s for the active items.

Because this kind of isAlive check is generally useful CLUE has a utility function `verifyAlive` that does the isAlive check and prints a console warning if it fails.

### Alternative destroy soon solution

It is also possible to avoid this warning by first detaching the item from the tree and then destroying it. The initial detach will still cause the `nameWithDescription` to be re-computed but because the item is not destroyed the reading of `name` will still be valid. This alternative approach is demonstrated in `mobx-react-mst.test.tsx`

The potential problem with this approach is any errors or side effects that might happen when the item is detached before it is destroyed. In the case that triggered this whole investigation, the table tile is looking at the shared model manager to figure out the dataset. Since the table tile is no longer part of the tree, its reference gets automatically removed from the entry in the shared model manager. So when the MST view tries to find the shared model a warning is printed because the shared model manager doesn't expect a lookup for a tile that isn't part of the tree. Additionally when it is just detached and the dataSet view is evaluated it returns the importedDataSet. This seems to be harmless, but if something was being done with that imported data set like automatically adding it as a shared model, that would be bad.

If the whole evaluation of view is short circuited using the first approach of an isAlive check, then this avoids these side effects. It does mean we have to add this check to any components that are using models that might be destroyed and where the component is directly or indirectly depending on an observable that changes when the item is destroyed. This extra work seems worth it to prevent harder to find side effects.

### Other Notes

I think the complexity here stems from the fact that MST introduces this "alive" concept. MobX does not have this concept itself. It might be possible to fix the problem within the frameworks, (MST, MobX, and MobX React). I've come up with two viable solutions and a third that probably wouldn't work.

Viable Solution #1:

We add support to MobX itself for this "alive" property of objects. With this in MobX, MobX's `shouldCompute` can find the object of the computedValue function and see if the object is alive before testing the computedValue. If the object isn't alive then it could just return true.

Viable Solution #2:

MST could add isAlive checks around every view function that MST sets up for the model objects.

Probably not Viable Solution:

Adding hooks to MobX React so we could extend it with an isAlive short circuit on the reactions MobX React creates when `observer(...)` is used. The problem is that the reaction might be reacting to multiple objects and at the time `observer(...)` is called it can't figured out what these objects are automatically. Perhaps there is a way to access the list of objects being monitored by MobX for changes, but this list wouldn't be known until after the first render. So the short circuit wouldn't know to call isAlive on these objects until the second time through the render function. This would be too late to actually short circuit in most cases. Instead I'd guess there'd have to be some helper method called during render that is passed the objects that should be checked. To actually implement that helper function we don't need any changes to MobX React it can just be a function that checks each of the passed in objects. CLUE has such a helper function: `verifyAlive`.
