// A small signature check supplements MIME allowlists and real browser decoding.
export async function fileSignatureMatches(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const hex = (offset: number, values: number[]) => values.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, text: string) => [...text].every((value, index) => bytes[offset + index] === value.charCodeAt(0));
  if (file.type === "image/png") return hex(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  if (file.type === "image/jpeg") return hex(0, [255, 216, 255]);
  if (file.type === "image/webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  if (file.type === "video/webm") return hex(0, [26, 69, 223, 163]);
  if (file.type === "video/mp4") return ascii(4, "ftyp");
  if (file.type === "video/quicktime") return ["ftyp", "moov", "mdat", "wide", "free"].some(atom => ascii(4, atom));
  if (["audio/wav", "audio/x-wav", "audio/wave"].includes(file.type)) return ascii(0, "RIFF") && ascii(8, "WAVE");
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") return ascii(0, "ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (file.type === "audio/mp4" || file.type === "audio/x-m4a") return ascii(4, "ftyp");
  if (file.type === "audio/ogg") return ascii(0, "OggS");
  if (file.type === "audio/flac" || file.type === "audio/x-flac") return ascii(0, "fLaC");
  if (file.type === "audio/webm") return hex(0, [26, 69, 223, 163]);
  return false;
}
