/** One bounded F02.5 TEST publication batch. No external channel or persistent database. */
import {Pool} from 'pg';
import {PgApplicationOutbox,HttpApplicationEventTransport,PublishApplicationOutbox}
  from '../../backend/dist/modules/notificaciones/infrastructure/application-outbox-publisher.js';
import {loadNotificationPublisherConfig} from '../../backend/dist/config/notifications.js';
const databaseUrl=process.env.F05_DATABASE_URL;
const secret=process.env.F05_INTERNAL_SECRET;
const serviceUrl=process.env.F05_NOTIFICATIONS_URL;
if(!databaseUrl||!secret||!serviceUrl)throw new Error('F02.5: configuración local F05 incompleta');
const db=new URL(databaseUrl),service=new URL(serviceUrl);
if(db.hostname!=='127.0.0.1'||db.port!=='55431'||
  !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(db.pathname)||
  service.hostname!=='127.0.0.1'||service.protocol!=='http:'||
  service.pathname!=='/internal/v1/pharmacy-application-events')
  throw new Error('F02.5: publicación solo TEST local');
const config=loadNotificationPublisherConfig(process.env);
const pool=new Pool({connectionString:databaseUrl,max:2});
try{
  const publisher=new PublishApplicationOutbox(new PgApplicationOutbox(pool),
    new HttpApplicationEventTransport(serviceUrl,secret,config.requestTimeoutMs),config);
  console.log(JSON.stringify(await publisher.run()));
}finally{await pool.end();}
