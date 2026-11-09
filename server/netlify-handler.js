import serverless from 'serverless-http';
import {createApp} from './app.js';
export function createNetlifyHandler(store){
 const handle=serverless(createApp(store,{serveStatic:false}));
 return (event,context)=>{
  // Support both the public rewrite path and direct Function invocation.
  const normalize=path=>path?.replace(/^\/\.netlify\/functions\/api(?=\/|$)/,'/api');
  const normalized={...event,path:normalize(event.path),rawPath:normalize(event.rawPath),requestPath:normalize(event.requestPath)};
  return handle(normalized,context);
 };
}
