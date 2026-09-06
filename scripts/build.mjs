import './patch-original.mjs';
import {build} from 'esbuild';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const url=process.env.SUPABASE_URL||'https://iqnctgdnlyxjngqnzacr.supabase.co';
const key=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_vUUzpvmlnI8QiU5EQ7x3Kg_f1w-rLj6';
if(!key.startsWith('sb_publishable_'))throw Error('Only a publishable key belongs in this build');
mkdirSync('dist',{recursive:true});
await build({entryPoints:['src/cloud.js'],bundle:true,format:'iife',outfile:'dist/cloud.js',minify:true,define:{CADENS_URL:JSON.stringify(url),CADENS_KEY:JSON.stringify(key)}});
copyFileSync('index.html','dist/index.html');copyFileSync('src/cloud.css','dist/cloud.css');
const html=readFileSync('index.html','utf8');
const hashes=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim()).map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
writeFileSync('dist/_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Cache-Control: no-cache
  Content-Security-Policy: default-src 'self'; script-src 'self' ${hashes.join(' ')} https://alcdn.msauth.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' ${url} https://graph.microsoft.com https://login.microsoftonline.com https://nominatim.openstreetmap.org; frame-src https://login.microsoftonline.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`);
