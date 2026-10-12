import {payload,qrImage,barcodeImage,barcodeValue,barcodeBatch} from './engine.ts';
self.onmessage=({data})=>{try{
 let result;
 if(data.kind==='barcode-generator')result=data.fields.batch?{batch:barcodeBatch(data.fields.format,data.fields.bulkValues,Number(data.fields.scale),Number(data.fields.height))}:{...barcodeImage(data.fields.format,data.fields.value,Number(data.fields.scale),Number(data.fields.height))};
 else if(data.kind==='check-digit'){const value=barcodeValue(data.fields.format,data.fields.value);result={value,checked:data.fields.value.trim().length===value.length};}
 else{const text=payload(data.kind,data.fields);result={...qrImage(text,data.fields.level,Number(data.fields.size),data.fields.color),payload:text};}
 self.postMessage({result});
}catch(error){self.postMessage({error:error instanceof Error?error.message:'처리 중 오류가 발생했습니다.'});}};
