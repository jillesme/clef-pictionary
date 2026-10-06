import {
	DECKS,
	MODELS,
	QUALITY_LEVELS,
	type GuessRequest,
} from "../shared/decks.ts";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/api/guess" && request.method === "POST") {
			const { image, deck, model } = await request.json<GuessRequest>();
			if (!DECKS[deck] || !MODELS.includes(model)) {
				return Response.json({ error: "Unknown deck or model" }, { status: 400 });
			}

			const started = Date.now();
			const result = await env.AI.run(`@cf/cloudflare/${model}`, {
				model,
				images: [image],
				state: "A hand-drawn Pictionary sketch on a white canvas. It may still be in progress.",
				questions: {
					guess: {
						type: "choice",
						instructions: "Which word is the player drawing?",
						criteria: DECKS[deck].words,
					},
					finished: {
						type: "noul",
						instructions:
							"Is the drawing complete enough that a person would confidently recognise what it is?",
					},
					quality: {
						type: "score",
						instructions: "How good is this drawing, as art?",
						criteria: QUALITY_LEVELS,
					},
				},
			});

			return Response.json({ ...result, ms: Date.now() - started });
		}

		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
