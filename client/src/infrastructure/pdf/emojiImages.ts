// The PDF font has no emoji, so each item's emoji is drawn once with the device's emoji font on a canvas
// and embedded as a small PNG (TECH_SPEC.md section 9.1). Nothing leaves the browser.

const SIZE = 48;
const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function renderEmoji(emoji: string): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.font = `${SIZE * 0.78}px ${EMOJI_FONTS}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(emoji, SIZE / 2, SIZE / 2 + SIZE * 0.04);
  return canvas.toDataURL('image/png');
}

/** PNG data URLs by emoji; an emoji the canvas cannot draw is left out (the PDF then uses a letter). */
export function renderEmojiImages(emojis: Iterable<string>): Map<string, string> {
  const images = new Map<string, string>();
  for (const emoji of new Set(emojis)) {
    const image = renderEmoji(emoji);
    if (image) {
      images.set(emoji, image);
    }
  }
  return images;
}
