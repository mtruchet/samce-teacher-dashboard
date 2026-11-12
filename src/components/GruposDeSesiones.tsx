import type { SesionNumerada } from "../services/sesionesService";
import { ListaSesiones } from "./ListaSesiones";

interface Props {
  enCurso: SesionNumerada[];
  finalizadas: SesionNumerada[];
  /** Si la lista está filtrada: cambia qué recuento vale y si un grupo vacío se dibuja. */
  conFiltro: boolean;
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
 * Con un filtro, cada grupo cuenta sus filas y un grupo vacío no se dibuja: el recuento del examen dejaría
 * de coincidir con las filas, y un grupo vacío no dice nada que «N de M sesiones» no haya dicho ya.
 */
export function GruposDeSesiones({ enCurso, finalizadas, conFiltro, recuento, onVerEventos }: Props) {
  if (conFiltro) {
    return (
      <>
        {enCurso.length > 0 ? (
          <ListaSesiones titulo="En curso" sesiones={enCurso} total={enCurso.length} onVerEventos={onVerEventos} />
        ) : null}
        {finalizadas.length > 0 ? (
          <ListaSesiones
            titulo="Finalizadas"
            sesiones={finalizadas}
            total={finalizadas.length}
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
