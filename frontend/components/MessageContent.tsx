"use client";

import { isRtl } from "../lib/text";

/**
 * Renders a message body.
 *
 * Model output is plain text, not markdown, so this deliberately does not
 * pull in a markdown renderer. It does one structural thing: fenced code
 * blocks become <pre>, which can scroll horizontally inside the bubble
 * instead of forcing long lines to wrap mid-token or widen the page.
 * Everything else is rendered as text, exactly as before.
 */
export default function MessageContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const segments = splitFences(content);
  const rtl = isRtl(content);

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={`msg ${className}`}>
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <pre key={i} dir="ltr" tabIndex={0} aria-label="Code block">
            <code>{seg.value}</code>
          </pre>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </div>
  );
}

type Segment = { type: "text" | "code"; value: string };

export function splitFences(input: string): Segment[] {
  const parts = input.split(/```/);
  // An odd number of fences means the last one is unterminated; treat the
  // trailing remainder as plain text rather than swallowing it.
  const out: Segment[] = [];

  for (let i = 0; i < parts.length; i++) {
    const isCode = i % 2 === 1 && i < parts.length - 1;
    let value = parts[i];
    if (!value) continue;

    if (isCode) {
      // Drop an optional language tag on the opening line.
      value = value.replace(/^[a-zA-Z0-9_-]*\n/, "").replace(/\n$/, "");
      out.push({ type: "code", value });
    } else {
      out.push({ type: "text", value });
    }
  }

  return out.length > 0 ? out : [{ type: "text", value: input }];
}
