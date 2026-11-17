import {describe,expect,it} from 'vitest';
import {isClinicalRequest} from '../../src/modules/asistente-ia/domain/clinical-policy.js';
describe('política clínica F06',()=>{
  it.each(['¿Qué dosis debo tomar?','diagnostica mis síntomas','recomiéndame un medicamento','¿puedo tomar ibuprofeno?','reemplaza mi tratamiento'])('rechaza %s',q=>expect(isClinicalRequest(q)).toBe(true));
  it.each(['busca paracetamol','compara precios de ibuprofeno','cómo buscar una farmacia'])('admite información pública %s',q=>expect(isClinicalRequest(q)).toBe(false));
});
