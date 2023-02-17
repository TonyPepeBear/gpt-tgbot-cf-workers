import { Update, Message, ApiSuccess } from "@grammyjs/types";
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
      const jobGetResult = doSomething();
      
      const jobEdit = (async () => {
        console.log("edit message");
        const jobs = await Promise.all([jobProcressing, jobGetResult]);
        const result : ApiSuccess<Message> = JSON.parse(await jobs[0].text());
        console.log(result);
        
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
      })

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

const doSomething = async () => {
  //delay 5sec
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "done";
};

// create sentMessage url
const createSentMessageUrl = (token: string) =>
  `https://api.telegram.org/bot${token}/sendMessage`;

// create editMessage url
const createEditMessageUrl = (token: string) =>
  `https://api.telegram.org/bot${token}/editMessageText`;
