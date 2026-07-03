import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY or API_KEY environment variable is required for Gemini services.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export const analyzeStreamContext = async (title: string, broadcaster: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Based on a live stream titled "${title}" by ${broadcaster}, generate 3 engaging tags and a short catchy description for a viewer dashboard. Output as JSON.`,
      config: {
        responseMimeType: "application/json"
      }
    });
    // Fix: Access response text via the property, not a method
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};

export const generateStreamThumbnail = async (title: string, broadcaster: string): Promise<string | null> => {
  try {
    const ai = getAi();
    const prompt = `A professional, vibrant, and cinematic digital art piece for a video stream thumbnail. The stream is titled "${title}" and hosted by "${broadcaster}". The style should be high-contrast, modern, and energetic, suitable for a professional broadcasting platform. Avoid text unless it's integrated stylistically.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    return null;
  }
};

export const getAiModeratorResponse = async (chatHistory: string, lastMessage: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `You are an AI moderator for a professional RTMP stream. 
      Context: ${chatHistory}
      New message: ${lastMessage}
      If the message is problematic, warn the user. If it's a question, answer it concisely. If it's a greeting, respond warmly.
      Keep response under 50 words.`,
    });
    // Fix: Access response text via the property, not a method
    return response.text;
  } catch (error) {
    return "I'm monitoring the chat and ensuring a positive environment!";
  }
};