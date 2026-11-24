interface ReviewGenerationInput {
  customerName?: string;
  ratings: {
    overall: number;
    tables?: number;
    vibe?: number;
    food?: number;
    staff?: number;
  };
  tags?: string[];
  customNote?: string;
}

export async function generateAIReview(input: ReviewGenerationInput): Promise<string> {
  const { customerName, ratings, tags = [], customNote = '' } = input;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `Write an authentic, casual, 2 to 3 sentence Google Maps review for 'Rebound' (a premier Snooker, Pool & Gaming Lounge with a Cafe).
Customer Name (optional): ${customerName || 'Anonymous customer'}
Their ratings out of 5:
- Snooker & Pool Tables: ${ratings.tables ?? ratings.overall}/5
- Vibe & Ambience: ${ratings.vibe ?? ratings.overall}/5
- Cafe, Drinks & Food: ${ratings.food ?? ratings.overall}/5
- Overall Club Rating: ${ratings.overall}/5
Highlights/Tags they picked: ${tags.join(', ') || 'Great tables and vibe'}
${customNote ? `Personal note from customer: "${customNote}"` : ''}

CRITICAL RULES:
1. Maximum 45 words total (2 to 3 punchy sentences).
2. Sound like a real, excited customer posting from their phone, NOT like an advertisement or robot.
3. Mention 1 or 2 specific highlights they loved (e.g. smooth cloth, cue quality, chilled AC, cold coffee, banging playlist).
4. Include 1 or 2 natural emojis (🎱, 🔥, ☕).
5. Output ONLY the review text. Do not wrap in quotes or add preamble.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 100,
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText && candidateText.length > 15) {
          return candidateText.replace(/^["']|["']$/g, '');
        }
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to smart template synthesizer:', err?.message || err);
    }
  }

  // Fallback: Smart Dynamic Synthesizer (Zero-dependency, reliable, sounds 100% human)
  return buildSmartSynthesizedReview(ratings, tags, customNote);
}

function buildSmartSynthesizedReview(ratings: ReviewGenerationInput['ratings'], tags: string[], customNote: string): string {
  const tablePhrases = [
    'The snooker and pool tables here have super smooth cloth with true cushion roll.',
    'Tables are impeccably maintained, level, and cues are in top shape.',
    'Loved the table quality — perfectly maintained cloth and clean balls make every shot smooth.',
    'Hands down the best quality snooker tables in town.'
  ];

  const vibePhrases = [
    'The ambience and playlist keep the energy high the entire session.',
    'Chilled AC, great lighting over the tables, and an unbeatable vibe with friends.',
    'Awesome vibe to hang out, listen to great music, and play a couple of frames.',
    'Super aesthetic lounge feel with comfortable seating and great atmosphere.'
  ];

  const foodPhrases = [
    'The cold coffee was the perfect refresher between frames.',
    'Cold drinks and cafe snacks were on point.',
    'Loved grabbing snacks and cold drinks while playing.',
    'Cafe setup is super convenient with quick service.'
  ];

  const closingPhrases = [
    'Hands down our favorite weekend hangout spot. 10/10 recommended! 🎱🔥',
    'Definitely coming back regularly with my squad! 🎱⚡',
    'Rebound has set a new standard for gaming & snooker clubs. 5 stars! 🎱✨',
    'Must visit if you love pool, snooker, and chilling with friends! 🎱🙌'
  ];

  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const parts: string[] = [];

  // Table mention
  if ((ratings.tables ?? ratings.overall) >= 4) {
    parts.push(pickRandom(tablePhrases));
  }

  // Vibe or food mention
  if ((ratings.vibe ?? ratings.overall) >= 4) {
    parts.push(pickRandom(vibePhrases));
  } else if ((ratings.food ?? 0) >= 4 || tags.some(t => t.toLowerCase().includes('coffee') || t.toLowerCase().includes('food') || t.toLowerCase().includes('drink'))) {
    parts.push(pickRandom(foodPhrases));
  }

  // If custom note provided, blend it in
  if (customNote && customNote.trim().length > 3) {
    parts.push(`${customNote.trim().replace(/[.!]$/, '')}.`);
  }

  // Closing
  parts.push(pickRandom(closingPhrases));

  return parts.slice(0, 3).join(' ');
}
