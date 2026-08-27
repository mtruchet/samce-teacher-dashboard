# Landing y acceso al panel docente — análisis y diseño

Documento de trabajo para HU01. Define qué se construye, con qué criterio y en qué orden. No es el informe de cátedra: es la referencia técnica del equipo.

---

## 1. De dónde salen los requisitos

**HU01 (RF01)**, según el Registro de Historias de Usuario del Informe 5:

> Como docente, quiero autenticarme en el sistema con mi perfil institucional, para acceder al panel docente con un rol diferenciado respecto del alumnado.

Con tres criterios de aceptación: que el docente pueda iniciar sesión con sus credenciales institucionales, que el sistema rechace el acceso ante credenciales inválidas, y que redirija al panel tras una autenticación exitosa.

La historia está estimada en 13 horas y se reparte en dos tareas: **HU01_T01**, el modelo de usuario y el endpoint de login en el backend, con 8 horas; y **HU01_T02**, la pantalla de inicio de sesión en el panel, con 5 horas.

Condicionan además el diseño dos requisitos no funcionales. El **RNF10** exige una interfaz clara, simple e intuitiva, que permita interpretar la información sin conocimientos avanzados en inteligencia artificial. El **RNF08** pide compatibilidad con navegadores modernos e independencia del sistema operativo.

---

## 2. El mecanismo de acceso cambió, y la historia quedó desactualizada

La historia describe un inicio de sesión con credenciales. El mecanismo definido para el proyecto es distinto: el docente ya está autenticado en el Campus Virtual, el complemento coloca allí un botón, ese botón lleva al panel, el backend emite un token y el panel lo valida.

**No hay formulario de usuario y contraseña.** El panel nunca ve una credencial: recibe una prueba de que el Campus Virtual ya autenticó a esa persona.

Esto es consistente con la arquitectura adoptada en el Sprint 0, donde la identidad la provee la plataforma de manera nativa. Pero deja a HU01 en la misma situación que a HU02, HU10, HU11 y HU12: **redactada para un flujo que ya no es el que se va a construir**.

El Informe 5 documenta que esas cuatro historias se adecuarán durante el refinamiento previo al sprint que las incorpore, y que el Definition of Ready impide comprometerlas sin esa adecuación. **HU01 debería sumarse a esa lista**, porque su redacción actual y sus criterios de aceptación no describen el mecanismo real. En particular, iniciar sesión con credenciales institucionales y rechazar credenciales inválidas pasan a ser validar el traspaso desde el Campus Virtual y rechazar un traspaso inválido o vencido.

Conviene resolverlo antes de escribir código, porque de esa redacción salen los criterios con los que después se da por terminada la tarea.

---

## 3. El flujo de acceso

El traspaso desde el Campus Virtual hasta el panel, paso a paso:

1. El docente, ya autenticado en el Campus Virtual, encuentra el acceso al panel que coloca el complemento.
2. Al activarlo, el complemento obtiene del backend un código de un solo uso y de vida corta.
3. El navegador llega al panel con ese código.
4. El panel lo entrega al backend y recibe a cambio el token de sesión.
5. El panel borra el código de la barra de direcciones y entra al área privada.

### Lo que hay que cuidar

**El código va una sola vez y dura poco.** Si se reutiliza o sobrevive, cualquiera que vea la dirección en un historial compartido entra al panel. La ventana razonable es del orden de un minuto: lo justo para el redireccionamiento.

**El código no puede quedar en el historial.** Apenas se canjea, hay que reemplazar la entrada del historial para que la dirección con el código desaparezca de la barra y del botón de volver.

**El destino del redireccionamiento no puede ser arbitrario.** Si el complemento acepta una dirección de retorno por parámetro, alguien podría usar el Campus Virtual para mandar gente a un sitio ajeno. La dirección del panel debe estar fijada en la configuración, no venir en la petición.

**Dónde guardar el token de sesión** es la decisión con más consecuencias, y afecta al backend, así que hay que acordarla con quien lo desarrolla. Las opciones razonables:

| Opción | A favor | En contra |
|---|---|---|
| Solo en memoria | Nada persiste; un script malicioso no lo encuentra guardado | Se pierde al recargar y hay que volver a entrar desde el Campus |
| Memoria más renovación por cookie protegida | Sobrevive a la recarga sin exponer el token | Exige que el backend emita y valide esa cookie, y protección adicional contra falsificación de peticiones |
| Almacenamiento del navegador | Simple y sobrevive a todo | Queda accesible a cualquier script que se cuele en la página |

La segunda es la que recomienda la práctica actual para aplicaciones de una sola página. La tercera es la más común y la más floja. Como el panel maneja evidencia académica sobre conducta de estudiantes, conviene no elegir la más floja solo por comodidad.

---

## 4. Qué se construye

### La página pública

Es la cara visible del sistema y la que se muestra en la defensa, así que además de funcionar tiene que explicar. Cuatro bloques, en este orden:

**Qué es el SAMCE.** Una frase que se entienda sin contexto previo: un sistema que acompaña la supervisión de exámenes en línea analizando cómo se interactúa con la evaluación, no lo que se escribe en ella.

**Cómo funciona.** Tres pasos: el examen comienza y el monitoreo se activa solo, el sistema observa señales de interacción, el docente ve un índice y alertas que lo ayudan a decidir. Sin jerga de aprendizaje automático, por el RNF10.

**Qué no hace.** Este bloque es deliberado y es el que más peso tiene para el proyecto: no usa cámara, no usa micrófono, no toma datos biométricos, no lee el contenido de las respuestas y no sanciona a nadie de manera automática. La no invasividad es el criterio rector del proyecto y la página es el lugar natural para dejarlo dicho.

**Cómo se entra.** Que el acceso es desde el Campus Virtual, porque el sistema usa la identidad que la plataforma ya verificó. Con una indicación de dónde encontrar el acceso.

### La pantalla de traspaso

La misma dirección, cuando llega con un código, se comporta distinto. Tiene tres estados.

Mientras valida, un mensaje breve de que se está verificando el acceso. Si el código es válido, entra al panel sin más intervención. Si no lo es, un mensaje que explique qué pasó y qué hacer: que el acceso venció o ya se usó, y que hay que volver a entrar desde el Campus Virtual.

Ese tercer estado importa más de lo que parece. Es el que va a ver un docente al recargar la página, y la diferencia entre que entienda qué hacer o que crea que el sistema se rompió.

### El área privada

Por ahora, apenas una pantalla que confirme que la sesión está iniciada y muestre quién entró. Las pantallas de supervisión son de historias posteriores. Lo que sí conviene dejar armado es el mecanismo que impide llegar ahí sin sesión válida, porque es lo que van a reutilizar todas las pantallas que vengan.

---

## 5. Decisiones técnicas

El panel hoy es React con TypeScript sobre Vite, con las pruebas ya configuradas y sin librería de interfaz, según decisión tomada al armar el andamiaje.

**Enrutado.** Hace falta, porque hay al menos una zona pública y una privada, y porque el código llega por la dirección. Es la única dependencia claramente imprescindible.

**Formularios y validación.** La combinación habitual para formularios pierde sentido acá: no hay formulario que validar. Lo que sí conviene validar es la forma de las respuestas del backend, para que el panel no falle ante una respuesta inesperada. Eso se puede resolver con una librería de validación de esquemas o con comprobaciones escritas a mano; con un solo endpoint, escribirlas a mano es defendible y evita sumar una dependencia que todavía no se paga.

**Interfaz.** La página pública tiene bastante contenido y conviene que se vea bien. Las opciones son escribir los estilos a mano, lo que da control total y ninguna dependencia, o adoptar un conjunto de componentes accesibles. La ventaja del segundo camino aparece más adelante, cuando lleguen las tablas, los filtros y los gráficos de las historias siguientes: esos componentes son costosos de hacer bien a mano y de dejar accesibles. **Conviene decidirlo ahora y no cuando ya haya pantallas escritas de las dos formas.**

**Preparación para el backend.** El panel se construye contra una capa de servicios propia, con los tipos de datos definidos y una implementación falsa que responde lo mismo que responderá el backend. Conectar después es reemplazar esa implementación, sin tocar las pantallas. Es lo que permite avanzar hoy sin el endpoint terminado, y lo que hace que conectarlo sea cuestión de minutos cuando esté.

---

## 6. Sobre el alcance y la estimación

La tarea HU01_T02 está estimada en cinco horas y describe una pantalla de inicio de sesión con formulario, validaciones y manejo de errores.

Lo que se va a construir es distinto en dos sentidos. Por un lado es **menos**: no hay formulario ni validación de credenciales. Por otro es **más**: la página pública de presentación no está contemplada en esa tarea ni en ninguna otra del cronograma.

Conviene decidir explícitamente cómo se registra eso, porque el proyecto ya arrastra una observación por documentar trabajo fuera de la línea base. Las alternativas son ampliar el alcance de HU01_T02 dejando constancia del motivo, o registrar la página como una actividad aparte. Lo que no conviene es construirla sin que figure en ningún lado.

---

## 7. Plan de trabajo

**Primero, cerrar lo que no es código.** Re-redactar HU01 y sus criterios de aceptación para el mecanismo real, y acordar con quien desarrolla el backend el contrato del acceso: cómo se pide el código, cómo se canjea, qué devuelve, cuánto dura y dónde vive el token. Sin ese acuerdo, la capa de servicios se escribe a ciegas y se reescribe después.

**Segundo, el esqueleto.** Enrutado, la separación entre zona pública y privada, el mecanismo que protege las rutas, y la capa de servicios con sus tipos y su implementación falsa. Al terminar esto, el flujo completo se puede recorrer de punta a punta sin backend.

**Tercero, la página pública.** Los cuatro bloques de contenido, con sus estilos y su comportamiento en pantallas chicas.

**Cuarto, el traspaso.** Los tres estados, el borrado del código de la barra de direcciones y el manejo de los casos de error.

**Quinto, verificar.** Pruebas de la capa de servicios y del comportamiento de las rutas protegidas, que es donde un error se paga caro. El andamiaje ya tiene el entorno de pruebas configurado.

**Sexto, conectar.** Cuando el endpoint esté, reemplazar la implementación falsa por la real y comprobar el flujo contra el backend de verdad.

Los primeros cinco pasos no dependen del backend. El sexto sí, y es el único.
