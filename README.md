# samce-teacher-dashboard

SAMCE - Panel docente en React, monitoreo en tiempo real.

Estado actual (Sprint 1): scaffolding base — Vite + React + TypeScript, con
una única pantalla que verifica conectividad contra `/ping` del backend.
Sin librería de UI todavía (se suma cuando arranque el diseño real de
pantallas, no en este scaffold).

## Requisitos

- Node.js 20+

## Levantar en local

```bash
cp .env.example .env
npm install
npm run dev
```

Requiere `samce-backend` corriendo en `http://localhost:8080` (ver su
README) para que la pantalla muestre el estado de `/ping` correctamente.

## Build / Lint

```bash
npm run build
npm run lint
```

## Deploy

Pensado para Vercel (`vercel.json` con rewrite de SPA). Variable de entorno
`VITE_API_URL` apuntando a la URL pública de `samce-backend`. Todavía no
está desplegado — falta configurar el proyecto en Vercel.

## Nota

`npm install`, `lint` y `build` ya se corrieron y verificaron de verdad
(Node 20.20.2) — `package-lock.json` está commiteado. `npm audit` reporta 2
vulnerabilidades (esbuild/vite, dev-server only) cuya única fix disponible
es un upgrade breaking a Vite 8; se dejó sin aplicar por ahora.
