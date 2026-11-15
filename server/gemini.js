import { GoogleGenAI, Type } from '@google/genai';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export async function generateQuestionSet({ category, difficulty, roundNum, setCode, usedPrompts = [] }) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

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
  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new Error('Invalid question set structure returned by Gemini.');
  }
  return parsed.map((q, idx) => ({
    ...q,
    q_type: idx === 2 ? 'WORD_ASSOC' : 'MCQ',
    category,
    difficulty,
  }));
}
