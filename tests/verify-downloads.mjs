import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {Resvg} from '@resvg/resvg-js';
import jsQR from 'jsqr';
import {MultiFormatReader,RGBLuminanceSource,HybridBinarizer,BinaryBitmap,DecodeHintType,BarcodeFormat} from '@zxing/library';
import {payload} from '../src/engine.ts';
import {tools} from '../scripts/content.mjs';
const items=JSON.parse(await readFile(process.argv[2],'utf8')),results=[];
await mkdir(new URL('actual/',import.meta.url),{recursive:true});
for(const [i,item]of items.entries()){
 const buffer=await readFile(item.path);let got='',width,height;
 if(item.type==='vcf')got=buffer.toString('utf8');
 else{
  let pixels;
  if(item.type==='svg'){const r=new Resvg(buffer.toString('utf8'),{font:{loadSystemFonts:false}}).render();width=r.width;height=r.height;pixels=r.pixels;assert.ok(!buffer.toString().includes('<script'));}
  else{const png=PNG.sync.read(buffer);width=png.width;height=png.height;pixels=png.data;}
  if(item.format){const lum=new Uint8ClampedArray(width*height);for(let n=0;n<lum.length;n++)lum[n]=(pixels[n*4]+2*pixels[n*4+1]+pixels[n*4+2])/4;got=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum,width,height))),new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat[item.format]]]])).getText();}
  else got=jsQR(new Uint8ClampedArray(pixels),width,height)?.data;
 }
 const want=item.tool?payload(item.tool,tools.find(t=>t.slug===item.tool).sample):item.want;
 assert.equal(got,want,'download payload mismatch '+item.path);
 if(item.width)assert.equal(width,item.width);if(item.height)assert.equal(height,item.height);
 const saved=`${String(i+1).padStart(2,'0')}-${item.tool||item.format}.${item.type}`;await copyFile(item.path,new URL('actual/'+saved,import.meta.url));
 results.push({file:saved,bytes:buffer.length,width,height,verified:true});
}
await writeFile(new URL('actual/download-verification.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
