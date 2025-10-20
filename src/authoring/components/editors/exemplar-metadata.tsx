
import React, { useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import "./exemplar-metadata.scss";

interface Props {
  title: string;
  tag: string;
  tags: string[];
  onChange: (metadata: any) => void;
}

interface ExemplarMetadataFormInputs {
  title: string;
  tag: string;
}

const ExemplarMetadata: React.FC<Props> = (props) => {
  const settings: ExemplarMetadataFormInputs = useMemo(() => ({
    title: props.title || "",
    tag: props.tag || "",
  }), [props]);

  const { handleSubmit, register, formState: { errors } } = useForm<ExemplarMetadataFormInputs>();

  const onSubmit: SubmitHandler<ExemplarMetadataFormInputs> = (data) => {
    props.onChange(data);
  };

  return (
    <div className="exemplar-metadata-container">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="horizontalGroup">
          <div className="vertical wide">
            <label htmlFor="title">Title</label>
            <input
              defaultValue={settings.title}
              autoFocus
              {...register("title", { required: "Title is required" })}
            />
            {errors.title && <div className="error">{errors.title.message}</div>}
          </div>
          <div className="vertical wide">
            <label htmlFor="tag">Tag</label>
            {props.tags.length === 0 && (
              <div>No tags available (add them in the AI Settings page)</div>
            )}
            {props.tags.length > 0 && (
              <select
                defaultValue={settings.tag}
                {...register("tag", { required: "Tag is required" })}
              >
                {props.tags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            {errors.tag && <div className="error">{errors.tag.message}</div>}
          </div>
        </div>
        <div>
          <button type="submit">Save Exemplar Metadata</button>
        </div>
      </form>
    </div>
  );
};

export default ExemplarMetadata;
