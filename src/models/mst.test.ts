import { action, autorun, makeObservable, observable } from "mobx";
import { addDisposer, applySnapshot, getType, isAlive, types, getRoot,
  isStateTreeNode, SnapshotOut, Instance, getParent, destroy, hasParent,
  getSnapshot, addMiddleware, getEnv,
  createActionTrackingMiddleware2, resolvePath, flow, onSnapshot,
  hasEnv
} from "mobx-state-tree";

describe("mst", () => {
  it("snapshotProcessor unexpectedly modifies the base type", () => {
    const Todo1 = types.model({ text: types.maybe(types.string) });
    const Todo2 = types.snapshotProcessor(Todo1, {
      preProcessor(sn) {
        return {text: "todo2 text"};
      }
    });
    const todo1a = Todo1.create();
    expect(todo1a.text).toBeUndefined();

    const todo2 =Todo2.create();
    expect(todo2.text).toBe("todo2 text");

    const todo1b = Todo1.create();
    // When the type created by the snapshotProcessor (Todo2) is instantiated,
    // the base type's (Todo1's) create method is modified so it actually goes
    // through the processor. This is bug in MST and has been reported here:
    // https://github.com/mobxjs/mobx-state-tree/issues/1897
    expect(todo1b.text).toBe("todo2 text");
  });

  it("snapshotProcessor type matches type check of original type", () => {
    const Todo1 = types.model({ text: types.maybe(types.string) });
    const Todo2 = types.snapshotProcessor(Todo1, {
      preProcessor(sn) {
        return {text: "todo2 text"};
      }
    });
    const todo2 =Todo2.create();
    // I think this is the intended behavior.
    // We are counting on this behavior to be able to find shared models of
    // a specific type.
    expect(getType(todo2) === Todo1).toBe(true);
  });

  it("preProcessSnapshot is called twice, and is not called extra times for model extensions", () => {
    let preProcessCount = 0;
    const Base = types.model("Base", {
      text1: types.maybe(types.string)
    })
    .preProcessSnapshot(snapshot => {
      preProcessCount++;
      return snapshot;
    });

    const Extension1 = Base.named("Extension1").props({
      text2: types.maybe(types.string)}
    );

    const Extension2 = Extension1.named("Extension2").props({
      text3: types.maybe(types.string)
    });

    Base.create({});
    expect(preProcessCount).toBe(2);

    preProcessCount = 0;
    Extension1.create({});
    expect(preProcessCount).toBe(2);

    preProcessCount = 0;
    Extension2.create({});
    expect(preProcessCount).toBe(2);
  });

  it("loads late types when another type referencing is instantiated", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => {
        lateCalled = true;
        return types.string;
      })
    });
    expect(lateCalled).toBe(false);

    const TypeUsingLate = types.model("TypeUsingLate", {
      withLate: TypeWithLate
    });
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLate: {prop: "val"}});
    expect(lateCalled).toBe(true);
  });

  it("loads a late type immediately when it is the direct child of a map", () => {
    let lateCalled = false;
    types.model("TypeWithLate", {
      prop: types.map(types.late(() => {
        lateCalled = true;
        return types.string;
      }))
    });
    expect(lateCalled).toBe(true);
  });

  it("does not load a late type immediately when it is the direct child of an array", () => {
    let lateCalled = false;
    types.model("TypeWithLate", {
      prop: types.array(types.late(() => {
        lateCalled = true;
        return types.string;
      }))
    });
    expect(lateCalled).toBe(false);
  });

  it("loads a late type immediately when it is the direct child of an optional", () => {
    let lateCalled = false;
    types.model("TypeWithLate", {
      prop: types.optional(types.late(() => {
        lateCalled = true;
        return types.string;
      }), "something")
    });
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type when it is the direct child of a maybe", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.maybe(types.late(() => {
        lateCalled = true;
        return types.string;
      }))
    });
    expect(lateCalled).toBe(false);

    TypeWithLate.create({});
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type child of a map when the map is wrapped in late", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => types.map(types.late(() => {
        lateCalled = true;
        return types.string;
      })))
    });
    expect(lateCalled).toBe(false);

    TypeWithLate.create({prop: {"hi": "hello"}});
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type when inside of a map of models with a late prop", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => {
        lateCalled = true;
        return types.string;
      })
    });
    expect(lateCalled).toBe(false);

    const TypeUsingLate = types.model("TypeUsingLate", {
      withLateMap: types.map(TypeWithLate)
    });
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLateMap: {}});
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLateMap: {"key": {prop: "value"}}});
    expect(lateCalled).toBe(true);
  });

  test("applySnapshot does not merge the properties", () => {
    const Todo1 = types.model({
      text1: types.maybe(types.string),
      text2: types.maybe(types.string)
    });

    const todo = Todo1.create({text1: "1", text2:"2"});
    expect(todo.text1).toBe("1");
    applySnapshot(todo, {text2: "changed"});
    expect(todo.text1).toBeUndefined();
  });

  test("applySnapshot ignores unknown properties", () => {
    const Todo1 = types.model({
      text1: types.maybe(types.string),
      text2: types.maybe(types.string)
    });

    const todo = Todo1.create({text1: "1", text2: "2"});
    applySnapshot(todo, {text2: "changed", foo: "bar"} as any);
    expect(todo.text1).toBeUndefined();
    expect(todo.text2).toBe("changed");
    expect((todo as any).foo).toBeUndefined();
  });

  test("map set applies a snapshot to the existing object", () => {
    const TodoValue = types.model({
      name: types.string
    });
    const Todo = types.model({
      values: types.map(TodoValue),
    })
    .actions(self => ({
      setValue(key: string, value: any) {
        self.values.set(key, value);
      }
    }));

    const todo = Todo.create({values: {"first": {name: "1"}}});
    const firstValue = todo.values.get("first");
    expect(firstValue!.name).toBe("1");

    todo.setValue("first", {name: "changed"});
    const updatedValue = todo.values.get("first");
    expect(updatedValue).toBe(firstValue);
    expect(firstValue!.name).toBe("changed");

    todo.setValue("first", TodoValue.create({name: "created"}));
    const createdValue = todo.values.get("first");
    expect(createdValue).not.toBe(firstValue);
    expect(isAlive(firstValue)).toBe(false);

  });

  test("getRoot is not observable", () => {
    let autorunCount = 0;

    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      afterCreate() {
        addDisposer(self, autorun(() => {
          autorunCount++;
          getRoot(self);
        }));
      }
    }));

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      addTodo(_todo: Instance<typeof Todo>) {
        self.todos.push(_todo);
      }
    }));

    const todo = Todo.create({name: "hello"});
    expect(autorunCount).toBe(1);

    const todoList = TodoList.create();
    todoList.addTodo(todo);
    return new Promise(resolve => {
      setTimeout(resolve, 50);
    })
    .then(() => {
      expect(autorunCount).toBe(1);
      expect(getRoot(todo)).toBe(todoList);
      destroy(todoList);
    });
  });

  test("getParent is not observable", () => {
    let autorunCount = 0;

    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      afterCreate() {
        addDisposer(self, autorun(() => {
          autorunCount++;
          if (hasParent(self)) {
            getParent(self);
          }
        }));
      }
    }));

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      addTodo(_todo: Instance<typeof Todo>) {
        self.todos.push(_todo);
      }
    }));

    const todo = Todo.create({name: "hello"});
    expect(autorunCount).toBe(1);

    const todoList = TodoList.create();
    todoList.addTodo(todo);
    return new Promise(resolve => {
      setTimeout(resolve, 50);
    })
    .then(() => {
      expect(autorunCount).toBe(1);
      expect(getParent(todo)).toBe(todoList.todos);
    });
  });

  test("hasEnv and getEnv are not observable", () => {
    let autorunCount = 0;
    const doSomething = jest.fn();

    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      afterCreate() {
        addDisposer(self, autorun(() => {
          autorunCount++;
          hasEnv(self) && doSomething(getEnv(self).someValue);
        }));
      }
    }));

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      addTodo(_todo: Instance<typeof Todo>) {
        self.todos.push(_todo);
      }
    }));

    // We create the object with no environment
    // Previously MST would return {} in this case, now it throws an exception
    // but hasEnv can be used to check if the environment is defined
    const todo = Todo.create({name: "hello"});
    expect(autorunCount).toBe(1);
    expect(doSomething).toBeCalledTimes(0);
    expect(hasEnv(todo)).toEqual(false);

    // Now we create a container object with an environment
    const todoList = TodoList.create({}, {someValue: 1});
    todoList.addTodo(todo);

    // The environment of the todo has now changed
    expect(hasEnv(todo)).toBe(true);
    expect(getEnv(todo)).toEqual({someValue: 1});

    return new Promise(resolve => {
      setTimeout(resolve, 50);
    })
    .then(() => {
      // even though the environment has changed the autorun is not triggered
      expect(autorunCount).toBe(1);
      expect(doSomething).toBeCalledTimes(0);
    });
  });

  test("the value of getEnv can be observable", () => {
    let autorunCount = 0;
    const doSomething = jest.fn();

    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      afterCreate() {
        addDisposer(self, autorun(() => {
          autorunCount++;
          doSomething(getEnv(self)?.someValue);
        }));
      }
    }));

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      addTodo(_todo: Instance<typeof Todo>) {
        self.todos.push(_todo);
      }
    }));

    // In order to trigger the autorun the environment needs to be an observable
    // object. In this case we are not creating the todo first, instead it is
    // created with the TodoList. This way the return value of getEnv(todo) is
    // always the same object. With this approach mobx is able to record that we
    // want the someValue property from this object in the autorun, and when that
    // property is defined the autorun is triggered again.
    const env = observable({}) as any;
    const todoList = TodoList.create({
      todos: [
        {name: "hello"}
      ]
    }, env);
    const todo = todoList.todos.at(0);
    expect(autorunCount).toBe(1);
    expect(doSomething).toBeCalledTimes(1);
    expect(getEnv(todo)).toBe(env);

    // ignore MobX warning for modifying an observable outside an action
    jestSpyConsole("warn", () => {
      env.someValue = 1;
    });

    expect(getEnv(todo)).toEqual({someValue: 1});

    return new Promise(resolve => {
      setTimeout(resolve, 50);
    })
    .then(() => {
      expect(autorunCount).toBe(2);
      expect(doSomething).toBeCalledTimes(2);
    });
  });

  test("instances can be passed to snapshot methods", () => {
    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      doSomething () {
        return false;
      }
    }));
    interface TodoSnapshot extends SnapshotOut<typeof Todo> {}

    const todo1 = Todo.create({name: "hello"});
    const todo2 = Todo.create({name: "bye"});
    applySnapshot(todo1, todo2);
    expect(todo1.name).toBe("bye");

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      addTodo(todo: TodoSnapshot) {
        if (isStateTreeNode(todo as any)) {
          throw new Error("passed in todo is not a snapshot");
        }
        self.todos.push(todo);
      }
    }));

    const todoList = TodoList.create();
    todoList.addTodo(getSnapshot(todo1));
    expect(todoList.todos[0]).toEqual(todo1);
    expect(todoList.todos[0]).not.toBe(todo1);

    expect(() => {
      todoList.addTodo(todo1);
    }).toThrow();
  });

  test("instance values in snapshots are not copied", () => {
    const Todo = types.model({
      name: types.string
    });
    const TodoList = types.model({
      todos: types.array(Todo)
    });

    const todo = Todo.create({name: "todo1"});
    const todoList = TodoList.create({todos: [todo]});
    expect(todoList.todos.at(0)).toBe(todo);
  });

  /**
   * This tests how createActionTrackingMiddleware2 handles cases of actions
   * calling calling other actions. It tests 4 cases:
   *
   * Case 0: an action directly calls another action on a child model
   *
   * The next 3 cases all use a manager object to call the action on the child
   * model
   * - Case 1: the manager is implemented as a MST object in another tree, and
   *   the function called on the manager is a MST action.
   * - Case 2: the manager is implemented as a MobX object, and the function
   *   called on the manager is a MobX action.
   * - Case 3: the manager is implemented as a plain JS object
   *
   * The goal of the test is to see if the child model action calls are grouped
   * with the initial action.  This grouping is important for recording a single
   * history entry.
   */
  test("createActionTrackingMiddleware2 loses track of the parent action " +
       "when there is an intermediate MST action in a different tree", () => {
    const Todo = types.model({
      name: types.string
    })
    .actions(self => ({
      setName(name: string) { self.name = name; }
    }));

    const TodoList = types.model({
      todos: types.array(Todo)
    })
    .actions(self => ({
      updateAllTodos(_manager?: any) {
        if (!_manager) {
          // Case: 0
          self.todos.forEach(todo => {
            todo.setName("new list name");
          });
        } else {
          // We'll pass 3 different managers here
          // 1. a MSTTodoManager which is in a different MST tree
          // 2. a MobxTodoManager which is MobX not MST
          // 3. a plainManager which is just a JS object
          _manager.managerUpdateAllTodos(self);
        }
      }
    }));

    // Main MST Tree
    const todoList = TodoList.create({
      todos: [
        { name: "todo 1" },
        { name: "todo 2" }
      ]
    });

    interface ICallRecord {action: string, topLevelId: number}

    const started : ICallRecord[] = [];
    const finished : ICallRecord[] = [];
    let topLevelCallId = 0;
    const middleware = createActionTrackingMiddleware2({
      filter(call) {
        return true;
      },
      onStart(call) {
        // This is the key feature we are testing. The middleware can add an
        // `env` to the call object, and then when a nested action is called,
        // the action tracking framework passes the nested action the `env` from
        // the parent action. I'm not sure if it is the same object or a copy.
        // However, what I've found is that when there is an intermediate action
        // in a different tree between the parent and the nested action, then
        // the parent `env` is not passed. This is "Case 1".
        if (!call.env) {
          call.env = { id: topLevelCallId };
          topLevelCallId++;
        }
        started.push({action: call.name, topLevelId: call.env.id});
      },
      onFinish(call) {
        finished.push({action: call.name, topLevelId: call.env.id});
      }
    });
    const disposer = addMiddleware(todoList, middleware, true);

    function resetTrackingProperties() {
      started.length = 0;
      finished.length = 0;
      topLevelCallId = 0;
    }

    // This is what we generally want: 3 calls all with the same topLevelId
    const singleTopLevelOnStartedCalls: ICallRecord[] = [
      {action: "updateAllTodos", topLevelId: 0},
      {action: "setName", topLevelId: 0},
      {action: "setName", topLevelId: 0}
    ];

    // This is what we generally don't want: 3 calls all with different
    // topLevelIds
    const multipleTopLevelOnStartedCalls: ICallRecord[] = [
      {action: "updateAllTodos", topLevelId: 0},
      {action: "setName", topLevelId: 1},
      {action: "setName", topLevelId: 2}
    ];

    // Case 0: Run an action in the Main Tree that does not pass through a
    // manager.
    todoList.updateAllTodos();
    expect(started).toEqual(singleTopLevelOnStartedCalls);
    resetTrackingProperties();

    // Case 1: Run an action in the Main Tree that passes through the secondary tree.
    // This is the case that does what we don't want. The action tracking middleware
    // creates 3 separate environment objects which so it is recording this as 3
    // different top level action calls
    const MSTTodoManager = types.model({
    })
    .actions(self => ({
      managerUpdateAllTodos(list: Instance<typeof TodoList>) {
        list.todos.forEach(todo => {
          todo.setName("new manager name");
        });
      }
    }));
    const mstManager = MSTTodoManager.create();
    todoList.updateAllTodos(mstManager);
    expect(started).toEqual(multipleTopLevelOnStartedCalls);
    resetTrackingProperties();

    // Case 2: Run an action in the Main Tree that uses a MobX manager It could
    // still use observability, but because it isn't MST it doesn't mess up the
    // middleware
    class MobXTodoManager {
      constructor() {
        makeObservable(this, {
          managerUpdateAllTodos: action
        });
      }

      managerUpdateAllTodos(list: Instance<typeof TodoList>) {
        list.todos.forEach(todo => {
          todo.setName("new manager name");
        });
      }
    }
    const mobxManager = new MobXTodoManager();
    todoList.updateAllTodos(mobxManager);
    expect(started).toEqual(singleTopLevelOnStartedCalls);
    resetTrackingProperties();

    // Case 3: Run an action in the Main Tree that use a plain JS Manager
    const plainManager = {
      managerUpdateAllTodos(list: Instance<typeof TodoList>) {
        list.todos.forEach(todo => {
          todo.setName("new manager name");
        });
      }
    };
    todoList.updateAllTodos(plainManager);
    expect(started).toEqual(singleTopLevelOnStartedCalls);
    resetTrackingProperties();

    disposer();
  });

  // This is fixed in concord version of MST 5.1.5-cc.1
  // And there is a PR to fix it in official MST
  // https://github.com/mobxjs/mobx-state-tree/pull/1952
  test("lifecycle hooks can access their children", () => {
    const events: string[] = [];
    function listener(e: string) {
        events.push(e);
    }

    const Child = types
        .model("Todo", {
            title: ""
        })
        .actions((self) => ({
            afterCreate() {
                listener("new child: " + self.title);
            },
            afterAttach() {
                listener("parent available: " + !!getParent(self));
            }
        }));

    const Parent = types
        .model("Parent", {
            child: Child
        })
        .actions((self) => ({
            afterCreate() {
                // **This the key line**: it is trying to access the child
                listener("new parent, child.title: " + self.child?.title);
            }
        }));

    const Store = types.model("Store", {
        parent: types.maybe(Parent)
    });

    const store = Store.create({
        parent: {
            child: { title: "Junior" }
        }
    });
    // As expected no hooks are called.
    // The `parent` is not accessed it is just loaded.
    events.push("-");

    // Simple access does a sensible thing
    // eslint-disable-next-line no-unused-expressions
    store.parent;
    expect(events).toEqual([
        "-",
        "new child: Junior",
        "new parent, child.title: Junior",
        "parent available: true"
    ]);

    // Clear the events and make a new store
    events.length = 0;
    const store2 = Store.create({
        parent: {
            child: { title: "Junior" }
        }
    });
    events.push("-");

    // Previously resolvePath would cause problems because the parent hooks
    // would be called before the child was fully created
    resolvePath(store2, "/parent/child");
    expect(events).toEqual([
        "-",
        "new child: Junior",
        "new parent, child.title: Junior",
        "parent available: true"
    ]);
  });

  test("lifecycle hooks are called immediately, not after the action batch", () => {
    const events: string[] = [];
    function log(e: string) {
      events.push(e);
    }

    const Child = types
      .model("Todo", {
        title: ""
      })
      .actions((self) => ({
        afterCreate() {
          log("child: afterCreate");
        },
        afterAttach() {
          log("child: afterAttach");
        }
      }));

    const Parent = types
        .model("Parent", {
            child: types.maybe(Child)
        })
        .actions((self) => ({
            addChild() {
              log("parent: before create");
              const child = Child.create();
              log("parent: before child assignment");
              self.child = child;
              log("parent: after child assignment");
            }
        }));

    log("-");

    const parent = Parent.create();
    parent.addChild();
    expect(events).toEqual([
        "-",
        "parent: before create",
        "child: afterCreate",
        "parent: before child assignment",
        "child: afterAttach",
        "parent: after child assignment"
      ]);
  });

  test("lifecycle hooks of snapshot children are delayed until they are accessed", () => {
    const events: string[] = [];
    function log(e: string) {
      events.push(e);
    }

    const Child = types
      .model("Todo", {
        title: ""
      })
      .actions((self) => ({
        afterCreate() {
          log("child: afterCreate");
        },
        afterAttach() {
          log("child: afterAttach");
        }
      }));

    const Parent = types
        .model("Parent", {
            child: types.maybe(Child)
        });

    log("before Parent.create");
    const parent = Parent.create({child: {title: "snapshot"}});

    log("before child access");
    // eslint-disable-next-line no-unused-expressions
    parent.child;

    expect(events).toEqual([
      "before Parent.create",
      "before child access",
      "child: afterCreate",
      "child: afterAttach",
    ]);
  });

  test("afterAttach of instance children in snapshots is called immediately", () => {
    const events: string[] = [];
    function log(e: string) {
      events.push(e);
    }

    const Child = types
      .model("Todo", {
        title: ""
      })
      .actions((self) => ({
        afterCreate() {
          log("child: afterCreate");
        },
        afterAttach() {
          log("child: afterAttach");
        }
      }));

    const Parent = types
        .model("Parent", {
            child: types.maybe(Child)
        });

    log("before Child.create");
    const child = Child.create();
    log("before Parent.create");
    const parent = Parent.create({child});
    log("before child access");
    // eslint-disable-next-line no-unused-expressions
    parent.child;

    expect(events).toEqual([
        "before Child.create",
        "child: afterCreate",
        "before Parent.create",
        "child: afterAttach",
        "before child access"
      ]);
  });

  test("volatile state can default to props from create call", () => {
    const TestObject = types
      .model("TestObject", {
        propValue: types.number
      })
      .volatile(self => ({
        volatileValue: self.propValue
      }))
      .actions(self => ({
        setPropValue(val: number) {
          self.propValue = val;
        },
        setVolatileValue(val: number) {
          self.volatileValue = val;
        }
      }));

    const testObj = TestObject.create({propValue: 5});
    expect(testObj.volatileValue).toBe(5);
    testObj.setPropValue(2);
    expect(testObj.volatileValue).toBe(5);
    testObj.setVolatileValue(8);
    expect(testObj.volatileValue).toBe(8);
    expect(testObj.propValue).toBe(2);


  });

  test("frozen props can be anything", () => {
    const TestObject = types
      .model("TestObject", {
        prop: types.frozen<any>()
      });

    expect(TestObject.create({prop: 1}).prop).toBe(1);
    const simpleObj = {"hi": "bye"};
    expect(TestObject.create({prop: simpleObj}).prop).toEqual(simpleObj);
    const complexObj = {"hi": {"more": ["stuff", "in"], "here": 1}};
    expect(TestObject.create({prop: complexObj}).prop).toEqual(complexObj);
  });

  /**
   * This is not used by our code currently, so if this test fails it is fine
   * to just update the test to document the behavior.
   */
  test("flow causes onSnapshot to be called before each yield", async () => {
    const TestObject = types.
      model("TestObject", {
        propValue: types.string
      })
      .actions(self => ({
        modifyValue: flow(function *(){
          self.propValue = "1";
          self.propValue = "2";
          yield new Promise((resolve) => setTimeout(resolve, 50));
          self.propValue = "3";
          self.propValue = "4";
          yield new Promise((resolve) => setTimeout(resolve, 50));
          self.propValue = "5";
          self.propValue = "6";
        })
      }));

    const testObject = TestObject.create({propValue: "0"});
    const log: any[] = [];
    const snapshotHandler = (snapshot: any) => {
      log.push(snapshot);
    };
    onSnapshot(testObject, snapshotHandler);
    await testObject.modifyValue();
    expect(log).toEqual([
      {propValue: "2"},
      {propValue: "4"},
      {propValue: "6"}
    ]);
  });

  test("empty create without required props throws exception", () => {
    const TestObject = types.
      model("TestObject", {
        propValue: types.string
      });

    expect(() => {
      TestObject.create();
    }).toThrow();
  });

  test("NaN is not handled correctly by number types", () => {
    const TestObject = types.
      model("TestObject", {
        propValue: types.number
      });

    const obj = TestObject.create({propValue: NaN});
    const snapshot = getSnapshot(obj);
    expect(snapshot).toEqual({propValue: NaN});

    const snapshotString = JSON.stringify(snapshot);
    expect(snapshotString).toEqual("{\"propValue\":null}");

    const rehydrated = JSON.parse(snapshotString);
    expect(rehydrated).toEqual({propValue: null});
  });

  test("preProcessSnapshot gets called with undefined in some cases", () => {
    let snapshotPassedToPreProcess = "Initial Value" as any;
    const TestObject = types
      .model("TestObject", {
        prop: types.optional(types.string, "default")
      })
      .preProcessSnapshot(snapshot => {
        snapshotPassedToPreProcess = snapshot;
        return snapshot;
      });

    const TestContainer = types.
      model("TestContainer", {
        child: types.maybe(TestObject)
      });

    const container1 = TestContainer.create({});
    expect(snapshotPassedToPreProcess).toBeUndefined();
    expect(container1.child).toBeUndefined();

    const container2 = TestContainer.create({child: {prop: "value"}});
    expect(snapshotPassedToPreProcess).toEqual({prop: "value"});
    expect(container2.child?.prop).toBe("value");

    const container3 = TestContainer.create({child: {}});
    expect(snapshotPassedToPreProcess).toEqual({});
    expect(container3.child?.prop).toBe("default");
  });

  test("preProcessSnapshot should return undefined to respect `types.maybe`", () => {
    let snapshotPassedToPreProcess = "Initial Value" as any;
    let valueReturnedByPreProcess: any;
    const TestObject = types
      .model("TestObject", {
        prop: types.string
      })
      .preProcessSnapshot(snapshot => {
        snapshotPassedToPreProcess = snapshot;
        return valueReturnedByPreProcess;
      });

    const TestContainer = types.
      model("TestContainer", {
        child: types.maybe(TestObject)
      });

    // Note: the MST type system doesn't want you to return undefined from preProcessSnapshot
    // but you have to if you want the child to be undefined as expected
    valueReturnedByPreProcess = undefined;
    const container1 = TestContainer.create({});
    expect(snapshotPassedToPreProcess).toBeUndefined();
    expect(container1.child).toBeUndefined();

    valueReturnedByPreProcess = {};
    const container2 = TestContainer.create({});
    expect(container2.child).toBeUndefined();

    valueReturnedByPreProcess = {prop: "value"};
    const container3 = TestContainer.create({});
    expect(container3.child?.prop).toBe("value");
  });

  test("preProcessSnapshot with an optional prop can also return `{}` to respect `types.maybe`", () => {
    let snapshotPassedToPreProcess = "Initial Value" as any;
    let valueReturnedByPreProcess: any;
    const TestObject = types
      .model("TestObject", {
        // This is different than the case above because this prop is optional
        prop: types.optional(types.string, "default")
      })
      .preProcessSnapshot(snapshot => {
        snapshotPassedToPreProcess = snapshot;
        return valueReturnedByPreProcess;
      });

    const TestContainer = types.
      model("TestContainer", {
        child: types.maybe(TestObject)
      });

    valueReturnedByPreProcess = undefined;
    const container1 = TestContainer.create({});
    expect(snapshotPassedToPreProcess).toBeUndefined();
    expect(container1.child).toBeUndefined();

    // This is different than the case above. Returning `{}` results in
    // a child object instead of undefined.
    valueReturnedByPreProcess = {};
    const container2 = TestContainer.create({});
    expect(container2.child?.prop).toBe("default");

    valueReturnedByPreProcess = {prop: "value"};
    const container3 = TestContainer.create({});
    expect(container3.child?.prop).toBe("value");
  });


});
