import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Exercise the production module with a Storage boundary stub, without live writes.
let response,reads=[];
globalThis.__previewTestDB={storage:{from(bucket){assert.equal(bucket,'space-files');return {async download(path){reads.push(path);return response;}};}}};
const source=(await readFile(new URL('../src/lib/space-files.ts',import.meta.url),'utf8'))
  .replace("import { supabase } from './supabase';",'const supabase=globalThis.__previewTestDB;')
  .replaceAll('import.meta.env.PUBLIC_SPACE_EXTENDED',"'true'");
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {previewImage,isPreviewImage,validateFiles}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(isPreviewImage('photo.PNG'),true);
assert.equal(isPreviewImage('script.svg'),false);
assert.equal(isPreviewImage('photo.png.html'),false);
assert.throws(()=>validateFiles([new File(['zip'],'archive.zip')]),/문서를/);
assert.throws(()=>validateFiles(Array.from({length:6},()=>new File(['x'],'a.txt'))),/최대 5개/);
assert.throws(()=>validateFiles([{name:'large.png',size:10*1024*1024+1}]),/10MB/);
assert.equal(await previewImage('private/file.pdf','file.pdf'),null);
assert.equal(reads.length,0);
response={data:null,error:new Error('RLS access denied')};
await assert.rejects(()=>previewImage('private/photo.png','photo.png'),/RLS access denied/);
response={data:new Blob(['<svg/>'],{type:'image/svg+xml'}),error:null};
await assert.rejects(()=>previewImage('private/photo.png','photo.png'),/이미지 형식/);
response={data:new Blob(['png'],{type:'image/png'}),error:null};
const url=await previewImage('private/photo.png','photo.png');
assert.match(url,/^blob:/);URL.revokeObjectURL(url);
assert.equal(reads.length,3);
delete globalThis.__previewTestDB;
console.log('Passed: private Storage reads, permission-denied previews, MIME allowlist, object URLs, ZIP/size/count limits.');
