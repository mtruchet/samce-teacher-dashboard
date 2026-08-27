# samce-teacher-dashboard

El panel docente de SAMCE: muestra en vivo qué alumnos están rindiendo cada
examen del aula virtual.

No tiene usuario ni contraseña propios. El docente entra desde Moodle por el
complemento `local_samce`, que firma un token con su identidad y sus cursos; el
panel lo canjea en `samce-backend` por una sesión y a partir de ahí solo habla
con el backend.

## Cómo se entra

Hay dos puertas, y las dos llevan acá:

- **Desde un curso.** El ítem *Panel de supervisión SAMCE*, en el menú del
  curso. El panel abre en ese curso.
- **Desde el campus.** *Panel SAMCE (todos mis cursos)*, en la navegación
  general. El panel abre en la lista de todas las materias donde el usuario da
  clase.

La diferencia la marca el token: uno trae un curso, el otro la lista completa.
El resto del panel es el mismo.

## Qué muestra

Se recorre por niveles, y cada pantalla responde una sola pregunta:

```
Todos mis cursos  ›  Sistemas de Información II  ›  Primer Parcial
     (cursos)              (exámenes)                 (alumnos)
```

Cada ficha adelanta lo que hay adentro, para no tener que abrirlas una por una,
y el nivel queda en la dirección (`/panel?curso=2&examen=25`), así el botón de
volver del navegador funciona y recargar en medio de un examen no devuelve al
principio.

De cada alumno se muestra su número del aula virtual, que es el puente hacia el
campus: el panel no guarda nombres, y el docente ya tiene permiso para verlos
allá. Si rindió más de una vez el mismo examen, la fila aclara en cuál va, por
orden de comienzo.

Los exámenes aparecen solos: nadie los da de alta. Cuando un alumno abre el
cuestionario, el complemento avisa al backend y la sesión se registra sin que
haya que activar nada.

El panel vuelve a preguntar cada cinco segundos, y lo dice: el encabezado tiene
una cuenta regresiva hasta el próximo dato. Una pantalla quieta sin esa señal no
permite distinguir «no hay nadie rindiendo» de «se cortó el monitoreo».

## Levantar en local

```bash
cp .env.example .env
npm install
npm run dev
```

Necesita `samce-backend` en `http://localhost:8080`. Para el flujo completo hace
falta además la réplica de Moodle con el complemento instalado y apuntando al
panel (ver `samce-entorno-moodle` y `samce-moodle-plugin`).

### Variables

| | |
|---|---|
| `VITE_API_URL` | dirección de `samce-backend` |
| `VITE_MOODLE_URL` | dirección del campus, para volver a él y para el enlace del panel general |

Las dos tienen un valor de respaldo si faltan, para que una variable sin definir
no deje `undefined` en el medio de una dirección. Igual conviene definirlas: el
respaldo del backend es el de desarrollo.

### Entrar sin Moodle

Para probar el panel sin levantar el campus entero, hay un script que arma un
enlace firmado igual que el complemento:

```bash
MOODLE_LAUNCH_SECRET="el-mismo-del-backend" python scripts/enlace-de-prueba.py
```

El token vence a los sesenta segundos, así que el enlace se usa enseguida. El
secreto no está en el repositorio: sale de la variable de entorno o de
`--secreto`, y tiene que coincidir con el del backend y el del complemento.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run test     # pruebas con Vitest
npm run lint     # ESLint
npm run build    # verifica tipos y compila
```

## Cómo está armado

React 18 con TypeScript sobre Vite 8, React Router y Vitest. Sin librería de
componentes: el sistema visual es propio y vive en `src/styles/tokens.css`.

```
src/
  pages/       una pantalla cada uno: portada, traspaso, panel, salida
  components/  las piezas del panel y de la portada
  services/    lo que habla con el backend
  styles/      tokens y estilos base
  iconos.ts    los iconos, importados de a uno
```

Los iconos se importan uno por uno y no desde el índice del paquete: ese índice
son diecisiete megas que el navegador descarga antes de poder pintar nada. Cada
pantalla, además, se descarga cuando alguien la pide.

## Despliegue

Pensado para Vercel, con `vercel.json` reescribiendo las rutas al `index.html`
para que funcionen las direcciones profundas. Hay que definir `VITE_API_URL` y
`VITE_MOODLE_URL` en el proyecto. Todavía no está desplegado.
