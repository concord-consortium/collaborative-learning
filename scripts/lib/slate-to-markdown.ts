// TODO: This is a copy of the shared/slate-to-markdown.ts file.
// Importing from shared fails in the offline script context.
// Doug suggests: create an npm script to build/package the ai-summarizer.ts file into a standalone bundle with
// a .d.ts file emitted so that you could then import it as javascript into the scripts folder.
// That would fix all the module import errors.



type SlateNode =
  | {
      object: 'value';
      document: { object: 'document'; data: any; nodes: SlateNode[] };
    }
  | {
      object: 'document';
      data: any;
      nodes: SlateNode[];
    }
  | {
      object: 'block';
      type: string;
      data?: any;
      nodes: SlateNode[];
    }
  | {
      object: 'text';
      text: string;
      marks?: { type: string }[];
    }
  | {
      type: string;
      children: SlateNode[];
      text?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      code?: boolean;
      tag?: string;
    };

export function slateToMarkdown(slateText: any): string {
  let input: any;
  try {
    input = JSON.parse(slateText);
  } catch (error) {
    throw new Error("Invalid Slate document format");
  }
  const document = input.document;
  if (!document || !(document.nodes || document.children)) {
    throw new Error("Invalid Slate document format");
  }

  const lines: string[] = [];
  const children = document.nodes || document.children;

  for (const node of children) {
    lines.push(serializeNode(node).trim());
  }

  return lines.join('\n\n').trim();
}

function serializeNode(node: any): string {
  if (node.object === 'text' && typeof node.text === 'string') {
    return applyMarks(node.text, node.marks || []);
  }

  if (node.text && typeof node.text === 'string') {
    return applyInlineFormatting(node);
  }

  const children = (node.nodes || node.children || []).map(serializeNode).join('');

  switch (node.type) {
    case 'paragraph':
    case 'line':
      return children;
    case 'heading-one':
      return `# ${children}`;
    case 'heading-two':
      return `## ${children}`;
    case 'block-quote':
      return `> ${children}`;
    case 'bulleted-list':
      return (node.nodes || node.children || [])
        .map((li: any) => `- ${serializeNode(li)}`)
        .join('\n');
    case 'numbered-list':
      return (node.nodes || node.children || [])
        .map((li: any, i: number) => `${i + 1}. ${serializeNode(li)}`)
        .join('\n');
    case 'list-item':
      return children;
    case 'code-block':
      return `\`\`\`\n${children}\n\`\`\``;
    case 'link':
      return `[${children}](${node.data?.href || '#'})`;
    case 'highlight':
      return `==${children}==`;
    default:
      return children;
  }
}

function applyMarks(text: string, marks: { type: string }[]): string {
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
    }
  }
  return result;
}

function applyInlineFormatting(node: any): string {
  let text = node.text || '';
  if (node.bold) text = `**${text}**`;
  if (node.italic) text = `*${text}*`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.code) text = `\`${text}\``;
  return text;
}

// Normalizer for "children" format
function normalizeChildren(document: any): any {
  if (!document.children) return document;

  return {
    object: 'document',
    data: {},
    nodes: document.children,
  };
}
