# MineNova — Telegram Mini App Game Prototype

A standalone, mobile-first mining/clicker game prototype designed for Telegram Mini Apps.

## Included

- Tap-to-mine gameplay
- Energy + regeneration
- Mining-power, battery and regeneration upgrades
- Temporary boosts
- Mission/reward system
- Referral screen
- Leaderboard
- Telegram WebApp initialization
- Telegram user name/profile detection
- LocalStorage persistence for the prototype
- Responsive dark sci-fi visual design

## Run locally

Because this is a static prototype, you can serve the folder with any static HTTP server.

Example:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

For actual Telegram Mini App testing, deploy it to an HTTPS URL and configure that URL in @BotFather.

## Production architecture

For a real game, do NOT trust the browser's balance or mining calculations.

Recommended:

- Frontend: React/TypeScript or this static UI converted to React
- API: Node.js + Express/NestJS
- Database: PostgreSQL
- Cache/rate limits: Redis
- Telegram authentication: validate `Telegram.WebApp.initData` server-side
- Server-side mining/energy calculations
- Transaction ledger for rewards and purchases
- Anti-bot/rate-limit controls

## Telegram setup

1. Create a bot using @BotFather.
2. Configure a Main Mini App and point it to your deployed HTTPS URL.
3. Set the bot menu button to open the Mini App.
4. Replace `YOUR_BOT_USERNAME` in `app.js` with your actual bot username.
5. For production referrals, generate a unique `startapp`/deep-link parameter per user and validate it on the backend.

Telegram's official Mini Apps documentation:
https://core.telegram.org/bots/webapps
