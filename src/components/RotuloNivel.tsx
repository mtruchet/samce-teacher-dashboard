import type { ReactNode } from "react";
import { NIVELES } from "../lenguajeAlerta";
import type { NivelDeRiesgo } from "../services/sesionesService";
import { MedidorNivel } from "./MedidorNivel";
import "./RotuloNivel.css";

/**
 * La marca del nivel de riesgo, la misma en todo el panel: el medidor, «Riesgo alto» escrito en --tinta y, si
 * hace falta, un complemento separado por una línea vertical fina (en la tarjeta de la alerta, el origen).
 *
 * El nivel nunca depende solo del color: la palabra va siempre escrita y el medidor cuenta con segmentos. El
 * medidor va oculto para los lectores de pantalla, porque la palabra ya lo dice. La línea vertical la dibuja el
 * complemento (ver RotuloNivel.css): si no entra en el renglón, baja con su línea y nunca la deja colgando. El tono lo da
 * `data-nivel` (ver `styles/nivel.css`), así el rótulo se pinta igual donde sea que se monte.
 */
export function RotuloNivel({ nivel, complemento }: { nivel: NivelDeRiesgo; complemento?: ReactNode }) {
  return (
    <span className="rotulo-nivel" data-nivel={nivel}>
      <MedidorNivel nivel={nivel} />
      <span className="rotulo-nivel__nivel">{NIVELES[nivel]}</span>
      {complemento ? (
        <>
          {" "}
          <span className="rotulo-nivel__complemento">{complemento}</span>
        </>
      ) : null}
    </span>
  );
}
