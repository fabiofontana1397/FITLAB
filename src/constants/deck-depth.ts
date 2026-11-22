/**
 * Depth of a card stack (Ricette, Allenamento veloce): the cards behind the top one are shaded so the stack reads
 * as layers, not as copies of the same card. The shade is a veil over the card, darker the further back the card
 * sits, lifted as a card comes forward. On the dark theme it is black (the cards behind sink into the page); on the
 * light theme a faint grey (they turn a touch greyer than the white card on top).
 */
export const DECK_SHADE = {
  dark: { color: '#000000', first: 0.3, second: 0.55 },
  light: { color: '#1C1C22', first: 0.09, second: 0.17 },
} as const;

export type DeckShade = (typeof DECK_SHADE)[keyof typeof DECK_SHADE];
