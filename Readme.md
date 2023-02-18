# CF ChatGPT Telegram Bot

A Telegram bot using OpenAi API and Cloudflare Workers to chat with users.

## Deploy

### 0. Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [OpenAi API](https://openai.com/) key
- [Telegram](https://telegram.org/) account
- [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update) installed and logged in

### 1. Create a Telegram bot

Create a Telegram bot using [@BotFather](https://t.me/BotFather) and get the bot token.


### 2. Clone this repo

```bash
git clone
```

### 3. Create KV namespace and Change the KV namespace in wrangler.toml

```bash
wrangler kv:namespace create "CHAT_LIST"
```

```toml
kv-namespaces = [
    { binding = "CHAT_LIST", id = "<your KV namespace id>" }
]
```

### 4. Set Telegram bot token and OpenAi API key in wrangler secret

```bash
wrangler secret put TG_TOKEN
wrangler secret put OPENAI_TOKEN
```

### 5. Publish

```bash
wrangler publish
```

### 6. Set Telegram Bot Webhook

Now you can get your own workers url. Set the webhook of your bot to the workers url.

```bash
https://api.telegram.org/<TG_TOKEN>/setWebhook?url=https://<your-workers-url>/bot<TG_TOKEN>
```

### 7. Enjoy
