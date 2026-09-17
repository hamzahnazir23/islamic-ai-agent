// Arabic, Arabic Supplement/Extended, and Arabic Presentation Forms.
const RTL_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * True when a string is predominantly right-to-left. A single Arabic term
 * inside an English sentence should not flip the whole paragraph, so this
 * compares how much of the letter content is RTL rather than just looking
 * for one match.
 */
export function isRtl(text: string): boolean {
  if (!RTL_RANGE.test(text)) return false;
  const rtl = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return rtl > latin;
}
