**This folder contains files that aren't actually used.**

This is a demo of system that could replace the Rete model and engine.

The demo is incomplete:
- it is missing caching of the data results. So it might be less efficient then Rete.
- it doesn't include MST for the nodes which would be needed for simple serialization of the model.
- it doesn't have an example of "parameters", these would be things used by the data functions in addition to the inputs when they compute their value. For example the number node has a parameter which is the number.
- it doesn't include an example of time. Several of our nodes vary their value based on time, for example the ramp node and the new wait feature of the hold node.

The "parameters" and time would impact how the caching works.
The MST based nodes might impact the TS work.

One of the useful parts of the demo is the types. The nodes can define their input and output ports using objects that would be available at runtime. And these same definitions are used by the type system to compute the input parameters to the data function.

This works by using a few features of TS:
- *`as const`*: this tells TS a object is literal all of the way down. This makes all parts of readonly. And it also means any usage of its types return the literal values not the types. So you get back `"foo"` instead of `string`.
- *mapped types*: https://www.typescriptlang.org/docs/handbook/2/mapped-types.html this allows you to convert one type to another with the same keys but different types for the values.
- *indexed access types*: https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html this lets you look up a type by a property name on another type.
