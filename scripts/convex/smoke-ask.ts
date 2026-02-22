import { ConvexHttpClient } from "convex/browser";
import { loadEnvFromArgs } from "./env-loader";

const SAMPLE_QUESTIONS = [
  { question: "haiz ki muddat kitni hoti hai", lang: "ru" },
  { question: "وضو کے فرائض کتنے ہیں", lang: "ur" },
  { question: "how many farz in wudu", lang: "en" },
] as const;

async function main() {
  loadEnvFromArgs();
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL missing. Pass --env-file or set .env.convex.local");
  }

  const client = new ConvexHttpClient(convexUrl);

  for (const sample of SAMPLE_QUESTIONS) {
    const result = await client.action("ask:askQuestion", {
      question: sample.question,
      lang: sample.lang,
      clientId: "smoke-test-script",
    });

    const found = Boolean((result as any)?.found);
    const passages = Array.isArray((result as any)?.passages)
      ? (result as any).passages.length
      : 0;

    console.log(
      JSON.stringify(
        {
          question: sample.question,
          lang: sample.lang,
          found,
          passages,
          hasDisclaimer: Boolean((result as any)?.disclaimer),
          hasAnswer: Boolean((result as any)?.answer || (result as any)?.message),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error("smoke-ask failed:", error);
  process.exit(1);
});
