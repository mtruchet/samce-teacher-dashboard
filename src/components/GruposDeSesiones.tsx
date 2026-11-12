import type { SesionNumerada } from "../services/sesionesService";
import { ListaSesiones } from "./ListaSesiones";

interface Props {
  enCurso: SesionNumerada[];
  finalizadas: SesionNumerada[];
  /** Si la lista está filtrada: cambia qué recuento vale y si un grupo vacío se dibuja. */
  conFiltro: boolean;
  /** Si ya están cargadas todas las sesiones que cumplen el filtro (no queda «Ver más sesiones»). */
  todasCargadas: boolean;
  /** Cuántas sesiones tiene el examen en cada grupo, según los recuentos del backend. */
  recuento: { enCurso: number; finalizadas: number };
  onVerEventos: (sesion: SesionNumerada) => void;
}

/**
 * Los dos grupos de la lista de un examen, «En curso» y «Finalizadas».
 *
 * Sin filtro, el recuento de cada grupo es el del examen y no el de las filas cargadas: con la lista
 * paginada, contar filas daba un número distinto del de la ficha del examen. «En curso» se dibuja aunque
 * esté vacío, porque decir que nadie está rindiendo es un dato.
 *
 * Con un filtro, un grupo vacío no se dibuja: no dice nada que «N de M sesiones» no haya dicho ya. Cada grupo
 * cuenta sus filas solo cuando están cargadas todas las que cumplen el filtro. Si no, la cabecera va sin
 * cifra: el backend no dice cómo se reparten entre los grupos, y contar las filas cargadas daba un número que
 * no cerraba con «N de M sesiones» y que crecía con cada «Ver más sesiones».
 */
export function GruposDeSesiones({ enCurso, finalizadas, conFiltro, todasCargadas, recuento, onVerEventos }: Props) {
  if (conFiltro) {
    return (
      <>
        {enCurso.length > 0 ? (
          <ListaSesiones
            titulo="En curso"
            sesiones={enCurso}
            total={enCurso.length}
            conCuenta={todasCargadas}
            onVerEventos={onVerEventos}
          />
        ) : null}
        {finalizadas.length > 0 ? (
          <ListaSesiones
            titulo="Finalizadas"
            sesiones={finalizadas}
            total={finalizadas.length}
            conCuenta={todasCargadas}
            cerradas
            onVerEventos={onVerEventos}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <ListaSesiones
        titulo="En curso"
        sesiones={enCurso}
        total={recuento.enCurso}
        vacio={<p className="grupos__vacio">No hay sesiones de examen vigentes.</p>}
        onVerEventos={onVerEventos}
      />
      {finalizadas.length > 0 || recuento.finalizadas > 0 ? (
        <ListaSesiones
          titulo="Finalizadas"
          sesiones={finalizadas}
          total={recuento.finalizadas}
          cerradas
          vacio={<p className="grupos__vacio">Se ven con «Ver más sesiones».</p>}
          onVerEventos={onVerEventos}
        />
      ) : null}
    </>
  );
}
