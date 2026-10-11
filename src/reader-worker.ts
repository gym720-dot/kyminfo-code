import jsQR from 'jsqr';
self.onmessage=({data})=>{try{const result=jsQR(new Uint8ClampedArray(data.buffer),data.width,data.height,{inversionAttempts:'attemptBoth'});self.postMessage({text:result?.data??null});}catch{self.postMessage({error:'QR 분석에 실패했습니다. 다른 이미지로 시도해 주세요.'});}};
