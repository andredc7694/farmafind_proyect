export interface PharmacyApplicationInput {
  nombreComercial:string;contacto:string;direccion:string;departamento:string;
  provincia:string;distrito:string;representante:string;ruc?:string;
}
const limits:Record<keyof Omit<PharmacyApplicationInput,'ruc'>,number>={
  nombreComercial:160,contacto:160,direccion:240,departamento:100,
  provincia:100,distrito:100,representante:160,
};

/** TEST/DEMO field validation; no legal or sanitary verification is implied. */
export function validateApplicationInput(value:unknown):PharmacyApplicationInput {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Entrada no válida');
  const object=value as Record<string,unknown>;
  if(Object.keys(object).some(key=>!(key in limits)&&key!=='ruc') ||
    Object.keys(limits).some(key=>!Object.hasOwn(object,key)))throw new Error('Entrada no válida');
  const result={} as Record<string,string>;
  for(const [key,max] of Object.entries(limits)){
    const item=object[key];
    if(typeof item!=='string'||item.trim().length<1||item.trim().length>max)
      throw new Error('Entrada no válida');
    result[key]=item.trim();
  }
  if(object.ruc!==undefined){
    if(typeof object.ruc!=='string'||object.ruc.trim().length<1||object.ruc.trim().length>20)
      throw new Error('Entrada no válida');
    result.ruc=object.ruc.trim();
  }
  return result as unknown as PharmacyApplicationInput;
}
