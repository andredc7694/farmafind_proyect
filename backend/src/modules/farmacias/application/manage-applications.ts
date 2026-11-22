import {randomUUID} from 'node:crypto';
import {validateApplicationInput,type PharmacyApplicationInput} from '../domain/pharmacy-application.js';

export interface ApplicationView {
  id:string;estado:string;version:number;nombreComercial:string;
  farmaciaId:string|null;createdAt:string;contacto:string;direccion:string;
  departamento:string;provincia:string;distrito:string;representante:string;ruc:string|null;
}
export interface ApplicationRepository {
  create(actor:string,input:PharmacyApplicationInput):Promise<ApplicationView>;
  listOwn(actor:string):Promise<readonly ApplicationView[]>;
  findOwn(actor:string,id:string):Promise<ApplicationView|null>;
  edit(id:string,version:number,input:PharmacyApplicationInput):Promise<void>;
  command(id:string,version:number,action:'ENVIAR'|'REENVIAR'|'CANCELAR',
    correlation:string):Promise<void>;
}
export interface ApplicationUnitOfWork {
  run<T>(secret:string,work:(repository:ApplicationRepository,actor:string)=>Promise<T>):Promise<T>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ManageApplications {
  constructor(private readonly work:ApplicationUnitOfWork){}
  create(secret:string,input:unknown){
    const valid=validateApplicationInput(input);
    return this.work.run(secret,(repository,actor)=>repository.create(actor,valid));
  }
  list(secret:string){return this.work.run(secret,(repository,actor)=>repository.listOwn(actor));}
  get(secret:string,id:string){
    if(!uuid.test(id))throw new Error('Entrada no válida');
    return this.work.run(secret,async(repository,actor)=>{
      const item=await repository.findOwn(actor,id);
      if(!item)throw new Error('No visible');
      return item;
    });
  }
  edit(secret:string,id:string,version:number,input:unknown){
    if(!uuid.test(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Entrada no válida');
    const valid=validateApplicationInput(input);
    return this.work.run(secret,async(repository,actor)=>{
      if(!await repository.findOwn(actor,id))throw new Error('No visible');
      await repository.edit(id,version,valid);
      const after=await repository.findOwn(actor,id);
      if(!after)throw new Error('No visible');
      return after;
    });
  }
  change(secret:string,id:string,version:number,action:'ENVIAR'|'REENVIAR'|'CANCELAR'){
    if(!uuid.test(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Entrada no válida');
    return this.work.run(secret,async(repository,actor)=>{
      const before=await repository.findOwn(actor,id);
      if(!before)throw new Error('No visible');
      await repository.command(id,version,action,randomUUID());
      const after=await repository.findOwn(actor,id);
      if(!after)throw new Error('No visible');
      return after;
    });
  }
}
