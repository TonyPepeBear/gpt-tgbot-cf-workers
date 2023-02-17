import { Update } from "@grammyjs/types";
export interface Env {
  MY_KV_NAMESPACE: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const tg_token = "123"; // env.MY_KV_NAMESPACE.get("tg_token");
    // parse url
    const url = new URL(request.url);

    // telegram webhook
    if (request.method === "POST" && url.pathname === `/bot${tg_token}`) {
      let update: Update = JSON.parse(await request.text());
      return new Response(update.message?.chat.id! + update.message?.text!);
    }
    // ignore other requests
    return new Response("404 - I am a telegram bot with webhook.", {
      status: 404,
    });
  },
};
