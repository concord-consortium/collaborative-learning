import React from "react";
import { IAnyStateTreeNode, IAnyType, types, castToSnapshot } from "mobx-state-tree";
import { Editor, SlateEditor } from "@concord-consortium/slate-editor";
import { render } from "@testing-library/react";
import { ISharedModelManager, SharedModelType } from "../../../models/tools/shared-model";
import { TextContentModel, TextContentModelType } from "../../../models/tools/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { getOrFindSharedModel, updateAfterSharedModelChanges } from "./variables-text-content";
import { VariablesPlugin } from "./variables-plugin";

const TestContainer = types.model("TestContainer", {
  content: TextContentModel,
  variables: types.maybe(SharedVariables)
});

const makeSharedModelManager = (variables?: SharedVariablesType): ISharedModelManager => {
  return {
    isReady: true,
    findFirstSharedModelByType<IT extends IAnyType>(sharedModelType: IT): IT["Type"] | undefined {
      return variables;
    },
    addTileSharedModel(tileContentModel: IAnyStateTreeNode): SharedModelType | undefined {
      return variables;
    },
    removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
      // ignore this for now
    },
    getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[] {
      return variables ? [variables] : [];
    }
  };
};

// Note: in the diagram tests this method also sets up an onSnapshot listener to automatically
// update the content when the variables change. In this case we are manually triggering 
// the updates
const setupContainer = (content: TextContentModelType, variables?: SharedVariablesType) => {
  const sharedModelManager = makeSharedModelManager(variables);
  TestContainer.create(
    {content: castToSnapshot(content), variables: castToSnapshot(variables)},
    {sharedModelManager}
  );

  // So far it hasn't been necessary to wait for the MobX reaction to run inside of 
  // DocumentContent#afterAttach. It seems to run immediately in the line above, so 
  // we can write expectations on this content without waiting.
  return {content, sharedModelManager};
};

const createEditor = (textContent: TextContentModelType) => {
  let editorRef: Editor | undefined;
  // This creates an editor. It ignores any initial content from textContent.
  // It uses textContent to make a VariablesPlugin
  // This plugin is needed so Slate knows about the variables chips being added
  // to the editor. 
  const variablesPlugin = VariablesPlugin(textContent);
  render(<SlateEditor 
    onEditorRef={(ref?: Editor) => { editorRef = ref; }} 
    plugins={[variablesPlugin]} 
  />);
  return editorRef as Editor;
};

const getValueParagraphNodes = (editor: Editor) => {
  // for some reason the types don't match the structure returned by toJSON()
  return (editor.value.toJSON()?.document?.nodes?.[0] as any)?.nodes || [];
};

describe("VariablesTextContent", () => {
  test("updateAfterSharedModelChanges updates the text content", () => {    
    const textContent = TextContentModel.create({});
    const variables = SharedVariables.create({
      variables: [
        {
          id: "variable1",
          name: "test variable"          
        }
      ]
    });
    setupContainer(textContent, variables);
    const editor = createEditor(textContent);
    textContent.setEditor(editor);

    const initialNodes: any = [
      {
        marks: [],
        object: "text",
        text: "",
      }
    ];

    const withVariableNodes: any = [
      {
        marks: [],
        object: "text",
        text: " ",
      },
      {
        data: {
          reference: "variable1",
        },
        nodes: [
          {
            marks: [],
            object: "text",
            text: "",
          },
        ],
        object: "inline",
        type: "m2s-variable",
      },
      {
        marks: [],
        object: "text",
        text: "",
      }
    ];

    // TODO: the fact that there is a space here after removing
    // the variable should probably be fixed.
    const afterRemoveNodes: any = [
      {
        marks: [],
        object: "text",
        text: " ",
      }
    ];

    expect(getValueParagraphNodes(editor)).toMatchObject(initialNodes);

    // add variable to the text
    editor.command("addVariable", {reference: "variable1"});

    expect(getValueParagraphNodes(editor)).toMatchObject(withVariableNodes);

    // Make sure it doesn't change when we haven't changed the variables
    updateAfterSharedModelChanges(textContent);
    expect(getValueParagraphNodes(editor)).toMatchObject(withVariableNodes);

    // Make sure it doesn't change when we add a new variable that isn't referenced
    variables.createVariable();
    updateAfterSharedModelChanges(textContent);
    expect(getValueParagraphNodes(editor)).toMatchObject(withVariableNodes);

    // It should change after removing the variable that we references
    variables.removeVariable(variables.variables[0]);
    updateAfterSharedModelChanges(textContent);
    expect(getValueParagraphNodes(editor)).toMatchObject(afterRemoveNodes);
  });

  test("updateAfterSharedModelChanges handles no editor", () => {    
    const textContent = TextContentModel.create({});
    const variables = SharedVariables.create({
      variables: [
        {
          id: "variable1",
          name: "test variable"          
        }
      ]
    });
    setupContainer(textContent, variables);

    expect(() => {
      updateAfterSharedModelChanges(textContent);
    }).not.toThrow();
  });

  test("getOrFindSharedModel warns if things aren't setup", async () => {
    const textContent = TextContentModel.create({});

    await jestSpyConsole("warn", mockConsole => {
      getOrFindSharedModel(textContent);
      expect(mockConsole).toBeCalled();
    });

    // setup the environment without a shared model
    setupContainer(textContent);
    
    await jestSpyConsole("warn", mockConsole => {
      getOrFindSharedModel(textContent);
      expect(mockConsole).toBeCalled();
    });
  });

  test("getOrFindSharedModel adds the shared model to the tile", async () => {
    const textContent = TextContentModel.create({});
    const variables = SharedVariables.create();

    // setup the environment without a shared model
    const {sharedModelManager} = setupContainer(textContent, variables);
    
    // override getTileSharedModels so it always returns undefined
    sharedModelManager.getTileSharedModels = jest.fn();
    const addSharedModelSpy = jest.spyOn(sharedModelManager, "addTileSharedModel");

    getOrFindSharedModel(textContent);

    expect(addSharedModelSpy).toHaveBeenCalled();
  });
});
