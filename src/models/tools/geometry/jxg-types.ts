export const isCommentType = (v: any) => v && v.getAttribute("clientType") === "comment";
export const isComment = (v: any) => isCommentType(v) && (v instanceof JXG.Text) && (v.elType === "text");
