# F01.1 — Guía de revisión humana (DEMO local, datos ficticios)

La DEMO usa una base TEST efímera (nunca `farmafind_f01_test`), dos farmacias ficticias (Alfa y Beta) y un «correo» simulado en un archivo local. Las cuentas y sus claves **no están en el repositorio**: te las entrega Claude en el mensaje de entrega.

- **Dirección:** http://127.0.0.1:5173/identity
- **Códigos «enviados por correo»:** en una terminal del proyecto, `node scripts/f01/mailbox.mjs` (o con un correo: `node scripts/f01/mailbox.mjs correo@example.test`).
- **Código del segundo factor sin teléfono:** `node scripts/f011/totp.mjs <clave que muestra la pantalla>`.

## Recorridos (≈15 min)
1. **Crear un trabajador (propietario Alfa).** Inicia sesión con el propietario Alfa → «Farmacia Alfa» → «Personal de la farmacia» → alias (p. ej. `alfa.caja1`), nombre y algún permiso → «Crear cuenta de trabajador». Debe verse la clave temporal **una sola vez**; pulsa «Ya la entregué; ocultar» y comprueba que no vuelve a verse.
2. **Primer ingreso del trabajador.** Cierra sesión; entra con el alias y la clave temporal. Debe obligarte a definir tu clave definitiva antes de ver nada más. Cierra sesión y prueba la clave temporal otra vez: no debe servir.
3. **Aislamiento.** Con el propietario Beta, «Farmacia Beta»: no debe ver al trabajador de Alfa.
4. **Invitar a una cuenta existente.** Propietario Alfa → «Invitar a una cuenta existente» con el correo de un cliente. El mensaje no confirma si la cuenta existe. El cliente inicia sesión → «Mis invitaciones» → Aceptar → ve «Farmacia Alfa». El propietario pulsa «Revocar acceso» → «Confirmar revocación»: el cliente pierde el acceso de inmediato.
5. **Cambiar permisos.** En un trabajador: «Permisos», marca/desmarca y «Guardar permisos». (No hay forma de dar permisos de propietario.)
6. **Olvidé mi clave.** En la pantalla de acceso, «Olvidé mi clave» → correo del cliente → «Enviar código» (siempre el mismo mensaje). Toma el código de la bandeja simulada, define la clave nueva y entra. La clave anterior ya no sirve.
7. **Segundo factor del administrador.** Entra con el administrador → «Segundo factor…» → «Activar segundo factor»: aparece una clave **una sola vez**. Genera el código (aplicación de autenticación o `totp.mjs`), escríbelo en «Primer código generado». Cierra sesión y entra de nuevo: pide el código; si repites el que ya usaste, lo rechaza; con el siguiente código entra.
8. **Perfil.** «Mi perfil y seguridad»: edita nombre/tema, cambia tu clave (pide la actual), mira tus sesiones. No existe ningún campo de roles o permisos.
9. **No existe** pantalla para crear administradores ni para reiniciar el segundo factor (eso es un procedimiento técnico offline, `scripts/f01/reset-mfa.mjs`).

## Qué debes decidir
Si lo visto cumple lo prometido en `spec.md` (FR-001–016, SC-001–009): **ACEPTO**, **ACEPTO CON OBSERVACIONES** o **RECHAZO**. Claude nunca marca esta decisión por ti.
