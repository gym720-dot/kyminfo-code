// Read dimensions before asking the browser to decode a potentially huge bitmap.
export function imageInfo(data:Uint8Array){
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const ascii=(at:number,n:number)=>String.fromCharCode(...data.slice(at,at+n));
 let width=0,height=0,type='';
 if(data.length>=24&&ascii(1,3)==='PNG'&&data[0]===137&&ascii(12,4)==='IHDR'){
  width=view.getUint32(16);height=view.getUint32(20);type='PNG';
  // Animated PNG can be confusing for a scanner: reject the animation control chunk.
  for(let at=8;at+12<=data.length;){const length=view.getUint32(at);if(ascii(at+4,4)==='acTL')throw new Error('움직이는 PNG 대신 정지 이미지를 선택해 주세요.');if(ascii(at+4,4)==='IDAT')break;const next=at+length+12;if(next<=at||next>data.length)break;at=next;}
 }else if(data.length>=4&&data[0]===255&&data[1]===216){
  type='JPEG';let at=2;
  while(at+4<=data.length){if(data[at]!==255){at++;continue;}while(data[at]===255)at++;const marker=data[at++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(at+2>data.length)break;const len=view.getUint16(at);if(len<2||at+len>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&len>=7){height=view.getUint16(at+3);width=view.getUint16(at+5);break;}at+=len;}
 }else if(data.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
  type='WebP';const chunk=ascii(12,4);
  if(chunk==='VP8X'){if(data[20]&2)throw new Error('움직이는 WebP 대신 정지 이미지를 선택해 주세요.');width=1+data[24]+(data[25]<<8)+(data[26]<<16);height=1+data[27]+(data[28]<<8)+(data[29]<<16);}
  else if(chunk==='VP8 '&&data[23]===157&&data[24]===1&&data[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
  else if(chunk==='VP8L'&&data[20]===47){const bits=view.getUint32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
 }
 if(!width||!height)throw new Error('지원되는 PNG·JPEG·WebP 이미지가 아니거나 파일이 손상되었습니다.');
 if(width*height>16000000||width>16384||height>16384)throw new Error('원본 이미지가 1,600만 픽셀 또는 한 변 16,384px를 초과합니다. QR 주변을 잘라 다시 선택해 주세요.');
 return {width,height,type};
}
