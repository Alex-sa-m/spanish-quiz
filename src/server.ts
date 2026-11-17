import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mistral } from "@mistralai/mistralai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const MODEL = "mistral-small-latest";
const TARGET = 500;
const BATCH = 100;
const PORT = Number(process.env.PORT ?? 3000);

if (!process.env.MISTRAL_API_KEY) {
  console.error("MISTRAL_API_KEY manquante : copie .env.example en .env et renseigne ta clé.");
}

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

interface Word {
  es: string;
  fr: string;
}

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

let wordsCache: Word[] | null = null;
let wordsPromise: Promise<Word[]> | null = null;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === "object" && c !== null && "text" in c ? String((c as { text: unknown }).text) : "")).join("");
  }
  return "";
}

async function fetchBatch(need: number, seen: Set<string>): Promise<Word[]> {
  const prompt = `Tu es un professeur d'espagnol. Donne exactement ${need} mots espagnols très courants pour un apprenant de niveau CECRL A2, chacun avec sa traduction en français.
Réponds UNIQUEMENT en JSON valide, sans texte autour et sans markdown :
{"words": [["mot espagnol", "traduction française"], ...]}
Ne répète aucun mot.`;

  const res = await client.chat.complete({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = extractText(res.choices?.[0]?.message?.content);
  const parsed = JSON.parse(raw) as { words?: unknown };
  const out: Word[] = [];
  if (Array.isArray(parsed.words)) {
    for (const pair of parsed.words) {
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || typeof pair[1] !== "string") continue;
      const es = pair[0].trim();
      const fr = pair[1].trim();
      const key = normalize(es);
      if (!es || !fr || seen.has(key)) continue;
      seen.add(key);
      out.push({ es, fr });
    }
  }
  return out;
}

async function generateWords(): Promise<Word[]> {
  const seen = new Set<string>();
  const words: Word[] = [];
  let attempts = 0;
  while (words.length < TARGET && attempts < 10) {
    const need = Math.min(BATCH, TARGET - words.length);
    words.push(...(await fetchBatch(need, seen)));
    attempts++;
  }
  return words.slice(0, TARGET);
}

app.get("/api/words", async (_req, res) => {
  try {
    if (!wordsCache) {
      wordsPromise ??= generateWords().then(
        (w) => {
          wordsCache = w;
          return w;
        },
        (err) => {
          wordsPromise = null;
          throw err;
        }
      );
      await wordsPromise;
    }
    res.json({ words: wordsCache });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Impossible de générer la liste via l'API Mistral. Vérifie MISTRAL_API_KEY dans .env." });
  }
});

app.post("/api/check", (req, res) => {
  const { es, answer } = req.body ?? {};
  if (typeof es !== "string" || typeof answer !== "string") {
    res.status(400).json({ error: "Champs 'es' et 'answer' requis." });
    return;
  }
  res.json({ correct: normalize(answer) === normalize(es), expected: es });
});

app.listen(PORT, () => {
  console.log(`App ouverte sur http://localhost:${PORT}`);
});
