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

Este scaffold fue armado sin poder correr `npm install` en la máquina donde
se escribió (no había Node.js instalado), así que **no incluye
`package-lock.json`**. Al hacer el primer `npm install` local, revisar que
no haya conflictos de versiones y commitear el lockfile generado.
