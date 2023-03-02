import { Update, Message, ApiSuccess } from "@grammyjs/types";
export interface Env {
  CHAT_KV: KVNamespace;
  TG_TOKEN: string;
  OPENAI_TOKEN: string;
  CHAT_LANGUAGE: string;
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
      const chatHistory = (await env.CHAT_KV.get(
        update.message?.chat.id.toString()!,
        { type: "json" }
      )) as Array<ChatGptMessage> | undefined;

      var askMessage: Array<ChatGptMessage> = [
        { role: "system", content: botSelfInfo(env.CHAT_LANGUAGE) },
      ];
      if (chatHistory) {
        for (const msg of chatHistory!) {
          askMessage.push(msg);
        }
      }
      askMessage.push({ role: "user", content: update.message?.text! });

      // ask chatGPT
      const jobGetResult = askGPT(askMessage, env);

      const jobEdit = async () => {
        const jobs = await Promise.all([jobProcressing, jobGetResult]);
        const result: ApiSuccess<Message> = JSON.parse(await jobs[0].text());

        // save chat history
        // chatHistory.push({ role: "assistant", content: jobs[1] });
        const saveHistory: Array<ChatGptMessage> = chatHistory || [];
        saveHistory.push({ role: "user", content: update.message?.text! });
        saveHistory.push(jobs[1].message);
        await env.CHAT_KV.put(
          update.message?.chat.id.toString()!,
          JSON.stringify(saveHistory)
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
            text: jobs[1].message.content,
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

const askGPT = async (msg: Array<ChatGptMessage>, env: Env) => {
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: msg,
    }),
  };

  const resp_text = await (
    await fetch("https://api.openai.com/v1/chat/completions", options)
  ).text();
  const openai: OpenAIResponse = JSON.parse(resp_text);
  return openai.choices[0];
};

interface ChatGptMessage {
  role: string;
  content: string;
}

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
  message: ChatGptMessage;
  finish_reason: string;
  index: number;
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

const botSelfInfo = (language: string) => `
You are a helpful assistant named "rabbitGPT". 
By default, you speak ${language}, but you will speak the appropriate language based on the user's request or response.
`;
