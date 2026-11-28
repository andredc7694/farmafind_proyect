/**
 * F06.2 · D-08 A (con ajuste de Andre): números oficiales del Perú verificados en gob.pe el 2026-11-27.
 * La urgencia se evalúa antes que todo y su respuesta va sola: sin tarjetas, opciones ni sugerencias.
 */
export interface EmergencyNumber { readonly servicio: string; readonly numero: string }
export interface EmergencySource { readonly titulo: string; readonly url: string }
export interface EmergencyNotice {
  readonly mensaje: string;
  readonly numeros: readonly EmergencyNumber[];
  readonly fuentes: readonly EmergencySource[];
  readonly verificadoEl: string;
}

export const EMERGENCY: EmergencyNotice = Object.freeze({
  mensaje: 'Si puede ser una emergencia, llama gratis al SAMU 106 (Minsa). Bomberos: 116. Policía: 105. No puedo evaluar tu situación.',
  numeros: Object.freeze([
    Object.freeze({ servicio: 'SAMU (Minsa)', numero: '106' }),
    Object.freeze({ servicio: 'Bomberos', numero: '116' }),
    Object.freeze({ servicio: 'Policía', numero: '105' }),
  ]),
  fuentes: Object.freeze([
    Object.freeze({ titulo: 'gob.pe · Solicitar atención médica en caso de emergencia (SAMU 106)',
      url: 'https://www.gob.pe/1013-solicitar-atencion-medica-en-caso-de-emergencia-samu' }),
    Object.freeze({ titulo: 'gob.pe · PNP: contacto y números de emergencia',
      url: 'https://www.gob.pe/institucion/pnp/contacto-y-numeros-de-emergencias' }),
  ]),
  verificadoEl: '2026-11-27',
});
