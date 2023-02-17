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
      return new Response("Hello world!");
    }

    // ignore other requests
    return new Response("404 - I am a telegram bot with webhook.", { status: 404 });
  },
};
