import { Update, Message, ApiSuccess } from "@grammyjs/types";
export interface Env {
  CHAT_KV: KVNamespace;
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
      // parse telegram update
      let update: Update = JSON.parse(await request.text());

      //white list
      const whiteList: Array<string> =
        (await env.CHAT_KV.get("white_list", "json")) || [];
      if (
        whiteList.length > 0 &&
        !whiteList.includes(update.message?.chat.id.toString()!)
      ) {
        // if not in white list, sent message to user
        sentMessage(
          env.TG_TOKEN,
          update.message?.chat.id!,
          "You are not in the white list, please contact the administrator to add you to the white list." +
            "\n" +
            "Your chat id is: " +
            update.message?.chat.id!
        );
        return new Response(); // early return
      }

      // reply to /start command
      if (update.message?.text === "/start") {
        sentMessage(
          env.TG_TOKEN,
          update.message?.chat.id!,
          'Hello, I am a robot, the name is "rabbitGPT". \nUse "/clear" to clear chat history that you have talked to me.'
        );
        return new Response(); // early return
      }

      // clear chat history
      if (update.message?.text === "/clear") {
        // clear chat history in KV
        await env.CHAT_KV.delete(update.message?.chat.id.toString()!);
        // sent message to user that chat history cleared
        const j = fetch(createSentMessageUrl(env.TG_TOKEN), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: update.message?.chat.id!,
            text: "Chat history cleared.",
          }),
        });
        ctx.waitUntil(j);
        return new Response();
      }

      // sent processing message
      const jobProcressing = fetch(createSentMessageUrl(env.TG_TOKEN), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: update.message?.chat.id!,
          text: "Loading...💭",
        }),
      });

      // get chat history
      const chatHistory = await env.CHAT_KV.get(
        update.message?.chat.id.toString()!
      );
      var askMessage =
        'I am a robot, the name is "rabbitGPT", is now talking to the user.\n\nuser says: \n' +
        update.message?.text! +
        "\n\nI says: \n";
      // not null or empty
      if (chatHistory) {
        // askMessage = chatHistory + update.message?.text! + "\n\n";
        askMessage =
          chatHistory +
          "\n\nuser says: \n" +
          update.message?.text! +
          "I says: \n";
      }

      // ask chatGPT
      const jobGetResult = askGPT(askMessage, env);

      const jobEdit = async () => {
        console.log("edit message");
        const jobs = await Promise.all([jobProcressing, jobGetResult]);
        const result: ApiSuccess<Message> = JSON.parse(await jobs[0].text());

        // save chat history
        await env.CHAT_KV.put(
          update.message?.chat.id.toString()!,
          askMessage + jobs[1] + "\n\n"
        );

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

const sentMessage = async (token: string, chat_id: number, text: string) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chat_id,
      text: text,
    }),
  };
  const resp_text = await (
    await fetch(createSentMessageUrl(token), options)
  ).text();
  const resp: ApiSuccess<Message> = JSON.parse(resp_text);
  return resp;
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
