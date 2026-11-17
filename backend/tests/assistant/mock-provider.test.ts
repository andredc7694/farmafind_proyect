import {describe,expect,it} from 'vitest';
import {MockAIProvider} from '../../src/modules/asistente-ia/infrastructure/mock-ai-provider.js';
describe('MockAIProvider',()=>{
  it('clasifica búsqueda, comparación y ayuda',async()=>{const p=new MockAIProvider();
    expect((await p.classify('busca paracetamol')).intent).toBe('BUSQUEDA');
    expect((await p.classify('compara ibuprofeno')).intent).toBe('COMPARACION');
    expect((await p.classify('cómo puedes ayudar')).intent).toBe('AYUDA');});
  it('es determinista en 100 repeticiones',async()=>{const p=new MockAIProvider();const values=await Promise.all(Array.from({length:100},()=>p.classify('compara paracetamol')));expect(new Set(values.map(JSON.stringify)).size).toBe(1);});
});
