/**
 * Puerto de entrega de mensajes de cuenta (F011-FR-010, decisión D-06 opción A).
 * En TEST lo implementa un simulador local; un proveedor real requiere autorización expresa (Puerta 5).
 * Se invoca DESPUÉS de confirmar la transacción; un fallo nunca revierte la operación de identidad.
 */
export type AccountMessageKind = 'VERIFICAR_CORREO' | 'RESTABLECER_CLAVE' | 'CAMBIO_CORREO';

export interface AccountMessage {
  readonly kind: AccountMessageKind;
  readonly to: string;     // correo canónico de destino
  readonly code: string;   // token de un solo uso (secreto: solo existe en este mensaje)
  readonly expiresAt: Date;
}

export interface AccountMessageDelivery {
  deliver(message: AccountMessage): Promise<void>;
}

/** Entrega «best effort»: registra el fallo sin propagar y sin incluir el código. */
export async function deliverAfterCommit(delivery: AccountMessageDelivery, message: AccountMessage,
  onFailure: (reason: string) => void = () => undefined): Promise<boolean> {
  try { await delivery.deliver(message); return true; }
  catch (error) { onFailure(error instanceof Error ? error.name : 'Error'); return false; }
}
