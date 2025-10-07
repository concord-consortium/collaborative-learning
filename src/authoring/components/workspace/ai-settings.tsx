
import React, { useMemo } from "react";
import { useForm, SubmitHandler, useFieldArray } from "react-hook-form";

import { AIEvaluation, Summarizer } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";

interface CommentTag {
  label: string;
  display: string;
}

interface AISettingsFormInputs {
  tagPrompt: string;
  commentTags: CommentTag[];
  aiEvaluation: AIEvaluation;
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

const AISettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const settings: AISettingsFormInputs = useMemo(() => {
    const { tagPrompt, aiEvaluation, commentTags: rawCommentTags, aiPrompt } = unitConfig?.config || {};

    const commentTags: CommentTag[] = !rawCommentTags
      ? []
      : Object.entries(rawCommentTags).map(([label, display]) => ({ label, display }));

    // TODO: figure out how to determine these
    const aiTileAvailable = false;
    const showIdeasButton = false;

    return {
      tagPrompt: tagPrompt ?? "",
      commentTags: commentTags ?? [],
      aiEvaluation: aiEvaluation as AIEvaluation ?? "categorize-design",
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

  const { handleSubmit, register, control, formState: { errors } } = useForm<AISettingsFormInputs>({
    defaultValues: settings
  });
  const commentTagsFieldArray = useFieldArray({ control, name: "commentTags" });

  const onSubmit: SubmitHandler<AISettingsFormInputs> = (data) => {
    setUnitConfig(draft => {
      const config = draft?.config;
      if (config) {
        config.tagPrompt = data.tagPrompt;
        config.aiEvaluation = data.aiEvaluation;
        config.commentTags = data.commentTags.reduce((obj, tag) => {
          if (tag.label && tag.display) {
            obj[tag.label] = tag.display;
          }
          return obj;
        }, {} as Record<string, string>);

        if (!config.aiPrompt) {
          // create new aiPrompt object with categories initialized to empty array
          // since categories are not authorable here
          config.aiPrompt = { ...data.aiPrompt, categories: [] };
        } else {
          const aiPrompt = config.aiPrompt;
          const {
            systemPrompt, mainPrompt, categorizationDescription,
            keyIndicatorsPrompt, discussionPrompt, summarizer
          } = data.aiPrompt;
          aiPrompt.systemPrompt = systemPrompt;
          aiPrompt.mainPrompt = mainPrompt;
          aiPrompt.categorizationDescription = categorizationDescription;
          aiPrompt.keyIndicatorsPrompt = keyIndicatorsPrompt;
          aiPrompt.discussionPrompt = discussionPrompt;
          aiPrompt.summarizer = summarizer;
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="tabLabel">Tag Prompt</label>
        <input
          type="text"
          id="tabLabel"
          defaultValue={settings.tagPrompt}
          {...register("tagPrompt", { required: "Tag prompt is required" })}
        />
        {errors.tagPrompt && <span>{errors.tagPrompt.message}</span>}
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
                    {...register(`commentTags.${index}.label`, { required: "Required" })}
                    defaultValue={tag.label}
                  />
                  {errors.commentTags?.[index]?.label && <span>{errors.commentTags?.[index]?.label?.message}</span>}
                </div>
              </td>
              <td>
                <div className="vertical left">
                  <input
                    type="text"
                    {...register(`commentTags.${index}.display`, { required: "Required" })}
                    defaultValue={tag.display}
                  />
                  {errors.commentTags?.[index]?.display && <span>{errors.commentTags?.[index]?.display?.message}</span>}
                </div>
              </td>
              <td className="narrow">
                <button type="button" onClick={() => {
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
            disabled={true}
          /> <span style={{textDecoration: "line-through"}}>Add to titlebar</span> (TBD in future PR)

        </div>
        <div>
          <label htmlFor="aiTileAvailable">AI Tile</label>
          <input
            type="checkbox"
            {...register("aiTileAvailable")}
            disabled={true}
          /> <span style={{textDecoration: "line-through"}}>Add to toolbar</span> (TBD in future PR)
        </div>
      </div>
      <div>
        <label htmlFor="aiEvaluation">AI Evaluation Style</label>
        <select
          id="aiEvaluation"
          defaultValue={settings.aiEvaluation}
          {...register("aiEvaluation", { required: "AI Evaluation is required" })}
        >
          <option value="custom">Custom</option>
          <option value="categorize-design">Categorize Design</option>
        </select>
        {errors.aiEvaluation && <span>{errors.aiEvaluation.message}</span>}
      </div>
      <div>
        <label>Content Summarizer</label>
        <select
          id="summarizer"
          defaultValue={settings.aiPrompt.summarizer}
          {...register("aiPrompt.summarizer", { required: "Summarizer is required" })}
        >
          <option value="image">Image of Content</option>
          <option value="text">Text Summary of Content</option>
        </select>
        {errors.aiPrompt?.summarizer && <span>{errors.aiPrompt?.summarizer?.message}</span>}
      </div>
      <div>
        <label htmlFor="systemPrompt">System Prompt</label>
        <textarea
          id="systemPrompt"
          defaultValue={settings.aiPrompt.systemPrompt}
          {...register("aiPrompt.systemPrompt", { required: "System prompt is required" })}
        />
        {errors.aiPrompt?.systemPrompt && <span>{errors.aiPrompt?.systemPrompt?.message}</span>}
      </div>
      <table>
        <tbody>
          <tr>
            <td className="left">
              <label htmlFor="mainPrompt">Main Prompt</label>
              <textarea
                id="mainPrompt"
                defaultValue={settings.aiPrompt.mainPrompt}
                {...register("aiPrompt.mainPrompt", { required: "Main prompt is required" })}
              />
              {errors.aiPrompt?.mainPrompt && <span>{errors.aiPrompt?.mainPrompt?.message}</span>}
            </td>
            <td className="left">
              <label htmlFor="categorizationDescription">Categorization Description</label>
              <textarea
                id="categorizationDescription"
                defaultValue={settings.aiPrompt.categorizationDescription}
                {...register("aiPrompt.categorizationDescription", {
                  required: "Categorization description is required"
                })}
              />
              {errors.aiPrompt?.categorizationDescription && (
                <span>
                  {errors.aiPrompt?.categorizationDescription?.message}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className="left">
              <label htmlFor="keyIndicatorsPrompt">Key Indicators Prompt</label>
              <textarea
                id="keyIndicatorsPrompt"
                defaultValue={settings.aiPrompt.keyIndicatorsPrompt}
                {...register("aiPrompt.keyIndicatorsPrompt", {
                  required: "Key indicators prompt is required"
                })}
              />
              {errors.aiPrompt?.keyIndicatorsPrompt && <span>{errors.aiPrompt?.keyIndicatorsPrompt?.message}</span>}
            </td>
            <td className="left">
              <label htmlFor="discussionPrompt">Discussion Prompt</label>
              <textarea
                id="discussionPrompt"
                defaultValue={settings.aiPrompt.discussionPrompt}
                {...register("aiPrompt.discussionPrompt", { required: "Discussion prompt is required" })}
              />
              {errors.aiPrompt?.discussionPrompt && <span>{errors.aiPrompt?.discussionPrompt?.message}</span>}
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
