# samce-teacher-dashboard

El panel docente de SAMCE: muestra en vivo qué alumnos están rindiendo cada
examen del aula virtual, qué pasó durante cada intento y qué encontró el análisis
en cada sesión.

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
Todos mis cursos  ›  Sistemas de Información II  ›  Primer Parcial  ›  Ana Gómez
     (cursos)              (exámenes)                 (alumnos)        (eventos)
```

Cada ficha adelanta lo que hay adentro, para no tener que abrirlas una por una,
y el nivel queda en la dirección (`/panel?curso=2&examen=25`), así el botón de
volver del navegador funciona y recargar en medio de un examen no devuelve al
principio.

De cada alumno se muestra su nombre, que es lo que el docente reconoce, y debajo
su número del aula virtual, que es el puente para buscarlo en el campus. El
nombre viaja cifrado desde el aula virtual y el panel no lo guarda: lo pide en
cada consulta y vive sólo mientras la pantalla está abierta. Si la sesión es
anterior a que el aula virtual empezara a mandarlo, la fila cae en el número, que
alcanza para identificar a quien está rindiendo. Y si rindió más de una vez el
mismo examen, aclara en cuál va, por orden de comienzo.

Cada sesión dice también lo que se ve de su análisis, en la columna «Análisis»: su
nivel de riesgo, que es el más alto entre los de sus alertas, con su marca y con
cuántas alertas tiene y de dónde salieron («2 alertas: en toda la sesión y en un
momento de la sesión»); o, si no tiene alertas, el estado de su análisis («Sin
alertas», «Sin analizar», «No se pudo analizar» o «Análisis no disponible»).

Arriba de la lista, el resumen de la evaluación cuenta las sesiones de todo el
examen en siete tarjetas, siempre en el mismo orden: Riesgo alto, Riesgo medio,
Riesgo bajo, Sin alertas, Sin analizar, No se pudo analizar y Análisis no
disponible. Son recuentos, sin nombres ni promedios, y cada tarjeta filtra la
lista. Debajo, una barra permite filtrar por nivel de riesgo y por estado, buscar
al alumno por su nombre y ordenar por hora de inicio (lo predeterminado) o por
nivel de riesgo. Con un filtro se lee cuántas sesiones lo cumplen sobre el total
(«16 de 245 sesiones») y un solo «Quitar filtros». Los filtros quedan en la
dirección, así sobreviven a la actualización y al botón Atrás.

Desde cada sesión se abre su detalle. Arriba va una ficha de una sola línea con
lo que la lista no alcanza a decir: si entregó, qué intento es, qué día y a qué
hora empezó y cuánto duró. Debajo están el análisis y el registro.

El apartado **«Análisis de la sesión»** muestra lo que el análisis encontró:

- **El veredicto**, una frase con la misma forma en todos los estados: «Hay 2
  alertas para revisar.», «No hay alertas para revisar.», «Esta sesión todavía no
  se analizó.», «Esta sesión no se pudo analizar.» o «El análisis no está
  disponible en este momento.». Cuenta las alertas y dice de qué tratan, pero
  nunca dice un nivel. Cuando una sesión no se pudo analizar, da el motivo y
  aclara que eso no indica ningún problema en el examen.
- **Una tarjeta por alerta vigente**, con su nivel («Riesgo bajo», «Riesgo
  medio» o «Riesgo alto»), un medidor de tres segmentos que dice lo mismo en
  dibujo y su origen: «En toda la sesión» o «En un momento de la sesión». Debajo
  va el hecho en una oración y, en la alerta de toda la sesión, «Lo que más se
  notó»: una frase por cosa, con cifras que el docente puede comprobar en el
  registro («Pasó a otra ventana 11 veces.»).
- **Cómo cambió el riesgo**: los niveles que tomó la sesión, uno detrás de otro,
  con la hora del análisis que registró cada subida.
- **El historial de alertas**: cada aparición o subida de nivel de cada alerta,
  con su explicación. Si la explicación es la misma que la de la alerta vigente,
  queda plegada para no leerla dos veces.
- **Las métricas de la sesión**, cuando la sesión terminó y se analizó: seis
  valores del propio alumno en palabras («un minuto y 33 segundos», «No pegó
  texto»), sin valores esperados ni comparaciones con otras sesiones.

Los textos de las alertas y el motivo de una sesión que no se pudo analizar los
escribe el motor de análisis para el docente, y el panel los muestra tal cual,
sin traducirlos ni recortarlos. Una alerta señala algo para revisar y no una
conclusión sobre el alumno. El apartado se actualiza mientras el alumno rinde y
unos minutos después de la entrega, y un lector de pantalla anuncia la alerta que
aparece o sube de nivel mientras se mira. Lo pide a
`GET /monitored-quizzes/{id}/sessions/{sessionId}/analysis`, que tiene el mismo
control de acceso que el registro de eventos.

El registro cuenta lo que pasó durante el intento: un evento por fila, con su
hora, qué pasó y el detalle, del más reciente al más antiguo. El encabezado dice
cuántos eventos hay y entre qué horas («194 eventos, de 09:28 a 09:42»), y las
filas están escritas en palabras de todos los días, sin abreviaturas ni términos
técnicos («Movimiento del mouse», o «Volvió a la ventana del examen» con el
detalle «45 segundos afuera»). Arriba de la tabla, **«Momentos para revisar»**
lista los pegados y las salidas de la ventana o de la pantalla completa, de lo
más viejo a lo más nuevo, y cada uno lleva a su fila. El registro se recorre
entero, de a tandas o con «Mostrar todos», y se lee igual en el teléfono. Se
actualiza mientras el alumno rinde y unos minutos después de la entrega, porque
lo último del intento llega con retraso. El registro cuenta y no juzga: no tiene
nivel de riesgo, alertas ni orden por relevancia. La lista marca las sesiones
cuya captura quedó incompleta, y el registro explica qué no quedó registrado.

En ninguna pantalla aparece el índice de integridad, ni sus partes.

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
python scripts/enlace-de-prueba.py --env ../samce-backend/.env --abrir
```

El token vence a los sesenta segundos, así que el enlace se usa enseguida
(`--abrir` lo abre en el navegador). El secreto no está en el repositorio: sale
de la variable de entorno, de `--secreto` o del `.env` del backend que se pase
con `--env`, y tiene que coincidir con el del backend y el del complemento.

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
  pages/            una pantalla cada una: portada, traspaso, panel, sin sesión
  components/       las piezas del panel y de la portada
  services/         lo que habla con el backend
  config/           las direcciones del backend y del campus
  styles/           tokens y estilos base
  eventos.ts        cómo se cuenta cada evento en el registro
  huecos.ts         los silencios entre eventos
  captura.ts        el aviso de una captura incompleta
  explicacion.ts    cómo se ordena, renglón por renglón, el texto de una alerta
  lenguajeAlerta.ts los niveles, sus palabras y el orden de las alertas
  veredicto.ts      la frase de arriba del análisis
  evolucion.ts      los pasos de «Cómo cambió el riesgo»
  metricas.ts       los rótulos y los formatos de las métricas
  filtrosDeLaDireccion.ts  los filtros de la lista, leídos y escritos en la dirección
  seguimiento.ts    hasta cuándo se sigue preguntando por una sesión cerrada
  secciones.ts      las secciones de la portada
  iconos.ts         los iconos, importados de a uno
  test/             datos de prueba compartidos
scripts/            el enlace de prueba para entrar sin Moodle
docs/               notas de diseño
```

Los iconos se importan uno por uno y no desde el índice del paquete: ese índice
son diecisiete megas que el navegador descarga antes de poder pintar nada. Cada
pantalla, además, se descarga cuando alguien la pide.

## Despliegue

Pensado para Vercel, con `vercel.json` reescribiendo las rutas al `index.html`
para que funcionen las direcciones profundas. Hay que definir `VITE_API_URL` y
`VITE_MOODLE_URL` en el proyecto. Está desplegado en Vercel, que publica solo
cada vez que algo entra en `main`.
