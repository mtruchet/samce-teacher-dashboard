# -*- coding: utf-8 -*-
"""
Genera un enlace de acceso al panel, firmado igual que lo haría el complemento
de Moodle. Sirve para probar el flujo completo en el navegador sin necesidad
de tener Moodle levantado.

El token vence a los 60 segundos, así que hay que usar el enlace enseguida.

Uso:
    python scripts/enlace-de-prueba.py
    python scripts/enlace-de-prueba.py --usuario otro.docente --curso 5
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import time

# El secreto no viaja en el repositorio, ni siquiera el de desarrollo: sale de
# MOODLE_LAUNCH_SECRET o del parámetro --secreto. Tiene que ser el mismo que el
# del .env del backend y el del ajuste launchsecret del complemento en Moodle.
PANEL_POR_DEFECTO = "http://localhost:5173/auth/callback"
VIGENCIA_SEGUNDOS = 60


def base64url(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def firmar(claims: dict, secreto: str) -> str:
    payload = json.dumps(claims, separators=(",", ":")).encode()
    firma = hmac.new(secreto.encode(), payload, hashlib.sha256).digest()
    return f"{base64url(payload)}.{base64url(firma)}"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--usuario", default="docente.demo")
    p.add_argument("--curso", type=int, default=2)
    p.add_argument("--id-moodle", type=int, default=3)
    p.add_argument("--panel", default=PANEL_POR_DEFECTO)
    p.add_argument("--secreto", default=os.getenv("MOODLE_LAUNCH_SECRET"))
    p.add_argument("--vencido", action="store_true", help="genera un token ya vencido, para probar el error")
    args = p.parse_args()

    if not args.secreto:
        p.error(
            "falta el secreto de lanzamiento. Pasalo con --secreto o exportá "
            "MOODLE_LAUNCH_SECRET con el mismo valor que usa el backend."
        )

    ahora = int(time.time())
    claims = {
        "moodle_user_id": args.id_moodle,
        "username": args.usuario,
        "course_id": args.curso,
        "role": "docente",
        "iat": ahora,
        "exp": ahora - 10 if args.vencido else ahora + VIGENCIA_SEGUNDOS,
    }

    token = firmar(claims, args.secreto)
    print(f"\n  {args.panel}?token={token}\n")
    if args.vencido:
        print("  Token vencido a propósito: debe mostrar la pantalla de error.\n")
    else:
        print(f"  Válido {VIGENCIA_SEGUNDOS} segundos. Abrilo ahora.\n")


if __name__ == "__main__":
    main()
