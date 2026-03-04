
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch, SubmitHandler, useFieldArray, useController } from "react-hook-form";
import { WritableDraft } from "immer";
import { capitalize } from "lodash";

import { AIEvaluation, CommentRole, commentRoles, IAuthorTool, Summarizer } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";
import { kAITileType } from "../../../plugins/ai/ai-types";

interface CommentTag {
  label: string;
  display: string;
}

interface AISettingsFormInputs {
  commentTags: CommentTag[];
  enableCommentRoles: CommentRole[];
  aiEvaluation?: AIEvaluation | "";
  aiPrompt: {
    systemPrompt: string;
    mainPrompt: string;
    categorizationDescription: string;
    keyIndicatorsPrompt: string;
    discussionPrompt: string;
    summarizer: Summarizer;
  },
  aiTileAvailable: boolean;
  showIdeasButton: boolean;
}

const isAIAuthorTool = (tool: IAuthorTool | WritableDraft<IAuthorTool>) => {
  return tool.id === kAITileType && tool.isTileTool;
};

const AISettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const settings: AISettingsFormInputs = useMemo(() => {
    const {
      aiEvaluation,
      commentTags: rawCommentTags,
      enableCommentRoles,
      aiPrompt
    } = unitConfig?.config || {};

    const commentTags: CommentTag[] = !rawCommentTags
      ? []
      : Object.entries(rawCommentTags).map(([label, display]) => ({ label, display }));

    // To allow for legacy configurations that do not have showIdeasButton set
    // we will continue to use the existing logic based on aiEvaluation
    // to determine if the ideas button is shown unless showIdeasButton
    // is explicitly set in the configuration
    const showIdeasButton = unitConfig?.config?.showIdeasButton !== undefined
      ? unitConfig.config.showIdeasButton
      : !!aiEvaluation;

    const aiTileAvailable = unitConfig?.config?.authorTools?.find(tool => isAIAuthorTool(tool)) !== undefined;

    return {
      commentTags: commentTags ?? [],
      enableCommentRoles: enableCommentRoles ?? [],
      aiEvaluation,
      aiPrompt: {
        systemPrompt: aiPrompt?.systemPrompt ?? "",
        mainPrompt: aiPrompt?.mainPrompt ?? "",
        categorizationDescription: aiPrompt?.categorizationDescription ?? "",
        keyIndicatorsPrompt: aiPrompt?.keyIndicatorsPrompt ?? "",
        discussionPrompt: aiPrompt?.discussionPrompt ?? "",
        summarizer: (aiPrompt?.summarizer ?? "image") as Summarizer,
      },
      aiTileAvailable,
      showIdeasButton
    };
  }, [unitConfig]);

  const { handleSubmit, register, control, trigger, formState: { errors } } = useForm<AISettingsFormInputs>({
    defaultValues: settings,
    mode: "onChange",
  });
  const commentTagsFieldArray = useFieldArray({ control, name: "commentTags" });

  const { field: { value: selectedCommentRoles = [], onChange: setCommentRoles } } = useController({
    name: "enableCommentRoles",
    control
  });

  // listen for changes to aiEvaluation so we can enable/disable related fields
  const currentAiEvaluation = useWatch({ control, name: "aiEvaluation" });

  // disable AI-related fields if aiEvaluation is not set in initial settings
  const [disableAiFields, setDisableAiFields] = useState(settings.aiEvaluation !== "custom");

  // when aiEvaluation changes, revalidate the form to ensure required fields are filled in
  useEffect(() => {
    setDisableAiFields(currentAiEvaluation !== "custom");

    // since the validations use the current value of disableAiFields
    // we need to wait until after the state has been updated
    // before triggering the validations
    setTimeout(() => {
      trigger("aiPrompt.discussionPrompt");
      trigger("aiPrompt.keyIndicatorsPrompt");
      trigger("aiPrompt.categorizationDescription");
      trigger("aiPrompt.mainPrompt");
      trigger("aiPrompt.systemPrompt");
      trigger("aiPrompt.summarizer");
    }, 0);
  }, [currentAiEvaluation, trigger]);

  const validateAiFields = useCallback((value: string) => {
    if (disableAiFields) {
      return true;
    }
    return value.trim() !== "" || "This field is required when AI Evaluation Style is set";
  }, [disableAiFields]);

  const onSubmit: SubmitHandler<AISettingsFormInputs> = (data) => {
    setUnitConfig(draft => {
      const config = draft?.config;
      if (config) {
        config.aiEvaluation = data.aiEvaluation === "" ? undefined : data.aiEvaluation;
        config.commentTags = data.commentTags.reduce((obj, tag) => {
          if (tag.label && tag.display) {
            obj[tag.label] = tag.display;
          }
          return obj;
        }, {} as Record<string, string>);
        config.enableCommentRoles = data.enableCommentRoles;

        const categories = Object.keys(config.commentTags);

        if (!config.aiPrompt) {
          config.aiPrompt = { ...data.aiPrompt, categories };
        } else {
          const aiPrompt = config.aiPrompt;
          const {
            systemPrompt, mainPrompt, categorizationDescription,
            keyIndicatorsPrompt, discussionPrompt, summarizer
          } = data.aiPrompt;
          aiPrompt.systemPrompt = systemPrompt;
          aiPrompt.mainPrompt = mainPrompt;
          aiPrompt.categorizationDescription = categorizationDescription;
          aiPrompt.categories = categories;
          aiPrompt.keyIndicatorsPrompt = keyIndicatorsPrompt;
          aiPrompt.discussionPrompt = discussionPrompt;
          aiPrompt.summarizer = config.aiEvaluation === "categorize-design" ? "image" : summarizer;
        }

        if (data.aiTileAvailable) {
          if (!config.authorTools) {
            config.authorTools = [];
          }
          if (!config.authorTools.find(tool => isAIAuthorTool(tool))) {
            config.authorTools.push({
              id: kAITileType,
              title: "AI",
              isTileTool: true
            });
          }
        } else {
          if (config.authorTools) {
            config.authorTools = config.authorTools.filter(tool => !isAIAuthorTool(tool));
          }
        }

        if (data.showIdeasButton !== undefined) {
          config.showIdeasButton = data.showIdeasButton;
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <fieldset>
          <legend>Users that can use the comments panel (Enable Comment Roles)</legend>
          <div className="horizontalGroup">
            {commentRoles.map(role => (
              <label key={role} className="horizontal middle">
                <input
                  type="checkbox"
                  checked={selectedCommentRoles.includes(role)}
                  onChange={() => {
                    setCommentRoles(
                      selectedCommentRoles.includes(role)
                        ? selectedCommentRoles.filter(r => r !== role)
                        : [...selectedCommentRoles, role]
                    );
                  }}
                />
                <span>{capitalize(role)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tag Label</th>
            <th>Tag Display</th>
          </tr>
        </thead>
        <tbody>
          {commentTagsFieldArray.fields.map((tag, index) => (
            <tr key={index}>
              <td>
                <div className="vertical left">
                  <input
                    type="text"
                    {...register(`commentTags.${index}.label`, {
                      required: "Required",
                      validate: value => !/\s/.test(value) || "No spaces allowed"
                    })}
                    value={tag.label}
                    onChange={e => {
                      // Remove spaces as user types
                      const newValue = e.target.value.replace(/\s/g, "");
                      commentTagsFieldArray.update(index, { ...tag, label: newValue });
                    }}
                  />
                  {errors.commentTags?.[index]?.label &&
                    <span className="form-error">{errors.commentTags?.[index]?.label?.message}</span>
                  }
                </div>
              </td>
              <td>
                <div className="vertical left">
                  <input
                    type="text"
                    {...register(`commentTags.${index}.display`, { required: "Required" })}
                    defaultValue={tag.display}
                  />
                  {errors.commentTags?.[index]?.display &&
                    <span className="form-error">{errors.commentTags?.[index]?.display?.message}</span>
                  }
                </div>
              </td>
              <td className="narrow">
                <button type="button" className="danger" onClick={() => {
                  if (confirm("Are you sure you want to delete this tag?")) {
                    commentTagsFieldArray.remove(index);
                  }
                }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="left" style={{paddingTop: 10}}>
              <button type="button" onClick={() => commentTagsFieldArray.append({ label: "", display: "" })}>
                Add Tag
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="horizontalGroup">
        <div>
          <label htmlFor="showIdeasButton">Show Ideas Button</label>
          <input
            type="checkbox"
            {...register("showIdeasButton")}
          /> Add to titlebar
        </div>
        <div>
          <label htmlFor="aiTileAvailable">AI Tile</label>
          <input
            type="checkbox"
            {...register("aiTileAvailable")}
          /> Add AI tile to authoring toolbar
        </div>
      </div>
      <div>
        <label htmlFor="aiEvaluation">AI Evaluation Method</label>
        <select
          id="aiEvaluation"
          defaultValue={settings.aiEvaluation}
          {...register("aiEvaluation")}
        >
          <option value="">None</option>
          <option value="custom">Custom</option>
          <option value="categorize-design">Categorize Design</option>
        </select>
        {errors.aiEvaluation && <span className="form-error">{errors.aiEvaluation.message}</span>}
      </div>
      <div>
        <label>Format Of Content Sent To AI</label>
        <select
          id="summarizer"
          defaultValue={settings.aiPrompt.summarizer}
          {...register("aiPrompt.summarizer", {
            validate: validateAiFields
          })}
          disabled={disableAiFields}
        >
          <option value="image">Image of Content</option>
          <option value="text">Text Summary of Content</option>
        </select>
        {errors.aiPrompt?.summarizer && <span className="form-error">{errors.aiPrompt?.summarizer?.message}</span>}
      </div>
      <div>
        <label htmlFor="systemPrompt">System Prompt</label>
        <textarea
          id="systemPrompt"
          defaultValue={settings.aiPrompt.systemPrompt}
          {...register("aiPrompt.systemPrompt", {
            validate: validateAiFields
          })}
          disabled={disableAiFields}
        />
        {errors.aiPrompt?.systemPrompt && <span className="form-error">{errors.aiPrompt?.systemPrompt?.message}</span>}
      </div>
      <table>
        <tbody>
          <tr>
            <td className="left">
              <div className="stacked">
                <label htmlFor="mainPrompt">Main Prompt</label>
                <textarea
                  id="mainPrompt"
                  defaultValue={settings.aiPrompt.mainPrompt}
                  {...register("aiPrompt.mainPrompt", {
                    validate: validateAiFields
                  })}
                  disabled={disableAiFields}
                />
                {errors.aiPrompt?.mainPrompt &&
                  <span className="form-error">{errors.aiPrompt?.mainPrompt?.message}</span>
                }
              </div>
            </td>
            <td className="left">
              <div className="stacked">
                <label htmlFor="categorizationDescription">Categorization Description</label>
                <textarea
                  id="categorizationDescription"
                  defaultValue={settings.aiPrompt.categorizationDescription}
                  {...register("aiPrompt.categorizationDescription", {
                    validate: validateAiFields
                  })}
                  disabled={disableAiFields}
                />
                {errors.aiPrompt?.categorizationDescription && (
                  <span className="form-error">
                    {errors.aiPrompt?.categorizationDescription?.message}
                  </span>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td className="left">
              <div className="stacked">
                <label htmlFor="keyIndicatorsPrompt">Key Indicators Prompt</label>
                <textarea
                  id="keyIndicatorsPrompt"
                  defaultValue={settings.aiPrompt.keyIndicatorsPrompt}
                  {...register("aiPrompt.keyIndicatorsPrompt", {
                    validate: validateAiFields
                  })}
                  disabled={disableAiFields}
                />
                {errors.aiPrompt?.keyIndicatorsPrompt &&
                  <span className="form-error">{errors.aiPrompt?.keyIndicatorsPrompt?.message}</span>
                }
              </div>
            </td>
            <td className="left">
              <div className="stacked">
                <label htmlFor="discussionPrompt">Discussion Prompt</label>
                <textarea
                  id="discussionPrompt"
                  defaultValue={settings.aiPrompt.discussionPrompt}
                  {...register("aiPrompt.discussionPrompt", {
                    validate: validateAiFields
                  })}
                  disabled={disableAiFields}
                />
                {errors.aiPrompt?.discussionPrompt &&
                  <span className="form-error">{errors.aiPrompt?.discussionPrompt?.message}</span>
                }
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="bottomButtons">
        <button type="submit" disabled={saveState === "saving"}>Save</button>
      </div>
    </form>
  );
};

export default AISettings;
