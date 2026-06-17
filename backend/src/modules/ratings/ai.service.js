const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateRatingSuggestion(data) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
    },
  });

  const prompt = `
    You are a workforce performance evaluator for InternOps.

    You evaluate interns, captains, and team leads based on attendance, task completion, and historical ratings.

    Evaluate the intern and suggest a rating from 1 to 5.

    Intern Details:
    ${JSON.stringify(data, null, 2)}

    Rules:
    - Consider attendance.
    - Consider verified task completion.
    - Consider rating history.
    - Higher attendance should increase score.
    - More verified tasks should increase score.
    - Poor attendance should reduce score.
    - New users should not be rated.

    Return ONLY this JSON:

    {
      "score": number,
      "reason": string
    }

    Return the SAME score for the SAME input.
    Be consistent.
    Do not randomly change ratings.

    Requirements:
    - reason must be between 10 and 15 words.
    - reason must be a single sentence.
    - do not exceed 15 words.
    - focus on attendance, task completion and rating history.
  `;

  const result = await model.generateContent(prompt);

  const text = result.response
    .text()
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(text);
  const parsed = JSON.parse(text);

  if (typeof parsed.score !== 'number') {
    throw new Error('Invalid AI response');
  }

  return parsed;
}

module.exports = {
  generateRatingSuggestion,
};
