import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler, useFieldArray, useController } from "react-hook-form";
import { capitalize } from "lodash";

import { CommentRole, commentRoles } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";

interface CommentTag {
  label: string;
  display: string;
}

interface CommentsSettingsFormInputs {
  showCommentTag: boolean;
  allowCustomCommentTags: boolean;
  enableCommentRoles: CommentRole[];
  showCommentRating: boolean;
  commentTags: CommentTag[];
}

// Comment/tag authoring lives on its own page (split out of AI Settings). The AI Settings page
// keeps only the aiEvaluation/aiPrompt fields; the AI category list continues to mirror the tag
// list, so we keep that mirror in this page's submit handler.
const CommentsSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();

  const formDefaults: CommentsSettingsFormInputs = useMemo(() => {
    const cfg = unitConfig?.config;
    const rawCommentTags = cfg?.commentTags;
    const commentTags: CommentTag[] = rawCommentTags
      ? Object.entries(rawCommentTags).map(([label, display]) => ({ label, display }))
      : [];
    return {
      showCommentTag: cfg?.showCommentTag ?? false,
      allowCustomCommentTags: cfg?.allowCustomCommentTags ?? false,
      enableCommentRoles: cfg?.enableCommentRoles ?? [],
      showCommentRating: cfg?.showCommentRating ?? true,
      commentTags,
    };
  }, [unitConfig]);

  const { handleSubmit, register, control, reset, watch, formState: { errors } } =
    useForm<CommentsSettingsFormInputs>({ defaultValues: formDefaults, mode: "onChange" });
  const commentTagsFieldArray = useFieldArray({ control, name: "commentTags" });
  const { field: { value: selectedCommentRoles = [], onChange: setCommentRoles } } =
    useController({ name: "enableCommentRoles", control });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const showCommentTag = watch("showCommentTag");

  const onSubmit: SubmitHandler<CommentsSettingsFormInputs> = (data) => {
    setUnitConfig(draft => {
      const config = draft?.config;
      if (!config) return;
      config.showCommentTag = data.showCommentTag;
      if (data.allowCustomCommentTags) {
        config.allowCustomCommentTags = true;
      } else {
        delete config.allowCustomCommentTags;
      }
      config.enableCommentRoles = data.enableCommentRoles;
      config.showCommentRating = data.showCommentRating;
      config.commentTags = data.commentTags.reduce((obj, tag) => {
        if (tag.label && tag.display) {
          obj[tag.label] = tag.display;
        }
        return obj;
      }, {} as Record<string, string>);
      // Keep the AI category list mirrored to the tag list (AI Settings used to do this).
      if (config.aiPrompt) {
        config.aiPrompt.categories = Object.keys(config.commentTags);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="comments-settings">
      <h3>Comments</h3>
      <p className="muted">
        Configure the comments panel and comment tags for this unit.
      </p>

      <fieldset>
        <legend>Comment Tags</legend>
        <label className="horizontal middle">
          <input type="checkbox" {...register("showCommentTag")} />
          <span>Show comment tags</span>
        </label>
        <label className="horizontal middle">
          <input type="checkbox" {...register("allowCustomCommentTags")} disabled={!showCommentTag} />
          <span>Allow teachers to add custom tags</span>
        </label>
        <p className="muted small">
          When enabled, teachers can add their own comment tags for their class (in addition to
          the tags below). Requires &quot;Show comment tags&quot;. Default off.
        </p>
      </fieldset>

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
        <label className="horizontal middle">
          <input type="checkbox" {...register("showCommentRating")} />
          <span>Show agree/disagree rating buttons on comments</span>
        </label>
      </fieldset>

      <table>
        <thead>
          <tr>
            <th>Tag Label</th>
            <th>Tag Display</th>
          </tr>
        </thead>
        <tbody>
          {commentTagsFieldArray.fields.map((tag, index) => (
            <tr key={tag.id}>
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

      <div className="bottomButtons">
        <button
          aria-busy={saveState === "saving"}
          disabled={saveState === "saving"}
          type="submit"
        >
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};

export default CommentsSettings;
