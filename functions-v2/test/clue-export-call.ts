import {clueExport} from "../src/clue-export";

export interface Answer {
  status: number;
  body: any;
}

export interface CallOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: any;
  body?: any;
}

// Runs the HTTPS handler on a hand-built request and response, with no functions emulator.
export const callClueExport = async (options: CallOptions) => {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.headers ?? {})) headers[name.toLowerCase()] = value;
  const req: any = {
    method: options.method ?? "POST",
    headers,
    query: options.query ?? {},
    body: options.body,
    get: (name: string) => headers[name.toLowerCase()],
  };
  const answer: Answer = {status: 0, body: undefined};
  const res: any = {
    status: (status: number) => {
      answer.status = status;
      return res;
    },
    json: (body: unknown) => {
      answer.body = body;
      return res;
    },
  };
  await (clueExport as any)(req, res);
  return answer;
};
