/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function analyzeDecision(query: string): Promise<AnalysisResult> {
  const client = getAI();
  
  const prompt = `Analyze the following decision or dilemma: "${query}"
  Provide a structured analysis in Ukrainian.
  The analysis must include:
  1. Pros and Cons (at least 3 of each).
  2. A SWOT analysis (Strengths, Weaknesses, Opportunities, Threats).
  3. A short summary/recommendation.
  4. (Optional) If there are multiple clear options to compare, provide a comparison table.
  
  Format the output as JSON.`;

  const response = await client.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prosCons: {
            type: Type.OBJECT,
            properties: {
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["pros", "cons"],
          },
          swot: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              threats: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["strengths", "weaknesses", "opportunities", "threats"],
          },
          summary: { type: Type.STRING },
          comparison: {
            type: Type.OBJECT,
            properties: {
              headers: { type: Type.ARRAY, items: { type: Type.STRING } },
              rows: {
                type: Type.ARRAY,
                items: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        },
        required: ["prosCons", "swot", "summary"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("AI returned empty response");
  }

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    throw new Error("Failed to parse decision analysis");
  }
}
