export type ModelReadiness = "loading" | "ready" | "unavailable";

export default function WorkspaceIntro({ modelStatus }: { modelStatus: ModelReadiness }) {
  return <section className="workspace-intro" aria-labelledby="workspace-title">
    <div className="workspace-intro-copy">
      <p className="workspace-kicker"><span aria-hidden="true" />One workspace. Multiple perspectives.</p>
      <h1 id="workspace-title">Is this news credible?<br /><span>Check the claims.</span></h1>
      <p className="workspace-description">Explore text, images and video. Get writing-pattern predictions for reviewed words.<br className="desktop-break" /> Review source passages and media context before drawing a conclusion.</p>
    </div>
    <div className="workspace-readiness">
      <p className={`model-connection model-${modelStatus}`} role="status"><span aria-hidden="true" />{modelStatus === "ready" ? "Text model connected" : modelStatus === "loading" ? "Checking text model…" : "Text model unavailable"}</p>
      <p className="workspace-media-privacy"><span aria-hidden="true">◦</span> Raw images, audio and video stay in your browser.</p>
    </div>
  </section>;
}
