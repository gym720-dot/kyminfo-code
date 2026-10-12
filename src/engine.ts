import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export type Fields = Record<string,string|boolean>;
export type Kind = 'url-qr'|'wifi-qr'|'text-qr'|'contact-qr'|'email-qr'|'phone-qr';
const utf8=new TextEncoder();
export const bytes=(s:string)=>utf8.encode(s).length;
const val=(f:Fields,k:string)=>String(f[k]??'');
function noControls(s:string,label:string){if(/[\u0000-\u001f\u007f]/.test(s))throw new Error(`${label}에 줄바꿈이나 제어 문자를 넣을 수 없습니다.`);return s;}
function bounded(s:string,n:number,label:string){if(s.length>n)throw new Error(`${label}은 ${n}자 이내로 입력해 주세요.`);return s;}
export function webURL(raw:string){
 const s=noControls(raw.trim(),'주소');
 if(!s)throw new Error('웹사이트 주소를 입력해 주세요.');
 let url:URL;try{url=new URL(s);}catch{throw new Error('https:// 또는 http://로 시작하는 전체 주소를 입력해 주세요.');}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname)throw new Error('웹 주소는 https:// 또는 http://만 지원합니다.');
 if(url.username||url.password)throw new Error('사용자명이나 비밀번호가 포함된 주소는 지원하지 않습니다.');
 return url.href;
}
export function phoneNumber(raw:string){const s=noControls(raw,'전화번호').replace(/[ ()-]/g,'');if(!/^\+?[0-9]{3,15}$/.test(s))throw new Error('전화번호는 숫자 3~15자리와 맨 앞의 +만 사용할 수 있습니다.');return s;}
export function emailAddress(raw:string){const s=noControls(raw.trim(),'이메일');if(!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(s)||s.length>254)throw new Error('영문 이메일 주소를 확인해 주세요. 여러 수신자는 지원하지 않습니다.');return s;}
export function wifiEscape(s:string){const escaped=s.replace(/[\\;,:\"]/g,'\\$&');return /^[0-9a-f]+$/i.test(s)?`"${escaped}"`:escaped;}
const cardEscape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function foldCard(line:string){let result='',part='',size=0;for(const ch of line){const n=bytes(ch);if(size+n>75){result+=part+'\r\n';part=' ';size=1;}part+=ch;size+=n;}return result+part;}
export function payload(kind:Kind,f:Fields){
 let result='';
 if(kind==='url-qr')result=webURL(val(f,'url'));
 if(kind==='text-qr'){result=val(f,'text').replace(/\r\n|\r/g,'\n');if(!result.trim())throw new Error('QR에 담을 내용을 입력해 주세요.');if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result))throw new Error('지원하지 않는 제어 문자가 있습니다.');}
 if(kind==='wifi-qr'){
  const ssid=noControls(val(f,'ssid'),'와이파이 이름'),pass=noControls(val(f,'password'),'비밀번호'),auth=val(f,'auth')||'WPA';
  if(bytes(ssid)<1||bytes(ssid)>32)throw new Error('와이파이 이름은 UTF-8 기준 1~32바이트로 입력해 주세요.');
  if(!['WPA','WEP','nopass'].includes(auth))throw new Error('지원하지 않는 보안 방식입니다.');
  if(auth==='WPA'&&!((bytes(pass)>=8&&bytes(pass)<=63)||/^[a-f0-9]{64}$/i.test(pass)))throw new Error('WPA 비밀번호는 8~63바이트 또는 64자리 16진수로 입력해 주세요.');
  if(auth==='WEP'&&!((/^[\x20-\x7e]+$/.test(pass)&&[5,13].includes(pass.length))||(/^[a-f0-9]+$/i.test(pass)&&[10,26].includes(pass.length))))throw new Error('WEP 키는 영문·숫자·기호 5/13자 또는 16진수 10/26자리여야 합니다.');
  result=`WIFI:T:${auth};S:${wifiEscape(ssid)};${auth==='nopass'?'':`P:${wifiEscape(pass)};`}${f.hidden?'H:true;':''};`;
 }
 if(kind==='contact-qr'){
  const family=bounded(noControls(val(f,'family').trim(),'성'),80,'성'),given=bounded(noControls(val(f,'given').trim(),'이름'),80,'이름');
  if(!family&&!given)throw new Error('성이나 이름을 입력해 주세요.');
  const lines=['BEGIN:VCARD','VERSION:3.0',`N:${cardEscape(family)};${cardEscape(given)};;;`,`FN:${cardEscape([family,given].filter(Boolean).join(' '))}`];
  for(const [key,tag]of [['org','ORG'],['title','TITLE']]as const){const s=bounded(noControls(val(f,key).trim(),key==='org'?'회사':'직함'),160,key==='org'?'회사':'직함');if(s)lines.push(`${tag}:${cardEscape(s)}`);}
  if(val(f,'phone').trim())lines.push(`TEL;TYPE=CELL:${phoneNumber(val(f,'phone'))}`);
  if(val(f,'email').trim())lines.push(`EMAIL;TYPE=INTERNET:${emailAddress(val(f,'email'))}`);
  if(val(f,'url').trim())lines.push(`URL:${webURL(val(f,'url'))}`);
  lines.push('END:VCARD');result=lines.map(foldCard).join('\r\n')+'\r\n';
 }
 if(kind==='email-qr'){const email=emailAddress(val(f,'email'));const params=[];for(const k of ['subject','body']){let s=bounded(val(f,k),1000,k==='subject'?'제목':'본문');if(k==='subject')s=noControls(s,'제목');else s=s.replace(/\r\n|\r|\n/g,'\r\n');if(s)params.push(`${k}=${encodeURIComponent(s)}`);}result=`mailto:${email}${params.length?'?'+params.join('&'):''}`;}
 if(kind==='phone-qr')result='tel:'+phoneNumber(val(f,'phone'));
 if(bytes(result)>2000)throw new Error('QR 데이터는 UTF-8 기준 2,000바이트 이하로 줄여 주세요. 긴 내용은 웹페이지 링크로 연결하는 편이 좋습니다.');
 return result;
}
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const palette=['#17243b','#173d70','#253d32'] as const;
export function qrImage(text:string,level:string='M',requested=512,color:string=palette[0]){
 if(!text||bytes(text)>2000)throw new Error('QR 내용은 1~2,000바이트로 입력해 주세요.');
 if(!['L','M','Q','H'].includes(level))throw new Error('오류 복원 수준을 확인해 주세요.');
 if(![256,512,1024].includes(requested)||!palette.includes(color as typeof palette[number]))throw new Error('출력 옵션을 확인해 주세요.');
 let qr;try{qr=QRCode.create([{data:utf8.encode(text),mode:'byte'}],{errorCorrectionLevel:level as 'M'});}catch{throw new Error('현재 오류 복원 수준에서 내용이 너무 깁니다. 내용을 줄이거나 복원 수준을 낮춰 주세요.');}
 const size=qr.modules.size,total=size+8,scale=Math.max(3,Math.ceil(requested/total)),width=total*scale;
 let d='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(qr.modules.get(y,x))d+=`M${x+4} ${y+4}h1v1h-1z`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${d}" fill="${color}"/></svg>`;
 return {svg,width,height:width,modules:size,version:qr.version,bytes:bytes(text)};
}
export type BarcodeFormat='CODE128'|'EAN13'|'EAN8'|'UPC'|'ITF14'|'CODE39';
const digitLengths:Partial<Record<BarcodeFormat,number>>={EAN13:13,EAN8:8,UPC:12,ITF14:14};
export function checkDigit(body:string){if(!/^\d{7,13}$/.test(body))throw new Error('체크디지트를 제외한 숫자를 입력해 주세요.');let sum=0;for(let i=body.length-1,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(body[i])*weight;return String((10-sum%10)%10);}
export function barcodeValue(format:BarcodeFormat,raw:string){
 const s=digitLengths[format]?raw.trim():raw,len=digitLengths[format];
 if(len){if(!new RegExp(`^\\d{${len-1},${len}}$`).test(s))throw new Error(`${format==='UPC'?'UPC-A':format}는 숫자 ${len-1}자리(자동 체크디지트) 또는 ${len}자리로 입력해 주세요.`);const expected=checkDigit(s.slice(0,len-1));if(s.length===len&&s.at(-1)!==expected)throw new Error(`체크디지트가 맞지 않습니다. 올바른 마지막 숫자: ${expected}. 원본 번호를 확인해 주세요.`);return s.length===len?s:s+expected;}
 if(format==='CODE128'){if(!/^[\x20-\x7e]{1,80}$/.test(s))throw new Error('CODE128은 출력 가능한 영문·숫자·기호 1~80자로 입력해 주세요.');return s;}
 if(format==='CODE39'){if(!/^[0-9A-Z .\-$/+%]{1,50}$/.test(s))throw new Error('CODE39는 영문 대문자·숫자·공백·기호 - . $ / + %를 1~50자로 입력해 주세요.');return s;}
 throw new Error('지원하지 않는 바코드 규격입니다.');
}
export function barcodeImage(format:BarcodeFormat,raw:string,scale=2,height=90){
 if(![1,2,3,4].includes(scale)||!Number.isInteger(height)||height<40||height>200)throw new Error('바코드 크기를 확인해 주세요.');
 const value=barcodeValue(format,raw),object:{encodings?:{data:string}[]}={};
 try{JsBarcode(object,value,{format,displayValue:false});}catch{throw new Error('이 값으로 바코드를 만들 수 없습니다. 규격을 확인해 주세요.');}
 const pattern=object.encodings?.map(e=>e.data).join('');if(!pattern||!/^[01]+$/.test(pattern))throw new Error('바코드 인코딩에 실패했습니다.');
 const margin=20*scale,width=pattern.length*scale+margin*2,h=height+55;
 let bars='';for(let i=0;i<pattern.length;i++)if(pattern[i]==='1')bars+=`<rect x="${margin+i*scale}" y="15" width="${scale}" height="${height}"/>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}"><rect width="${width}" height="${h}" fill="#fff"/><g fill="#111" shape-rendering="crispEdges">${bars}</g><text x="${width/2}" y="${height+38}" text-anchor="middle" font-family="monospace" font-size="16" fill="#111">${xml(value)}</text></svg>`;
 return {svg,width,height:h,value,pattern};
}
export type BarcodeBatchRow={index:number;raw:string;error?:string;svg?:string;width?:number;height?:number;value?:string;duplicate?:boolean};
export function barcodeBatch(format:BarcodeFormat,text:string,scale=2,height=90):BarcodeBatchRow[]{
 const lines=text.replace(/\r\n?|\n/g,'\n').split('\n').filter(s=>s.trim()!=='');
 if(!lines.length||lines.length>50||text.length>10000)throw Error('바코드 값은 줄마다 하나씩, 최대 50개·10,000자로 입력하세요.');
 const seen=new Set<string>();
 return lines.map((raw,index)=>{try{const result=barcodeImage(format,raw,scale,height),duplicate=seen.has(result.value);seen.add(result.value);return {index:index+1,raw,...result,duplicate};}catch(error){return {index:index+1,raw,error:error instanceof Error?error.message:'생성 실패'};}});
}
export function randomIndex(n:number,fill:(a:Uint32Array<ArrayBuffer>)=>void=a=>{crypto.getRandomValues(a);}){
 if(!Number.isInteger(n)||n<1||n>65536)throw new Error('난수 범위가 잘못되었습니다.');const limit=Math.floor(4294967296/n)*n,a=new Uint32Array(1);for(let attempt=0;attempt<10000;attempt++){fill(a);if(a[0]<limit)return a[0]%n;}throw new Error('난수 생성에 실패했습니다. 다시 시도해 주세요.');
}
export function password(length:number,opts:Fields){
 if(!globalThis.crypto?.getRandomValues)throw new Error('이 브라우저는 안전한 난수 생성을 지원하지 않습니다.');
 if(!Number.isInteger(length)||length<8||length>128)throw new Error('길이는 8~128자로 선택해 주세요.');
 let groups=[opts.upper?'ABCDEFGHIJKLMNOPQRSTUVWXYZ':'',opts.lower?'abcdefghijklmnopqrstuvwxyz':'',opts.numbers?'0123456789':'',opts.symbols?'!@#$%^&*()-_=+[]{};:,.?':''].filter(Boolean);
 if(opts.exclude)groups=groups.map(s=>s.replace(/[0O1Il|]/g,''));
 if(!groups.length)throw new Error('문자 종류를 한 가지 이상 선택해 주세요.');
 const pool=groups.join('');
 // Rejection sampling keeps every valid password equally likely while requiring each selected group.
 for(let attempt=0;attempt<10000;attempt++){let result='';for(let i=0;i<length;i++)result+=pool[randomIndex(pool.length)];if(groups.every(g=>[...result].some(ch=>g.includes(ch))))return {value:result,pool:pool.length};}
 throw new Error('조건을 만족하는 비밀번호를 만들지 못했습니다. 길이를 늘려 주세요.');
}
