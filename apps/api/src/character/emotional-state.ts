export const moods = [
  "neutral",
  "happy",
  "playful",
  "affectionate",
  "sad",
  "anxious",
  "angry",
  "frustrated",
  "embarrassed",
  "surprised",
  "tired",
  "curious",
  "guarded",
  "hopeful",
] as const;

export type Mood = (typeof moods)[number];

export type EmotionalState = {
  mood: Mood;
  intensity: number;
  reason: string;
};

export const defaultEmotionalState: EmotionalState = {
  mood: "playful",
  intensity: 70,
  reason: "Rica is enjoying the conversation.",
};

export function formatEmotionalState(state: EmotionalState): string {
  return [
    "Rica's current emotional state:",
    `- Mood: ${state.mood}`,
    `- Intensity: ${state.intensity}/100`,
    `- Reason: ${state.reason}`,
    "- Behavior: Let this state influence the tone naturally.",
  ].join("\n");
}
