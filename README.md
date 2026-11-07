# Scriptorium

Trascrizione audio→testo che gira interamente nel browser (Whisper + Transformers.js, in un Web Worker). Nessun server, nessun account, nessuna quota.

## Funzioni
- Più file in coda, trascinamento, registrazione dal microfono
- Barra di avanzamento, stima del tempo rimanente, avvisi sul dispositivo
- Annulla e Riprendi: il lavoro interrotto riparte dall'ultimo blocco completato
- Salvataggio automatico nel browser (IndexedDB): sopravvive a refresh e chiusure
- Editor con player sincronizzato: clic su ▶ per riascoltare, testo modificabile, etichette «Voce» manuali
- Glossario di correzioni (`errato = corretto`)
- Export: `.txt`, `.srt`, Word semplice, Word formattato, tutti i Word insieme
- Installabile come app e utilizzabile offline dopo il primo caricamento (PWA)

## Aggiornamenti
La cache offline si rinnova solo se cambi il valore di `V` in `sw.js` a ogni modifica ai file. Dopo un aggiornamento, ricarica la pagina due volte.

## Note
- Con WebGPU (Chrome/Edge recenti) è rapido; senza, usa la CPU ed è molto più lento.
- Modelli disponibili: tiny, base, small. Il `medium` del Colab è troppo pesante per il browser.
- File e trascrizioni restano nel browser finché non li elimini (× o «Elimina tutto»).

© 2026 Beerethor · Mala Tempora Currunt — codice MIT; nome e logo riservati.
