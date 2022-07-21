import { action, autorun, makeObservable } from "mobx";
import { addDisposer, applySnapshot, getType, isAlive, types, getRoot, 
  isStateTreeNode, SnapshotOut, Instance, getParent, destroy, hasParent,
  getSnapshot, addMiddleware,
  createActionTrackingMiddleware2} from "mobx-state-tree";

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
      updateAllTodosWithManager(_manager: any) {
        _manager.managerUpdateAllTodos(self);
      },
      updateAllTodos() {
        self.todos.forEach(todo => {
          todo.setName("new list name");
        });
      }
    }));

    const MSTTodoManager = types.model({
    })
    .actions(self => ({
      managerUpdateAllTodos(list: Instance<typeof TodoList>) {
        list.todos.forEach(todo => {
          todo.setName("new manager name");
        });
      }
    }));

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

    // Main MST Tree
    const todoList = TodoList.create({
      todos: [
        { name: "todo 1" },
        { name: "todo 2" }
      ]
    });

    // Secondary MST Tree
    const mstManager = MSTTodoManager.create();    

    // Manager that is not using MST and actions
    const plainManager = {
      managerUpdateAllTodos(list: Instance<typeof TodoList>) {
        list.todos.forEach(todo => {
          todo.setName("new manager name");
        });
      }
    };

    // MobX Manager, so it could still use observability, but because
    // it isn't MST it doesn't mess up the middleware
    const mobxManager = new MobXTodoManager();

    const started : string[] = [];
    const finished : string[] = [];
    let topLevelCallId = 0;
    const middleware = createActionTrackingMiddleware2({
      filter(call) {
        // record all calls even if they already have an environment
        return true;
      },
      onStart(call) {
        if (!call.env) {
          call.env = { id: topLevelCallId };
          topLevelCallId++;
        }
        started.push(`${call.name}:${call.env.id}`);
      },
      onFinish(call) {   
        finished.push(`${call.name}:${call.env.id}`);     
      }
    });
    const disposer = addMiddleware(todoList, middleware, true);

    // Run an action in the Main Tree that does not pass through the secondary tree.
    todoList.updateAllTodos();

    expect(started).toEqual([
      "updateAllTodos:0",
      "setName:0",
      "setName:0"
    ]);

    // reset the tracking props
    started.length = 0;
    finished.length = 0;
    topLevelCallId = 0;

    // Run an action in the Main Tree that passes through the secondary tree.
    todoList.updateAllTodosWithManager(mstManager);

    expect(started).toEqual([
      "updateAllTodosWithManager:0",
      "setName:1",
      "setName:2"
    ]);

    // reset the tracking props
    started.length = 0;
    finished.length = 0;
    topLevelCallId = 0;

    // Run an action in the Main Tree that passes through the secondary tree.
    todoList.updateAllTodosWithManager(plainManager);

    expect(started).toEqual([
      "updateAllTodosWithManager:0",
      "setName:0",
      "setName:0"
    ]);

    // reset the tracking props
    started.length = 0;
    finished.length = 0;
    topLevelCallId = 0;

    // Run an action in the Main Tree that passes through the secondary tree.
    todoList.updateAllTodosWithManager(mobxManager);

    expect(started).toEqual([
      "updateAllTodosWithManager:0",
      "setName:0",
      "setName:0"
    ]);

    disposer();
  });
});
