import {describe,expect,it} from 'vitest';
import {AssistantError,parseAssistantRequest} from '../../src/modules/asistente-ia/domain/assistant-contract.js';
describe('contrato F06',()=>{
  it('normaliza una consulta exacta',()=>expect(parseAssistantRequest({consulta:'  Paracetamol 500 mg '})).toBe('Paracetamol 500 mg'));
  it.each([null,{}, {consulta:''},{consulta:'x'.repeat(501)},{consulta:'ok',extra:true}])('rechaza cuerpo inválido %#',value=>expect(()=>parseAssistantRequest(value)).toThrow(AssistantError));
});
