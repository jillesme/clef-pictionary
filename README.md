# Clef Pictionary

Draw on the canvas, Clef guesses live. Try it: https://clef.jilles.fyi

Built with [Clef](https://developers.cloudflare.com/workers-ai/models/clef/), a decision model on Workers AI. React + Vite on Cloudflare Workers, scaffolded with C3.

- `worker/index.ts`: one `env.AI.run("@cf/cloudflare/clef-flash", …)` call with three questions (`guess` choice, `finished` noul, `quality` score)
- `shared/decks.ts`: the word lists. Change a list = new game, no training
- `src/App.tsx`: canvas, live probability bars, finished meter, art critic

```sh
pnpm install
pnpm dev      # Workers AI runs remotely, so you need `wrangler login`
pnpm deploy
```
