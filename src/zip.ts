// Minimal uncompressed ZIP writer for locally generated exports only (UTF-8, CRC32).
export function storedZip(files:{name:string;data:Uint8Array}[]):Uint8Array {
  if(files.length>50||files.reduce((n,f)=>n+f.data.length,0)>50*1024*1024)throw Error('ZIP은 최대 50개·합계 50MB까지 저장합니다.');
  const encoder=new TextEncoder(),chunks:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0,centralLength=0;
  const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  for(const file of files){const name=encoder.encode(file.name),checksum=crc(file.data),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);h.setUint32(14,checksum,true);h.setUint32(18,file.data.length,true);h.setUint32(22,file.data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
    const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,checksum,true);d.setUint32(20,file.data.length,true);d.setUint32(24,file.data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);central.push(dir);centralLength+=dir.length;chunks.push(header,file.data);offset+=header.length+file.data.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);
  const output=new Uint8Array(offset+centralLength+22);let at=0;for(const part of [...chunks,...central,end]){output.set(part,at);at+=part.length;}return output;
}
