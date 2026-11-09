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

async function load(model, engine) {
  const progress_callback = p => { if (p.status === "progress") postMessage({ type: "progress", value: p.progress }); };
  const big = /large/.test(model), gpu = !!navigator.gpu;
  if (engine === "gpu" && !gpu) throw new Error("WebGPU non disponibile in questo browser");
  if (big && !gpu) throw new Error("Large v3 Turbo richiede WebGPU: scegli Small");
  if (engine !== "wasm" && gpu) {
    try {
      asr = await pipeline("automatic-speech-recognition", model, {
        device: "webgpu",
        dtype: { encoder_model: big ? "fp16" : "fp32", decoder_model_merged: "q4" }, progress_callback });
      return "webgpu";
    } catch (e) { if (big || engine === "gpu") throw e; }
  }
  if (big) throw new Error("Large v3 Turbo non funziona senza GPU: scegli Small");
  asr = await pipeline("automatic-speech-recognition", model, { device: "wasm", dtype: "q8", progress_callback });
  return "wasm";
}

onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      postMessage({ type: "ready", device: await load(data.model, data.engine || "auto") });
    } else if (data.type === "run") {
      const audio = data.audio, recent = [];
      let beams = data.beams, start = data.startAt || 0;   // start: riprende un lavoro interrotto
      // Scarta la terza ripetizione identica di fila (tipica allucinazione di Whisper sul silenzio).
      const keep = s => {
        const t = s.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        if (recent.length >= 2 && recent[0] === t && recent[1] === t) return false;
        recent.unshift(t); recent.length = Math.min(recent.length, 2); return true;
      };
      while (start < audio.length) {
        const end = audio.length - start <= BLOCK + WIN ? audio.length : quietestPoint(audio, start + BLOCK);
        const slice = audio.subarray(start, end);
        const opts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, task: "transcribe",
          ...(data.lang ? { language: data.lang } : {}) };
        let r;
        try { r = await asr(slice, beams ? { ...opts, num_beams: 5 } : opts); }
        catch (e) {
          if (!beams) throw e;
          beams = false;
          postMessage({ type: "warn", message: "Beam search non disponibile su questo dispositivo: uso la modalità standard." });
          r = await asr(slice, opts);
        }
        const off = start / SR;
        const segments = (r.chunks || []).map(c => ({
          start: off + (c.timestamp[0] ?? 0),
          end: c.timestamp[1] == null ? null : off + c.timestamp[1],
          text: c.text.trim() })).filter(s => s.text && keep(s));
        postMessage({ type: "chunk", segments, pos: end, len: audio.length });
        start = end;
      }
      postMessage({ type: "done" });
    }
  } catch (e) {
    postMessage({ type: "error", message: String(e.message || e) });
  }
};
