"use client";

import LoadError from "../frontend/load-error";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return <LoadError retry={retry} />;
}
