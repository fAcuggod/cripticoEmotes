# Críptico Emotes — baulo (Kick / 7TV)

Juego diario de acertijos crípticos inspirado en [criptico.es](https://criptico.es), adaptado exclusivamente al set de emotes **7TV** del canal de Kick de **baulo** ([ver set en 7TV](https://7tv.app/users/01FT80E0280001E12995B11F56)).

## Características

- **Acertijo diario sincronizado por fecha** con 5 intentos y calendario de días anteriores.
- **886 emotes válidos de baulo** (nombres alfabéticos y emotes numéricos como `44`, `99`, `35`, `34`, `51`, excluyendo símbolos iniciales como `:0` y términos ofensivos/explícitos).
- **Priorización por uso real en el chat** de baulo (combinando estadísticas históricas de StreamElements, emotes propios del canal/Kick y catálogo 7TV).
- **Pistas interactivas**: Definición (verde), Indicador (ámbar), Material (rojo) y Revelar letra/cifra.
- **Teclado adaptativo**: QWERTY para emotes alfabéticos y teclado numérico automático para emotes de cifras.
- **Revelación del emote real de 7TV** (animado o estático) junto con su descripción y explicación al terminar la partida.
- **Rachas, estadísticas y colección local** guardadas en `localStorage` (sin necesidad de cuentas).

## Desarrollo local

```bash
npm install
npm run dev
```

### Scripts disponibles

- `npm run dev` — Genera `public/puzzles.json` e inicia el servidor de desarrollo de Vite.
- `npm run build` — Genera los acertijos y compila el sitio estático en `dist/`.
- `npm run check` — Valida automáticamente que todos los acertijos tengan formato válido, sin filtraciones en la definición y con juegos de palabras matemáticamente verificables.
- `npm run update-emotes` — Descarga el set actualizado de 7TV y estadísticas de chat de baulo en `data/`.

## Despliegue en GitHub Pages

El repositorio incluye el flujo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) que compila y publica `dist/` automáticamente al hacer push en `main`.
