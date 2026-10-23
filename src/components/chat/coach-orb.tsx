import { ChatOrb } from '@/components/chat/chat-orb';

/**
 * The AI coach's avatar.
 *
 * This is the native implementation: the hand-drawn orb in chat-orb.tsx,
 * three orange light fields orbiting inside a sphere, drawn with SVG
 * radial gradients and Reanimated.
 *
 * The web build (coach-orb.web.tsx) layers a real shader gradient over
 * this same orb once it has loaded. Keeping the two in separate platform
 * files means the native bundle never pulls in three.js at all — the
 * import below is the only thing either file has in common.
 */
export function CoachOrb({ size = 56 }: { size?: number }) {
  return <ChatOrb size={size} />;
}
