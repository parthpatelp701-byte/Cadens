import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed={'/':'index.html','/index.html':'index.html','/cloud.js':'cloud.js','/cloud.css':'cloud.css'};
createServer(async(req,res)=>{const path=allowed[new URL(req.url,'http://localhost').pathname];if(!path){res.writeHead(404);res.end();return;}try{const data=await readFile('dist/'+path);res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(500);res.end('Build the app first.');}}).listen(5174,'127.0.0.1',()=>console.log('Cadens preview: http://127.0.0.1:5174'));
