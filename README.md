# Críptico Emotes — baulo (Kick / 7TV)

Juego diario de acertijos crípticos inspirado en [criptico.es](https://criptico.es), adaptado exclusivamente a los emotes **7TV** más utilizados y activos del canal de Kick de **baulo** ([ver set en 7TV](https://7tv.app/users/01FT80E0280001E12995B11F56)).

## Características

- **Acertijo diario sincronizado por fecha** con 5 intentos y calendario/archivo de días anteriores.
- **221 emotes activos y reconocibles de baulo** (se excluyen los ~665 emotes de uso muy bajo `<= 5%` / relleno poco frecuente, símbolos iniciales como `:0` y términos explícitos o discriminatorios).
- **Dificultad graduada con contexto real de chat**:
  - **Emotes más utilizados (> 5% relativo en chat)** y **emotes de nombre corto (≤ 5 letras)**: pistas crípticas artesanales más exigentes, basadas en su contexto real de uso en el chat y juegos de palabras genuinos ([`data/curated-clues.json`](data/curated-clues.json)).
  - **15 emotes numéricos** (`11`, `32`, `34`, `35`, `44`, `45`, `51`, `52`, `55`, `69`, `77`, `83`, `90`, `95`, `99`): retos de lógica y razonamiento matemático de nivel secundario, con teclado numérico automático.
- **Pistas interactivas**: Definición (verde), Indicador (ámbar), Material (rojo) y Revelar letra/cifra.
- **Revelación del emote real de 7TV** (animado o estático) junto con su descripción y explicación al terminar.
- **Rachas, estadísticas y colección local** guardadas en `localStorage` (sin cuentas).

## Desarrollo local

```bash
npm install
npm run dev
```

### Scripts disponibles

- `npm run dev` — Genera `public/puzzles.json` e inicia el servidor de desarrollo de Vite.
- `npm run build` — Genera los acertijos y compila el sitio estático en `dist/`.
- `npm run check` — Valida automáticamente los 221 acertijos (formato de marcas, cero filtraciones y verificación de reglas).
- `npm run update-emotes` — Descarga el set actualizado de 7TV y estadísticas de chat de baulo en `data/`.

## Despliegue

- **GitHub Pages**: flujo automático en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
- **Vercel**: configuración lista en [`vercel.json`](vercel.json) (`vite`, `npm run build`, `dist/`). Puedes importarlo en un clic desde [vercel.com/new](https://vercel.com/new/clone?repository-url=https://github.com/fAcuggod/cripticoEmotes).

## Enlaces

- Repositorio: [github.com/fAcuggod/cripticoEmotes](https://github.com/fAcuggod/cripticoEmotes)
- Autor en X: [@facugod0](https://x.com/facugod0)
