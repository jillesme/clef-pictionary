import { useEffect, useRef, useState } from "react";
import {
	DECKS,
	MODELS,
	QUALITY_LEVELS,
	type DeckId,
	type GuessResponse,
	type ModelId,
} from "../shared/decks.ts";
import "./App.css";

const CANVAS_SIZE = 600;
const LIVE_GUESS_INTERVAL_MS = 400;
// Downscale before sending: ~30% fewer input tokens, Clef still reads it fine.
const SEND_SIZE = 256;
// Never let one hung request freeze the single-flight loop.
const REQUEST_TIMEOUT_MS = 8000;
const WIN_PROBABILITY = 0.6;
const FINISHED_THRESHOLD = 0.9;

type Status = "drawing" | "won" | "final";

function pickWord(deck: DeckId, previous?: string) {
	const words = Object.keys(DECKS[deck].words).filter((w) => w !== previous);
	return words[Math.floor(Math.random() * words.length)];
}

const percent = (p: number) => `${Math.round(p * 100)}%`;

function App() {
	const [deck, setDeck] = useState<DeckId>("classic");
	const [model, setModel] = useState<ModelId>("clef-flash");
	const [target, setTarget] = useState(() => pickWord("classic"));
	const [status, setStatus] = useState<Status>("drawing");
	const [result, setResult] = useState<GuessResponse | null>(null);
	const [thinking, setThinking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawing = useRef(false);
	const hasInk = useRef(false);
	const lastLiveGuess = useRef(0);
	const inFlight = useRef(false);
	const pending = useRef(false);
	const round = useRef(0);
	// Refs mirror state so the async guess loop always sees the latest values.
	const live = useRef({ deck, model, target, status });
	useEffect(() => {
		live.current = { deck, model, target, status };
	});

	const clearCanvas = () => {
		const ctx = canvasRef.current!.getContext("2d")!;
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		hasInk.current = false;
	};

	const newRound = (nextDeck: DeckId, previous?: string) => {
		round.current++;
		clearCanvas();
		setTarget(pickWord(nextDeck, previous));
		setStatus("drawing");
		setResult(null);
		setError(null);
	};

	useEffect(clearCanvas, []);

	// Single-flight: one request at a time, and always send the latest drawing next.
	const requestGuess = async () => {
		if (!hasInk.current || live.current.status !== "drawing") return;
		if (inFlight.current) {
			pending.current = true;
			return;
		}
		inFlight.current = true;
		setThinking(true);
		const requestRound = round.current;
		const { deck, model } = live.current;

		const small = document.createElement("canvas");
		small.width = small.height = SEND_SIZE;
		small.getContext("2d")!.drawImage(canvasRef.current!, 0, 0, SEND_SIZE, SEND_SIZE);

		try {
			const res = await fetch("/api/guess", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ image: small.toDataURL("image/png"), deck, model }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: GuessResponse = await res.json();
			if (requestRound !== round.current) return;

			setError(null);
			setResult(data);
			const { guess, finished } = data.answers;
			const won =
				guess.choice === live.current.target &&
				guess.probabilities[guess.choice] >= WIN_PROBABILITY;
			if (won) setStatus("won");
			else if (finished.noul >= FINISHED_THRESHOLD) setStatus("final");
		} catch (err) {
			console.error(err);
			if (requestRound === round.current) {
				setError("Clef didn't answer. Keep drawing to retry.");
			}
		} finally {
			inFlight.current = false;
			setThinking(false);
			if (pending.current) {
				pending.current = false;
				requestGuess();
			}
		}
	};

	const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
			y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
		};
	};

	const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (status !== "drawing") return;
		e.currentTarget.setPointerCapture(e.pointerId);
		drawing.current = true;
		const ctx = e.currentTarget.getContext("2d")!;
		const { x, y } = point(e);
		ctx.strokeStyle = "#111";
		ctx.lineWidth = 9;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x, y);
		ctx.stroke();
		hasInk.current = true;
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (!drawing.current) return;
		const ctx = e.currentTarget.getContext("2d")!;
		const { x, y } = point(e);
		ctx.lineTo(x, y);
		ctx.stroke();
		if (Date.now() - lastLiveGuess.current > LIVE_GUESS_INTERVAL_MS) {
			lastLiveGuess.current = Date.now();
			requestGuess();
		}
	};

	const onPointerUp = () => {
		if (!drawing.current) return;
		drawing.current = false;
		requestGuess();
	};

	const guess = result?.answers.guess;
	const quality = result?.answers.quality;
	const finished = result?.answers.finished.noul ?? 0;
	const words = DECKS[deck].words;

	return (
		<div className="app">
			<header>
				<h1>
					Clef <span>Pictionary</span>
				</h1>
				<div className="controls">
					<select
						value={deck}
						onChange={(e) => {
							const next = e.target.value as DeckId;
							setDeck(next);
							newRound(next);
						}}
					>
						{Object.entries(DECKS).map(([id, d]) => (
							<option key={id} value={id}>
								{d.label}
							</option>
						))}
					</select>
					<select
						value={model}
						onChange={(e) => setModel(e.target.value as ModelId)}
					>
						{MODELS.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</div>
			</header>

			<main>
				<section className="board">
					<div className="prompt">
						Draw: <strong>{target}</strong>
					</div>
					<div className={`canvas-wrap ${thinking ? "thinking" : ""}`}>
						<canvas
							ref={canvasRef}
							width={CANVAS_SIZE}
							height={CANVAS_SIZE}
							onPointerDown={onPointerDown}
							onPointerMove={onPointerMove}
							onPointerUp={onPointerUp}
							onPointerCancel={onPointerUp}
						/>
						{status !== "drawing" && guess && (
							<div className={`overlay ${status}`}>
								{status === "won" ? (
									<>
										<div className="big">Clef got it!</div>
										<div>
											{guess.choice} · {percent(guess.probabilities[guess.choice])}
										</div>
									</>
								) : (
									<>
										<div className="big">Final answer: {guess.choice}</div>
										<div>It was {target}</div>
									</>
								)}
							</div>
						)}
					</div>
					<div className="buttons">
						<button onClick={() => newRound(deck)}>Clear</button>
						<button className="primary" onClick={() => newRound(deck, target)}>
							New word
						</button>
					</div>
				</section>

				<section className="panel">
					<div className="leader">
						<div className="label">
							Clef thinks it's a…
							<span className={`status ${thinking ? "on" : ""}`}>
								<span className="dot" /> thinking
							</span>
						</div>
						<div className="choice">{guess ? guess.choice : "…"}</div>
						<div className="meta">
							{guess ? `confidence ${percent(guess.confidence)}` : "start drawing"}
						</div>
						{error && <div className="error">{error}</div>}
					</div>

					<ul className="bars">
						{Object.keys(words).map((word) => {
							const p = guess?.probabilities[word] ?? 0;
							return (
								<li
									key={word}
									className={[
										word === guess?.choice ? "top" : "",
										word === target ? "target" : "",
									].join(" ")}
								>
									<span className="word">{word}</span>
									<span className="track">
										<span className="fill" style={{ width: percent(p) }} />
									</span>
									<span className="pct">{percent(p)}</span>
								</li>
							);
						})}
					</ul>

					<div className="meters">
						<div className="meter">
							<div className="label">
								Finished? <strong>{percent(finished)}</strong>
							</div>
							<span className="track">
								<span className="fill" style={{ width: percent(finished) }} />
								<span
									className="threshold"
									style={{ left: percent(FINISHED_THRESHOLD) }}
								/>
							</span>
						</div>

						<div className="meter">
							<div className="label">
								Art critic{" "}
								<strong>
									{quality ? `${quality.score.toFixed(1)} / ${QUALITY_LEVELS.length - 1}` : "–"}
								</strong>
							</div>
							<div className="critic">
								<span
									className="needle"
									style={{
										// Center of each level column, so 0.8 sits just left of "Doodle".
										left: percent(((quality?.score ?? 0) + 0.5) / QUALITY_LEVELS.length),
									}}
								/>
								{QUALITY_LEVELS.map((level) => (
									<span key={level}>{level}</span>
								))}
							</div>
						</div>
					</div>

					<footer>
						@cf/cloudflare/{model}
						{result && <span> · {result.ms} ms</span>}
					</footer>
				</section>
			</main>
		</div>
	);
}

export default App;
