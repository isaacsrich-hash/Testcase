import {createApp} from './app.js';
import {createSqliteStore} from './store.js';
const store=await createSqliteStore();
const app=createApp(store);
app.listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log('Kindred server listening on '+(process.env.PORT||3001)));
