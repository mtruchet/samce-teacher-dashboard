import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { LARGO_MAXIMO_BUSQUEDA, NIVELES_FILTRO, type FiltrosSesiones as Filtros } from "../filtrosDeLaDireccion";
import { NIVELES } from "../lenguajeAlerta";
import "./FiltrosSesiones.css";

/** Cuánto se espera después de la última tecla antes de buscar: no se pide en cada letra. */
export const ESPERA_BUSQUEDA_MS = 300;

/** Lo que la barra deja hacer desde afuera. */
export interface ControlBusqueda {
  /**
   * Descarta la búsqueda que se estaba esperando escribir y vacía el campo. Lo llama quien borra la búsqueda
   * antes de que llegue a la dirección (una tarjeta del resumen, «Quitar filtros»): sin esto, la espera
   * vencía después y sumaba una búsqueda que el docente ya había descartado.
   */
  cancelarBusqueda: () => void;
}

interface Props {
  filtros: Filtros;
  /** Recibe solo lo que cambió; quien lo monta lo escribe en la dirección de la página. */
  onCambio: (parciales: Partial<Filtros>) => void;
  /** El selector de nivel, el primer control de la barra: adonde vuelve el foco después de «Quitar filtros». */
  nivelRef?: Ref<HTMLSelectElement>;
  /** Para cancelar desde afuera una búsqueda que todavía no llegó a la dirección. */
  controlRef?: Ref<ControlBusqueda>;
}

/**
 * La barra de filtros de la lista de sesiones (HU04): nivel de riesgo, estado, búsqueda por nombre y
 * orden. Es controlada: los valores vienen de la dirección de la página y cada cambio vuelve a ella,
 * así sobreviven a la actualización automática y al botón Atrás. Solo guarda el texto de la búsqueda
 * mientras espera que el docente deje de escribir.
 *
 * El orden predeterminado es por hora de inicio. Ordenar por nivel es una opción del docente, que
 * agrupa por nivel dentro de cada grupo y, a igual nivel, conserva la hora de inicio: nunca un
 * ranking por índice.
 *
 * Los niveles se nombran como en las tarjetas del resumen y en la lista («Riesgo alto»): el selector y la
 * tarjeta son dos caminos al mismo filtro y se reflejan entre sí. Nivel y estado del análisis se excluyen:
 * elegir un nivel borra el filtro de análisis (lo resuelve `escribirFiltros`).
 *
 * Va dentro de la lámina de control, sin lámina propia. «N de M sesiones» y «Quitar filtros» no son de la
 * barra: van en el renglón de resultado (`ResultadoDelFiltro`), debajo.
 */
export function FiltrosSesiones({ filtros, onCambio, nivelRef, controlRef }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(filtros.q ?? "");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La espera llama siempre a la última función recibida, no a la de la vuelta en que se tecleó: si en esos
  // 300 ms el docente eligió un nivel, la función vieja lo borraba al escribir la búsqueda.
  const alCambiar = useRef(onCambio);
  useEffect(() => {
    alCambiar.current = onCambio;
  }, [onCambio]);

  // Si la búsqueda cambia desde afuera (Atrás, «Quitar filtros», una tarjeta), el campo la sigue y lo que se
  // estaba esperando escribir ya no vale. Pero no todo cambio de `q` viene de afuera: react-router confirma
  // la navegación en una transición, así que la búsqueda que mandó el propio campo llega un rato después, y
  // el docente pudo seguir tecleando en el medio. Por eso se recuerda lo último que mandó el campo
  // (`enviada`): si `q` llega con eso, es la vuelta de lo propio y no se toca ni el texto ni la espera.
  // Con un cambio de afuera, el texto se pisa solo si dice otra cosa: la dirección guarda la búsqueda sin
  // espacios en los bordes, y pisar «Juan » con «Juan» le borraba al docente el espacio que acababa de escribir.
  const q = filtros.q ?? "";
  const enviada = useRef(q);
  const [ultimaQ, setUltimaQ] = useState(q);
  // El último cambio de afuera, con la búsqueda que trajo. La referencia se asienta en el efecto y no en el
  // render: un render descartado no puede dejarla adelantada.
  const [deAfuera, setDeAfuera] = useState<{ vez: number; q: string } | null>(null);
  if (q !== ultimaQ) {
    setUltimaQ(q);
    if (q !== enviada.current) {
      if (texto.trim() !== q) setTexto(q);
      setDeAfuera((d) => ({ vez: (d?.vez ?? 0) + 1, q }));
    }
  }

  useEffect(() => {
    if (!deAfuera) return;
    enviada.current = deAfuera.q;
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }, [deAfuera]);

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  useImperativeHandle(
    controlRef,
    () => ({
      cancelarBusqueda() {
        if (espera.current) clearTimeout(espera.current);
        espera.current = null;
        enviada.current = "";
        setTexto("");
      },
    }),
    []
  );

  function escribir(valor: string) {
    setTexto(valor);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      espera.current = null;
      enviada.current = valor.trim();
      alCambiar.current({ q: valor.trim() || undefined });
    }, ESPERA_BUSQUEDA_MS);
  }

  return (
    <div className="filtros" role="group" aria-label="Filtrar y ordenar las sesiones">
      <div className="filtros__campo">
        <label htmlFor={`${id}-nivel`}>Nivel de riesgo</label>
        <select
          ref={nivelRef}
          id={`${id}-nivel`}
          value={filtros.nivel ?? ""}
          onChange={(e) => onCambio({ nivel: (e.target.value || undefined) as Filtros["nivel"] })}
        >
          <option value="">Todos</option>
          {NIVELES_FILTRO.map((nivel) => (
            <option key={nivel} value={nivel}>
              {NIVELES[nivel]}
            </option>
          ))}
        </select>
      </div>
      <div className="filtros__campo">
        <label htmlFor={`${id}-estado`}>Estado</label>
        <select
          id={`${id}-estado`}
          value={filtros.estado ?? ""}
          onChange={(e) => onCambio({ estado: (e.target.value || undefined) as Filtros["estado"] })}
        >
          <option value="">Todas</option>
          <option value="open">En curso</option>
          <option value="finished">Finalizadas</option>
        </select>
      </div>
      <div className="filtros__campo filtros__campo--busqueda">
        <label htmlFor={`${id}-q`}>Buscar alumno</label>
        <input
          id={`${id}-q`}
          type="search"
          placeholder="Nombre o apellido"
          maxLength={LARGO_MAXIMO_BUSQUEDA}
          value={texto}
          onChange={(e) => escribir(e.target.value)}
        />
      </div>
      <div className="filtros__campo filtros__campo--orden">
        <label htmlFor={`${id}-orden`}>Ordenar por</label>
        {/* «Hora de inicio» es el orden predeterminado: en la dirección no se escribe, y en el control lleva
            un valor propio que se traduce a «sin orden». */}
        <select
          id={`${id}-orden`}
          value={filtros.orden ?? "started_at"}
          onChange={(e) =>
            onCambio({ orden: e.target.value === "risk_level" ? "risk_level" : undefined })
          }
        >
          <option value="started_at">Hora de inicio</option>
          <option value="risk_level">Nivel de riesgo</option>
        </select>
      </div>
    </div>
  );
}
