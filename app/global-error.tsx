"use client";

import LoadError from "../frontend/load-error";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, padding: 16, background: "#10141d" }}><LoadError retry={retry} /></body></html>;
}
