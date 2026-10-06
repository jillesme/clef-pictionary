// Word lists for the game. Each word maps to a short description that Clef
// uses as the option's criteria. Change a list here = new game, no training.

export const DECKS = {
	classic: {
		label: "Classic",
		words: {
			cat: "A cat",
			dog: "A dog",
			house: "A house",
			tree: "A tree",
			bicycle: "A bicycle",
			car: "A car",
			fish: "A fish",
			sun: "The sun",
			lighthouse: "A lighthouse by the sea",
			hat: "A hat",
			guitar: "A guitar",
			rocket: "A rocket",
			flower: "A flower",
			umbrella: "An umbrella",
			pizza: "A pizza or a pizza slice",
			snowman: "A snowman",
		},
	},
	cloudflare: {
		label: "Cloudflare edition",
		words: {
			cloud: "A cloud, like the Cloudflare orange cloud",
			bucket: "A bucket (R2 object storage)",
			database: "A database cylinder (D1)",
			globe: "A globe (the global network)",
			lock: "A padlock (security)",
			shield: "A shield (DDoS protection)",
			robot: "A robot (an AI agent)",
			lightning: "A lightning bolt (speed)",
			gear: "A gear or cog (code running)",
			server: "A server rack",
		},
	},
} satisfies Record<string, { label: string; words: Record<string, string> }>;

export type DeckId = keyof typeof DECKS;

export const MODELS = ["clef-flash", "clef"] as const;
export type ModelId = (typeof MODELS)[number];

export const QUALITY_LEVELS = [
	"Stick figure",
	"Doodle",
	"Decent",
	"Good",
	"Museum",
];

export type GuessRequest = { image: string; deck: DeckId; model: ModelId };

export type GuessResponse = {
	model: string;
	ms: number;
	answers: {
		guess: {
			choice: string;
			probabilities: Record<string, number>;
			confidence: number;
		};
		finished: { noul: number };
		quality: { score: number; confidence: number };
	};
};
