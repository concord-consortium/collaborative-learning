
import React, { useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import "./exemplar-metadata.scss";

interface Props {
  title: string;
  tag: string;
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
          <div className="vertical  wide">
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
            <input
              defaultValue={settings.tag}
              {...register("tag", { required: "Tag is required" })}
            />
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
