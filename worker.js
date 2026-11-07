import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";
let asr = null;
const SR = 16000, BLOCK = 300 * SR, WIN = 10 * SR;

// Cerca, entro ±10 s dal punto previsto, la finestra da 100 ms con meno energia (una pausa nel parlato).
function quietestPoint(a, target) {
  const w = SR / 10, step = w / 2;
  let best = target, min = Infinity;
  for (let p = Math.max(0, target - WIN); p + w < Math.min(a.length, target + WIN); p += step) {
    let e = 0;
    for (let j = p; j < p + w; j++) e += a[j] * a[j];
    if (e < min) { min = e; best = Math.floor(p + w / 2); }
  }
  return best;
}

async function load(model) {
  const progress_callback = p => { if (p.status === "progress") postMessage({ type: "progress", value: p.progress }); };
  try {
    if (!navigator.gpu) throw new Error("no webgpu");
    asr = await pipeline("automatic-speech-recognition", model, {
      device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" }, progress_callback });
    return "webgpu";
  } catch (e) {
    asr = await pipeline("automatic-speech-recognition", model, { device: "wasm", dtype: "q8", progress_callback });
    return "wasm";
  }
}

onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      postMessage({ type: "ready", device: await load(data.model) });
    } else if (data.type === "run") {
      const audio = data.audio;
      let start = data.startAt || 0;           // permette di riprendere un lavoro interrotto
      while (start < audio.length) {
        const end = audio.length - start <= BLOCK + WIN ? audio.length : quietestPoint(audio, start + BLOCK);
        const r = await asr(audio.subarray(start, end), {
          chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, task: "transcribe",
          ...(data.lang ? { language: data.lang } : {}) });
        const off = start / SR;
        const segments = (r.chunks || []).map(c => ({
          start: off + (c.timestamp[0] ?? 0),
          end: c.timestamp[1] == null ? null : off + c.timestamp[1],
          text: c.text.trim() })).filter(s => s.text);
        postMessage({ type: "chunk", segments, pos: end, len: audio.length });
        start = end;
      }
      postMessage({ type: "done" });
    }
  } catch (e) {
    postMessage({ type: "error", message: String(e.message || e) });
  }
};
