import { GoogleGenAI, Type } from '@google/genai';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const OPENTDB_CATEGORY_MAP = {
  'World History': 23,
  'American History': 23,
  'Sports': 21,
  'Music': 12,
  'Movies': 11,
  'Pop Culture': 26,
  'Art and Famous Artists': 25,
  'Geography': 22,
  'Science and Technology': 17,
  'Television': 14,
  'Famous People': 26,
  'Food and Culture': 9,
  'Random Fun Facts': 9,
};

const WORD_ASSOC_BANK = [
  { prompt: 'What single word connects these three clues?', choices: ['Key', 'Orange', 'Everglades'], correct_answer: 'Florida', explanation: 'Florida Keys, Florida oranges, and the Florida Everglades.' },
  { prompt: 'What single word connects these three clues?', choices: ['Gold', 'Rush', 'Fever'], correct_answer: 'California', explanation: 'California Gold Rush and California Fever.' },
  { prompt: 'What single word connects these three clues?', choices: ['Apple', 'York', 'Times'], correct_answer: 'New', explanation: 'Big Apple (New York), New York, and The New York Times.' },
  { prompt: 'What single word connects these three clues?', choices: ['Bass', 'Drum', 'Guitar'], correct_answer: 'Guitar', explanation: 'Bass guitar, drum & guitar band instruments.' },
  { prompt: 'What single word connects these three clues?', choices: ['Silver', 'Screen', 'Star'], correct_answer: 'Movie', explanation: 'Movie screen, movie star, and silver screen cinema.' },
  { prompt: 'What single word connects these three clues?', choices: ['Solar', 'Milky', 'Shooting'], correct_answer: 'Star', explanation: 'Solar star, Milky Way stars, and shooting star.' },
  { prompt: 'What single word connects these three clues?', choices: ['Grand', 'Home', 'World'], correct_answer: 'Slam', explanation: 'Grand Slam, home run/slam, and world championship.' },
  { prompt: 'What single word connects these three clues?', choices: ['Crown', 'Chess', 'Lion'], correct_answer: 'King', explanation: 'A king wears a crown, is the key chess piece, and is known as the king of beasts.' },
  { prompt: 'What single word connects these three clues?', choices: ['Vinyl', 'Platinum', 'Track'], correct_answer: 'Record', explanation: 'Vinyl record, platinum record, and record track.' },
  { prompt: 'What single word connects these three clues?', choices: ['Ocean', 'Salt', 'Wave'], correct_answer: 'Water', explanation: 'Ocean water, saltwater, and water waves.' },
  { prompt: 'What single word connects these three clues?', choices: ['Time', 'Space', 'Quantum'], correct_answer: 'Leap', explanation: 'Leap in time, leap in space, and quantum leap.' },
  { prompt: 'What single word connects these three clues?', choices: ['Red', 'Blue', 'White'], correct_answer: 'Flag', explanation: 'Red, white, and blue are classic national flag colors.' },
  { prompt: 'What single word connects these three clues?', choices: ['Coffee', 'Pool', 'Periodic'], correct_answer: 'Table', explanation: 'Coffee table, pool table, and the Periodic Table.' },
  { prompt: 'What single word connects these three clues?', choices: ['Black', 'White', 'Grizzly'], correct_answer: 'Bear', explanation: 'Black bear, white (polar) bear, and grizzly bear.' },
  { prompt: 'What single word connects these three clues?', choices: ['Ice', 'Sour', 'Heavy'], correct_answer: 'Cream', explanation: 'Ice cream, sour cream, and heavy cream.' },
  { prompt: 'What single word connects these three clues?', choices: ['Fast', 'Junk', 'Chain'], correct_answer: 'Food', explanation: 'Fast food, junk food, and food chain.' },
  { prompt: 'What single word connects these three clues?', choices: ['High', 'Low', 'Rip'], correct_answer: 'Tide', explanation: 'High tide, low tide, and rip tide.' },
  { prompt: 'What single word connects these three clues?', choices: ['Fire', 'Flash', 'Camp'], correct_answer: 'Light', explanation: 'Firelight, flashlight, and camp light.' },
  { prompt: 'What single word connects these three clues?', choices: ['Paper', 'Money', 'Scissors'], correct_answer: 'Clip', explanation: 'Paper clip, money clip, and clip with scissors.' },
  { prompt: 'What single word connects these three clues?', choices: ['Sweet', 'Wisdom', 'Baby'], correct_answer: 'Tooth', explanation: 'Sweet tooth, wisdom tooth, and baby tooth.' },
  { prompt: 'What single word connects these three clues?', choices: ['Full', 'New', 'Harvest'], correct_answer: 'Moon', explanation: 'Full moon, new moon, and harvest moon.' },
  { prompt: 'What single word connects these three clues?', choices: ['Blind', 'Parking', 'Hot'], correct_answer: 'Spot', explanation: 'Blind spot, parking spot, and hot spot.' },
  { prompt: 'What single word connects these three clues?', choices: ['Brain', 'Sand', 'Thunder'], correct_answer: 'Storm', explanation: 'Brainstorm, sandstorm, and thunderstorm.' },
  { prompt: 'What single word connects these three clues?', choices: ['Gold', 'Star', 'Cat'], correct_answer: 'Fish', explanation: 'Goldfish, starfish, and catfish.' },
];

const LOCAL_MCQ_BANK = {
  'Florida History': [
    { prompt: 'Which European explorer named Florida "La Florida" in 1513?', choices: ['Juan Ponce de León', 'Hernando de Soto', 'Pedro Menéndez de Avilés', 'Panfilo de Narváez'], correct_answer: 'Juan Ponce de León', explanation: 'Juan Ponce de León named the peninsula La Florida in April 1513 during Easter season (Pascua Florida).' },
    { prompt: 'What is the oldest continuously inhabited European-established settlement in the continental United States?', choices: ['St. Augustine', 'Pensacola', 'Tallahassee', 'Key West'], correct_answer: 'St. Augustine', explanation: 'Founded in September 1565 by Spanish admiral Pedro Menéndez de Avilés, St. Augustine is the oldest city in the contiguous U.S.' },
    { prompt: 'In what year did Florida officially become the 27th U.S. state?', choices: ['1845', '1819', '1861', '1821'], correct_answer: '1845', explanation: 'Florida was admitted to the Union as the 27th state on March 3, 1845.' },
    { prompt: 'Which city was chosen as Florida’s state capital in 1824 because it sat halfway between St. Augustine and Pensacola?', choices: ['Tallahassee', 'Orlando', 'Jacksonville', 'Tampa'], correct_answer: 'Tallahassee', explanation: 'Tallahassee was selected in 1824 as a midpoint compromise between the two territorial capitals.' },
    { prompt: 'Which historic Florida overseas railroad, completed in 1912, connected the mainland to Key West?', choices: ['Florida East Coast Railway', 'Seaboard Air Line', 'Atlantic Coast Line', 'Tamiami Rail'], correct_answer: 'Florida East Coast Railway', explanation: 'Henry Flagler extended the Florida East Coast Railway across the Keys to Key West in 1912.' },
    { prompt: 'Which treaty transferred Florida from Spain to the United States in 1819 (effective 1821)?', choices: ['Adams–Onís Treaty', 'Treaty of Paris', 'Treaty of Guadalupe Hidalgo', 'Pinckney’s Treaty'], correct_answer: 'Adams–Onís Treaty', explanation: 'Under the 1819 Adams–Onís Treaty, Spain ceded Florida to the United States.' },
    { prompt: 'Which Florida spaceport launched Apollo 11 to the Moon in July 1969?', choices: ['Kennedy Space Center', 'Eglin Air Force Base', 'Homestead Spaceport', 'Pensacola Naval Air Station'], correct_answer: 'Kennedy Space Center', explanation: 'Apollo 11 launched from Launch Complex 39A at Kennedy Space Center on Merritt Island, Florida.' },
    { prompt: 'Everglades National Park was officially dedicated by which U.S. President in 1947?', choices: ['Harry S. Truman', 'Franklin D. Roosevelt', 'Dwight D. Eisenhower', 'John F. Kennedy'], correct_answer: 'Harry S. Truman', explanation: 'President Harry S. Truman dedicated Everglades National Park in December 1947.' },
  ],
  'Music Albums': [
    { prompt: 'Which 1982 Michael Jackson album remains the best-selling album of all time?', choices: ['Thriller', 'Bad', 'Off the Wall', 'Dangerous'], correct_answer: 'Thriller', explanation: 'Released in November 1982, Thriller is certified as the best-selling album in music history.' },
    { prompt: 'Which Pink Floyd album features a prism refracting light into a rainbow on its cover?', choices: ['The Dark Side of the Moon', 'The Wall', 'Wish You Were Here', 'Animals'], correct_answer: 'The Dark Side of the Moon', explanation: 'The Dark Side of the Moon (1973) features Storm Thorgerson’s iconic prism artwork.' },
    { prompt: 'Which Fleetwood Mac album includes the hit singles "Dreams" and "Go Your Own Way"?', choices: ['Rumours', 'Tusk', 'Mirage', 'Tango in the Night'], correct_answer: 'Rumours', explanation: 'Rumours (1977) won the Grammy Award for Album of the Year and spawned four Top 10 singles.' },
    { prompt: 'Which 1991 Nirvana album featured a baby swimming toward a dollar bill on its cover?', choices: ['Nevermind', 'In Utero', 'Bleach', 'MTV Unplugged in New York'], correct_answer: 'Nevermind', explanation: 'Nevermind (1991) propelled grunge into mainstream rock.' },
    { prompt: 'Which Adele album won Album of the Year at the 2012 Grammys and includes "Rolling in the Deep"?', choices: ['21', '19', '25', '30'], correct_answer: '21', explanation: 'Adele’s second studio album, 21, swept the 2012 Grammy Awards.' },
    { prompt: 'Which Beatles album cover shows the four band members walking across a zebra crosswalk?', choices: ['Abbey Road', 'Sgt. Pepper’s Lonely Hearts Club Band', 'Let It Be', 'Revolver'], correct_answer: 'Abbey Road', explanation: 'Abbey Road (1969) was photographed outside EMI Studios in London.' },
  ],
  DEFAULT: [
    { prompt: 'Which planet in our solar system has the most moons?', choices: ['Saturn', 'Jupiter', 'Uranus', 'Neptune'], correct_answer: 'Saturn', explanation: 'Saturn has over 140 confirmed moons, edging out Jupiter.' },
    { prompt: 'What is the chemical symbol for gold on the periodic table?', choices: ['Au', 'Ag', 'Gd', 'Go'], correct_answer: 'Au', explanation: 'Au comes from the Latin word for gold, aurum.' },
    { prompt: 'Which ocean is the largest and deepest on Earth?', choices: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Southern Ocean'], correct_answer: 'Pacific Ocean', explanation: 'The Pacific Ocean covers more than 30% of Earth’s surface.' },
    { prompt: 'In which country would you find the ancient city of Petra?', choices: ['Jordan', 'Egypt', 'Morocco', 'Lebanon'], correct_answer: 'Jordan', explanation: 'Petra is a famous archaeological site carved into rose-red sandstone cliffs in southern Jordan.' },
    { prompt: 'How many bones are in an adult human body?', choices: ['206', '186', '226', '256'], correct_answer: '206', explanation: 'An adult human skeleton typically consists of 206 bones.' },
    { prompt: 'Which artist painted "The Starry Night" in 1889?', choices: ['Vincent van Gogh', 'Claude Monet', 'Pablo Picasso', 'Salvador Dalí'], correct_answer: 'Vincent van Gogh', explanation: 'Vincent van Gogh painted The Starry Night while staying in Saint-Rémy-de-Provence.' },
    { prompt: 'What is the smallest country in the world by land area?', choices: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'], correct_answer: 'Vatican City', explanation: 'Vatican City covers roughly 0.19 square miles (49 hectares).' },
    { prompt: 'Which element makes up roughly 78% of Earth’s atmosphere?', choices: ['Nitrogen', 'Oxygen', 'Carbon Dioxide', 'Argon'], correct_answer: 'Nitrogen', explanation: 'Earth’s dry atmosphere is about 78% nitrogen and 21% oxygen.' },
  ],
};

function decodeHtml(str) {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&eacute;/g, 'é');
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mapDifficulty(difficulty = '') {
  const lower = difficulty.toLowerCase();
  if (lower.includes('easy')) return 'easy';
  if (lower.includes('hard')) return 'hard';
  return 'medium';
}

async function fetchOpenTdbMcqs({ category, difficulty, usedPrompts = [], count = 2 }) {
  const catId = OPENTDB_CATEGORY_MAP[category];
  const diff = mapDifficulty(difficulty);
  const url = new URL('https://opentdb.com/api.php');
  url.searchParams.set('amount', '10');
  url.searchParams.set('type', 'multiple');
  if (catId) url.searchParams.set('category', String(catId));
  url.searchParams.set('difficulty', diff);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);
  const data = await res.json();

  let results = Array.isArray(data.results) ? data.results : [];
  if (results.length < count) {
    // Retry without difficulty constraint if category pool is small
    const fallbackUrl = new URL('https://opentdb.com/api.php');
    fallbackUrl.searchParams.set('amount', '10');
    fallbackUrl.searchParams.set('type', 'multiple');
    if (catId) fallbackUrl.searchParams.set('category', String(catId));
    const fallbackRes = await fetch(fallbackUrl.toString(), { signal: AbortSignal.timeout(5000) });
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (Array.isArray(fallbackData.results)) {
        results = results.concat(fallbackData.results);
      }
    }
  }

  const usedSet = new Set(usedPrompts);
  const picked = [];
  for (const item of results) {
    const prompt = decodeHtml(item.question);
    if (usedSet.has(prompt)) continue;
    usedSet.add(prompt);
    const correct = decodeHtml(item.correct_answer);
    const incorrect = (item.incorrect_answers || []).map(decodeHtml);
    const choices = shuffle([correct, ...incorrect]).slice(0, 4);
    picked.push({
      q_type: 'MCQ',
      prompt,
      choices,
      correct_answer: correct,
      explanation: `Correct answer: ${correct} (${decodeHtml(item.category || category)}).`,
      category,
      difficulty,
    });
    if (picked.length >= count) break;
  }

  return picked;
}

function pickLocalMcqs({ category, difficulty, usedPrompts = [], count = 2 }) {
  const usedSet = new Set(usedPrompts);
  const categoryPool = LOCAL_MCQ_BANK[category] || [];
  const fallbackPool = LOCAL_MCQ_BANK.DEFAULT;
  const combined = shuffle([...categoryPool]).concat(shuffle([...fallbackPool]));

  const picked = [];
  for (const item of combined) {
    if (usedSet.has(item.prompt) && picked.length + (combined.length - picked.length) > count) continue;
    usedSet.add(item.prompt);
    picked.push({
      q_type: 'MCQ',
      prompt: item.prompt,
      choices: shuffle(item.choices),
      correct_answer: item.correct_answer,
      explanation: item.explanation,
      category,
      difficulty,
    });
    if (picked.length >= count) break;
  }
  return picked;
}

function pickWordAssociation({ category, difficulty, usedPrompts = [] }) {
  const usedSet = new Set(usedPrompts);
  const shuffled = shuffle(WORD_ASSOC_BANK);
  const chosen =
    shuffled.find((item) => !usedSet.has(`${item.prompt} [${item.choices.join(', ')}]`)) ||
    shuffled[0];

  return {
    q_type: 'WORD_ASSOC',
    prompt: `${chosen.prompt} (${chosen.choices.join(' • ')})`,
    choices: chosen.choices,
    correct_answer: chosen.correct_answer,
    explanation: chosen.explanation,
    category,
    difficulty,
  };
}

export async function generateQuestionSet({ category, difficulty, roundNum, setCode, usedPrompts = [] }) {
  // 1. Try Gemini only if configured and billing/quota succeeds
  if (ai) {
    try {
      const prompt = `Generate 1 trivia set (3 questions) for Round ${roundNum} Set ${setCode} in category "${category}" at "${difficulty}" difficulty.
- Question 0: Multiple Choice (4 distinct options, 1 unambiguously correct).
- Question 1: Multiple Choice (4 distinct options, 1 unambiguously correct).
- Question 2: Word Association (3 single-word or two-word clues in "choices" that connect to one single-word answer in "correct_answer").
Do not repeat any of these prior prompts: ${JSON.stringify(usedPrompts.slice(-30))}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                q_type: { type: Type.STRING, enum: ['MCQ', 'WORD_ASSOC'] },
                prompt: { type: Type.STRING },
                choices: { type: Type.ARRAY, items: { type: Type.STRING } },
                correct_answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['q_type', 'prompt', 'choices', 'correct_answer', 'explanation'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed.map((q, idx) => ({
          ...q,
          q_type: idx === 2 ? 'WORD_ASSOC' : 'MCQ',
          category,
          difficulty,
        }));
      }
    } catch (err) {
      console.warn('Gemini unavailable, falling back to free OpenTDB/local generator:', err.message);
    }
  }

  // 2. Free question generation (OpenTDB + built-in bank + Word Association)
  let mcqs = [];
  const useLocalOnly = category === 'Florida History' || category === 'Music Albums';
  if (!useLocalOnly) {
    try {
      mcqs = await fetchOpenTdbMcqs({ category, difficulty, usedPrompts, count: 2 });
    } catch (err) {
      console.warn('OpenTDB fetch failed, using built-in question bank:', err.message);
    }
  }

  if (mcqs.length < 2) {
    const needed = 2 - mcqs.length;
    const local = pickLocalMcqs({
      category,
      difficulty,
      usedPrompts: [...usedPrompts, ...mcqs.map((q) => q.prompt)],
      count: needed,
    });
    mcqs = mcqs.concat(local);
  }

  const wordAssoc = pickWordAssociation({ category, difficulty, usedPrompts });

  return [mcqs[0], mcqs[1], wordAssoc];
}
