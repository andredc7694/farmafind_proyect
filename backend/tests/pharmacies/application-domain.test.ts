import {describe,expect,it} from 'vitest';
import {validateApplicationInput} from '../../src/modules/farmacias/domain/pharmacy-application.js';

const valid={nombreComercial:' Farmacia TEST ',contacto:' Contacto ficticio ',
  direccion:' Calle TEST 1 ',departamento:' Lima ',provincia:' Lima ',
  distrito:' Lima ',representante:' Representante ficticio '};

describe('F02.5 solicitud TEST, datos mínimos',()=>{
  it('acepta campos ficticios mínimos y recorta espacios sin exigir RUC',()=>{
    expect(validateApplicationInput(valid)).toEqual({nombreComercial:'Farmacia TEST',
      contacto:'Contacto ficticio',direccion:'Calle TEST 1',departamento:'Lima',
      provincia:'Lima',distrito:'Lima',representante:'Representante ficticio'});
  });
  it('rechaza campos de privilegio y farmacia activada enviados por el solicitante',()=>{
    for(const field of ['rol','farmaciaId','estado','capacidad','solicitanteId'])
      expect(()=>validateApplicationInput({...valid,[field]:'ADMINISTRADOR_PLATAFORMA'})).toThrow();
  });
  it('rechaza campos vacíos, tipos ajenos y tamaños fuera de contrato',()=>{
    expect(()=>validateApplicationInput({...valid,nombreComercial:' '})).toThrow();
    expect(()=>validateApplicationInput({...valid,contacto:42})).toThrow();
    expect(()=>validateApplicationInput({...valid,direccion:'x'.repeat(241)})).toThrow();
    expect(()=>validateApplicationInput({...valid,ruc:''})).toThrow();
  });
});
