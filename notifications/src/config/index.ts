export type BootstrapConfig = { mode: 'bootstrap'; host: '127.0.0.1'; port: number };
export type F05Config = { mode:'notifications';host:'127.0.0.1';port:number;databaseUrl:string;hmacSecret:string };

export function validateConfig(env: Record<string, string | undefined>, reservedPorts: number[] = []): BootstrapConfig {
  if (env.APP_MODE !== 'bootstrap') throw new Error('APP_MODE: debe ser bootstrap');
  if (env.HOST !== '127.0.0.1') throw new Error('HOST: debe ser loopback');
  if (!env.PORT || !/^[0-9]+$/.test(env.PORT)) throw new Error('PORT: debe ser entero');
  const port = Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT: fuera de rango');
  if (reservedPorts.includes(port)) throw new Error('PORT: coincide con otro componente');
  return { mode: 'bootstrap', host: '127.0.0.1', port };
}

export function validateF05Config(env:Record<string,string|undefined>,reservedPorts:number[]=[]):F05Config{
  if(env.APP_MODE!=='notifications')throw new Error('APP_MODE: debe ser notifications');
  if(env.HOST!=='127.0.0.1')throw new Error('HOST: debe ser loopback');
  if(!env.PORT||!/^\d+$/.test(env.PORT))throw new Error('PORT: debe ser entero');const port=Number(env.PORT);
  if(port<1||port>65535||reservedPorts.includes(port))throw new Error('PORT: invalido');
  if(!env.F05_DATABASE_URL)throw new Error('F05_DATABASE_URL: requerido');
  const url=new URL(env.F05_DATABASE_URL);if(url.hostname!=='127.0.0.1'||url.port!=='55431'||!/^\/farmafind_f01_test(?:_[a-f0-9]{12})?$/.test(url.pathname))throw new Error('F05_DATABASE_URL: solo TEST local');
  if(!env.F05_HMAC_SECRET||env.F05_HMAC_SECRET.length<32)throw new Error('F05_HMAC_SECRET: requerido');
  return{mode:'notifications',host:'127.0.0.1',port,databaseUrl:env.F05_DATABASE_URL,hmacSecret:env.F05_HMAC_SECRET};
}
