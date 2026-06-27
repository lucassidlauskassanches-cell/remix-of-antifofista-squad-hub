export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/");
    const i = parts.findIndex((p) => p === "embed" || p === "shorts");
    if (i >= 0) return parts[i + 1] ?? null;
    return null;
  } catch {
    return null;
  }
}

export function YouTubePlayer({ url }: { url: string }) {
  const id = extractYouTubeId(url);
  if (!id) return <p>Vídeo inválido</p>;
  return (
    <div className="aspect-video w-full">
      <iframe
        className="w-full h-full rounded-md"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="Vídeo do exercício"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
