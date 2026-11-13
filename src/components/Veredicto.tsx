import type { Veredicto as DatosDelVeredicto } from "../veredicto";

/** El veredicto en una frase grande, con su ícono en un cuadro y la bajada debajo (ver `veredicto.ts`). */
export function Veredicto({ veredicto }: { veredicto: DatosDelVeredicto }) {
  const Icono = veredicto.icono;
  return (
    <div className={veredicto.tono ? `veredicto veredicto--${veredicto.tono}` : "veredicto"}>
      <span className="veredicto__icono" aria-hidden="true">
        <Icono size={36} />
      </span>
      <div className="veredicto__texto">
        <p className="veredicto__frase">{veredicto.frase}</p>
        {veredicto.bajadas.map((b) => <p className="veredicto__bajada" key={b}>{b}</p>)}
      </div>
    </div>
  );
}
