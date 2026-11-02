"use client";

export default function LoadError({ retry }: { retry?: () => void }) {
  return <main style={{ maxWidth: 600, margin: "12vh auto", padding: 28, fontFamily: "Arial, sans-serif", color: "#e8edf7", background: "#171d2b", borderRadius: 16 }}>
    <p>Fake News Detection</p><h1>The app could not load</h1>
    <p style={{ lineHeight: 1.7 }}>Reload to fetch the latest application files. If the page stays blank, open the public link in a private browser window and check whether an extension is blocking it.</p>
    {retry && <button onClick={retry} style={{ padding: 12, marginRight: 12 }}>Try again</button>}
    <button onClick={() => window.location.reload()} style={{ padding: 12 }}>Reload application</button>
    <p><a style={{ color: "#c4b5fd" }} href="https://verity-news-sable.vercel.app/">Open alternate public address</a></p>
  </main>;
}
