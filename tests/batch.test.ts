import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {barcodeBatch} from '../src/engine.ts';import {storedZip} from '../src/zip.ts';
test('batch preserves zeros, marks duplicates, isolates invalid check digits',()=>{const rows=barcodeBatch('EAN13','001234567890\n001234567890\n123\n4006381333932');assert.equal(rows.length,4);assert.equal(rows[0].value,'0012345678905');assert.equal(rows[1].duplicate,true);assert.ok(rows[2].error);assert.ok(rows[3].error);});
test('batch rejects more than 50 lines',()=>assert.throws(()=>barcodeBatch('CODE128',Array(51).fill('abc').join('\n'))));
test('XML in batch is escaped',()=>assert.ok(!barcodeBatch('CODE128','<script>')[0].svg?.includes('<script>')));
test('ZIP CRC and UTF8 fixture for independent Python verification',()=>{const bytes=storedZip([{name:'barcode-001.svg',data:new TextEncoder().encode(barcodeBatch('CODE128','00001')[0].svg!)},{name:'한글.txt',data:new TextEncoder().encode('검증용 파일\n00001')}]);const p=path.resolve('../kyminfo-execution/code-batch-fixture.zip');fs.writeFileSync(p,bytes);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);});
test('ZIP byte/count bounds enforced',()=>assert.throws(()=>storedZip(Array.from({length:51},(_,i)=>({name:String(i),data:new Uint8Array()})))));
