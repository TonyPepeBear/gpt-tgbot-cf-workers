import { Update, Message, ApiSuccess } from "@grammyjs/types";
export interface Env {
  TG_TOKEN: string;
  OPENAI_TOKEN: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // parse url
    const url = new URL(request.url);

    // telegram webhook
    if (request.method === "POST" && url.pathname === `/bot${env.TG_TOKEN}`) {
      let update: Update = JSON.parse(await request.text());
      console.log(update.message?.text);
      const jobProcressing = fetch(createSentMessageUrl(env.TG_TOKEN), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: update.message?.chat.id,
          text: "processing...",
        }),
      });

      // ask chatGPT
      const jobGetResult = askGPT(update.message?.text!, env);

      const jobEdit = async () => {
        console.log("edit message");
        const jobs = await Promise.all([jobProcressing, jobGetResult]);
        const result: ApiSuccess<Message> = JSON.parse(await jobs[0].text());

        //edit message
        await fetch(createEditMessageUrl(env.TG_TOKEN), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: result.result.chat.id,
            message_id: result.result.message_id,
            text: jobs[1],
          }),
        });
      };

      ctx.waitUntil(jobProcressing);
      ctx.waitUntil(jobGetResult);
      ctx.waitUntil(jobEdit());
      return new Response(update.message?.chat.id! + update.message?.text!);
    }
    // ignore other requests
    return new Response(
      "404 - I am a telegram bot with webhook." + "\n" + request.url,
      {
        status: 404,
      }
    );
  },
};

const askGPT = async (msg: string, env: Env) => {
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt: msg + "\n",
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    }),
  };

  const resp_text = await (
    await fetch("https://api.openai.com/v1/completions", options)
  ).text();
  const openai: OpenAIResponse = JSON.parse(resp_text);

  return openai.choices[0].text;
};

// create sentMessage url
const createSentMessageUrl = (token: string) =>
  `https://api.telegram.org/bot${token}/sendMessage`;

// create editMessage url
const createEditMessageUrl = (token: string) =>
  `https://api.telegram.org/bot${token}/editMessageText`;

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAiChoice[];
  usage: OpenAiUsage;
}
interface OpenAiChoice {
  text: string;
  index: number;
  logprobs: null;
  finish_reason: string;
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
