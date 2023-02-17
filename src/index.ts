import { Update } from "@grammyjs/types";
export interface Env {
  TG_TOKEN: string;
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
      const echo = fetch(createSentMessageUrl(env.TG_TOKEN), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: update.message?.chat.id,
          text: update.message?.text + "\nfrom worker",
        }),
      });
      ctx.waitUntil(echo);
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

// create sentMessage url
const createSentMessageUrl = (token: string) =>
  `https://api.telegram.org/bot${token}/sendMessage`;
