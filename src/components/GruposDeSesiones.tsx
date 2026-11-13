import type { SesionNumerada } from "../services/sesionesService";
import { ListaSesiones } from "./ListaSesiones";

interface Props {
  enCurso: SesionNumerada[];
  finalizadas: SesionNumerada[];
  /** Si la lista que se muestra está filtrada: cambia qué recuento vale y qué dice un grupo vacío. */
  conFiltro: boolean;
  /** Si ya están cargadas todas las sesiones que cumplen el filtro (no queda «Ver más sesiones»). */
  todasCargadas: boolean;
  /** Cuántas sesiones tiene el examen en cada grupo, según los recuentos del backend. */
  recuento: { enCurso: number; finalizadas: number };
  /** De qué respuesta son las filas: con otra, cada tabla se arma de nuevo (ver `ListaSesiones`). */
  vista?: string;
  onVerEventos: (sesion: SesionNumerada) => void;
}

/**
 * Los dos grupos de la lista de un examen, «En curso» y «Finalizadas».
 *
 * Qué grupos se dibujan depende del examen y no del filtro: «En curso» siempre, porque decir que nadie está
 * rindiendo es un dato, y «Finalizadas» si el examen tiene alguna. Con un filtro, el grupo que quedó sin filas
 * lo dice adentro. Antes desaparecía, y «Finalizadas» subía a ocupar su lugar en el momento en que el docente
 * iba a mirar la lista.
 *
 * Sin filtro, el recuento de cada grupo es el del examen y no el de las filas cargadas: con la lista
 * paginada, contar filas daba un número distinto del de la ficha del examen.
 *
 * Con un filtro, cada grupo cuenta sus filas solo cuando están cargadas todas las que cumplen el filtro. Si
 * no, la cabecera va sin cifra: el backend no dice cómo se reparten entre los grupos, y contar las filas
 * cargadas daba un número que no cerraba con «N de M sesiones» y que crecía con cada «Ver más sesiones».
 */
export function GruposDeSesiones({ enCurso, finalizadas, conFiltro, todasCargadas, recuento, vista, onVerEventos }: Props) {
  // Las en curso llegan primero: con un filtro, si no hay ninguna entre las cargadas, no hay ninguna.
  const vacioEnCurso =
    recuento.enCurso === 0 || !conFiltro
      ? "No hay sesiones de examen vigentes."
      : "Ninguna sesión en curso coincide con el filtro.";
  // Las finalizadas van después: con la lista cortada, las que coinciden pueden estar en la página siguiente.
  const vacioFinalizadas =
    conFiltro && todasCargadas ? "Ninguna sesión finalizada coincide con el filtro." : "Se ven con «Ver más sesiones».";

  return (
    <>
      <ListaSesiones
        titulo="En curso"
        sesiones={enCurso}
        total={conFiltro ? enCurso.length : recuento.enCurso}
        conCuenta={!conFiltro || todasCargadas}
        vacio={<p className="grupos__vacio">{vacioEnCurso}</p>}
        vista={vista}
        onVerEventos={onVerEventos}
      />
      {finalizadas.length > 0 || recuento.finalizadas > 0 ? (
        <ListaSesiones
          titulo="Finalizadas"
          sesiones={finalizadas}
          total={conFiltro ? finalizadas.length : recuento.finalizadas}
          conCuenta={!conFiltro || todasCargadas}
          cerradas
          vacio={<p className="grupos__vacio">{vacioFinalizadas}</p>}
          vista={vista}
          onVerEventos={onVerEventos}
        />
      ) : null}
    </>
  );
}
