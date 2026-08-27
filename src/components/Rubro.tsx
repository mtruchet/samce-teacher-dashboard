import "./Rubro.css";

/**
 * SAMCE contra lo único que el docente ya vio del rubro.
 *
 * La comparación no nombra ningún producto: se compara con una categoría, la
 * supervisión por cámara, que es la que cualquiera tiene en la cabeza cuando
 * escucha «monitoreo de exámenes». Comparar con una marca sería otra cosa, y
 * además no haría falta.
 *
 * Las cuatro filas son las cuatro decisiones de diseño que separan al proyecto,
 * y las cuatro están sostenidas por los requisitos: sin captura audiovisual,
 * análisis del comportamiento completo en lugar de acciones sueltas, y huellas
 * verificables en lugar de un archivo bajo palabra.
 */

const FILAS = [
  {
    otros: "La cámara prendida durante toda la evaluación.",
    propio: "Sin cámara. El navegador nunca pide permiso para nada.",
  },
  {
    otros: "Alguien mirando en vivo, o un video que después queda guardado.",
    propio: "Nadie mira a nadie. No hay grabación, así que no hay nada que guardar.",
  },
  {
    otros: "Se detectan acciones sueltas: cambiar de pestaña, copiar, pegar.",
    propio: "Un modelo analiza el intento completo y aprende cuál es su ritmo.",
  },
  {
    otros: "La evidencia es un archivo en el servidor de quien provee el servicio.",
    propio: "La evidencia lleva una huella que cualquiera puede volver a verificar.",
  },
];

export function Rubro() {
  return (
    <table className="rubro">
      <caption className="solo-lectores">
        Diferencias entre la supervisión de exámenes por cámara y SAMCE
      </caption>
      <thead>
        <tr>
          <th scope="col">Lo que ya conocés</th>
          <th scope="col" className="rubro__propio">Lo que hace SAMCE</th>
        </tr>
      </thead>
      <tbody>
        {FILAS.map((f) => (
          <tr key={f.propio}>
            <td>{f.otros}</td>
            <td className="rubro__propio">{f.propio}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
