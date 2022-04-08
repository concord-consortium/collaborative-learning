import { castToSnapshot, getSnapshot, isAlive, types } from "mobx-state-tree";
import { when } from "mobx";
import { defaultDiagramContent, DiagramContentModel } from "./diagram-content";

const TestContainer = types.model("TestContainer", {
  content: DiagramContentModel
});

describe("DiagramContent", () => {
  it("has default content", () => {
    const content = defaultDiagramContent();
    expect(content.root).toBeDefined();
  });

  it("can export content", () => {
    const content = DiagramContentModel.create();
    const expected = JSON.stringify({nodes: {}});
    expect(content.exportJson()).toEqual(expected);
  });

  it("is always user resizable", () => {
    const content = DiagramContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("sets up variables api after being attached", () => {
    const content = DiagramContentModel.create();
    const container = TestContainer.create({content: castToSnapshot(content)});
    expect(container.content.root.variablesAPI).toBeDefined();
  });

  // This is more of an integration test because it is testing the innards of 
  // DQRoot, but it exercises code provided by the diagram-content in the process
  it("supports creating Nodes", () => {
    const content = DiagramContentModel.create();
    // TODO: With the current structure we need to basically make a full document
    // to test this, otherwise DiagramContentModel won't find the shared models
    // However we want to change that anyway to support embedding this in an
    // iframe
    // Maybe we can make it work with just a ToolTileModel
    TestContainer.create({content: castToSnapshot(content)});

    expect(content.root.nodes.size).toBe(0);
    expect(content.sharedModel?.variables.length).toBe(0);

    content.root.createNode({x: 1, y: 1});
    expect(content.root.nodes.size).toBe(1);
    const newNode = Array.from(content.root.nodes.values())[0]; 
    assertIsDefined(newNode);

    expect(content.sharedModel?.variables.length).toBe(1);
    expect(newNode.x).toBe(1);
    expect(newNode.variable).toBeDefined();
  });

  it("createVariable in the variables api adds a variable", () => {
    const content = DiagramContentModel.create();
    const container = TestContainer.create({content: castToSnapshot(content)});
    const variablesAPI = container.content.root.variablesAPI;
    assertIsDefined(variablesAPI);

    const variable = variablesAPI.createVariable();
    expect(variable).toBeDefined();
  });

  // TODO: we have to provide a shared model defined at the document level
  const createBasicModel = () => {
    const content = DiagramContentModel.create({
      root: {
        nodes: {
          "node1": {
            x: 1,
            y: 1,
            variable: "variable1"
          }
        }
      },
    });
    const container = TestContainer.create({content: castToSnapshot(content)});
    return container.content;
  };

  it("can handle basic de-serialization", () => {
    const content = createBasicModel();

    expect(content.root.nodes.size).toBe(1);
    const firstNode = Array.from(content.root.nodes.values())[0]; 
    assertIsDefined(firstNode);

    expect(content.sharedModel?.variables.length).toBe(1);
    expect(firstNode.variable).toBeDefined();
  });

  it("removeVariable in the variables api removes a variable", (done) => {
    const content = createBasicModel();
    const variablesAPI = content.root.variablesAPI;
    assertIsDefined(variablesAPI);

    const firstNode = Array.from(content.root.nodes.values())[0]; 
    assertIsDefined(firstNode);

    variablesAPI.removeVariable(firstNode.variable);

    // Need to wait for the variable and node to be removed, we use mobx's `when` for this.
    // It should monitor the nodes size and run the predicate when it goes back to 0
    // when it is done we call Jest's `done`. By default Jest will wait 5 seconds for the
    // done to be called.
    when(() => content.root.nodes.size === 0, () => {
      expect(content.sharedModel?.variables.length).toBe(0);
      expect(isAlive(firstNode)).toBeFalsy();
      done();
    });
  });
});
