import {tools} from './catalog.ts';
import {password,webURL,type Fields,type BarcodeBatchRow} from './engine.ts';
import {storedZip} from './zip.ts';
import {imageInfo} from './image-info.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text=''){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function button(text:string,cls='',action?:()=>void){const b=element('button','button '+cls,text);b.type='button';if(action)b.addEventListener('click',action);return b;}
// Unpublished siblings are shown only on the local review host.
const root=document.querySelector<HTMLElement>('#tool-root');
if(root)setup(root);
function setup(root:HTMLElement){
 const mode=root.dataset.mode!,tool=tools.find(t=>t.slug===mode)!;
 const controls:Record<string,HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>={};
 let current:{svg?:string;width?:number;height?:number;payload?:string;value?:string;checked?:boolean;modules?:number;bytes?:number;pool?:number;batch?:BarcodeBatchRow[]}|null=null;
 let exporting=false;
 const printURLs:string[]=[];
 let imageURL='',worker:Worker|null=null,timer:ReturnType<typeof setTimeout>|null=null,sequence=0;
 let rejectPending:((error:Error)=>void)|null=null;
 const top=element('div','workspace-top'),title=element('div');title.append(element('strong','',tool.name),element('p','privacy-note','입력·이미지는 이 브라우저에서 처리하며 자동 저장하지 않습니다.'));
 const topActions=element('div','editor-tools');topActions.append(button('예제 불러오기','',()=>loadSample()),button('전체 지우기','danger',()=>clear()));top.append(title,topActions);
 const body=element('div','workspace-body code-workspace'),form=element('form','code-form');form.autocomplete='off';
 const inputs=element('div','code-fields'),settings=element('div','code-settings');
 const resultPanel=element('section','code-result'),status=element('p','status');status.id='tool-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
 const resultHeading=element('h2','result-heading','미리보기'),empty=element('p','empty-state',mode==='qr-reader'?'이미지를 선택하면 QR 내용을 확인합니다.':'내용을 입력하고 결과를 만들어 보세요.');
 const image=element('img','code-image');image.hidden=true;image.alt='생성한 코드 이미지';
 const meta=element('p','result-meta'),output=element('textarea','editor payload-output');output.readOnly=true;output.id='result-text';output.spellcheck=false;output.setAttribute('aria-label',mode==='password-generator'?'생성된 비밀번호':'코드 데이터 내용');output.hidden=true;
 const secretOutput=element('input','text-control password-result');secretOutput.type='password';secretOutput.readOnly=true;secretOutput.id='generated-password';secretOutput.autocomplete='off';secretOutput.setAttribute('aria-label','생성된 비밀번호');secretOutput.hidden=true;
 const details=element('details','payload-details');details.append(element('summary','','QR 데이터 내용 보기'),output);details.hidden=true;
 const toolbar=element('div','result-toolbar');toolbar.hidden=true;
 const savePNG=button('PNG 저장','',()=>void (current?.batch?exportBatch('png'):exportPNG())),saveSVG=button('SVG 저장','',()=>{if(current?.batch)void exportBatch('svg');else if(current?.svg)download(new Blob([current.svg],{type:'image/svg+xml'}),'svg');}),copy=button(mode==='password-generator'?'비밀번호 복사':'내용 복사','',()=>void copyResult()),vcf=button('연락처 VCF 저장','',()=>{if(current?.payload)download(new Blob([current.payload],{type:'text/vcard;charset=utf-8'}),'vcf');});
 const printButton=button('인쇄','',()=>void printResult());toolbar.append(savePNG,saveSVG,copy);if(mode==='contact-qr')toolbar.append(vcf);toolbar.append(printButton);
 const printSettings=element('div','print-settings');printSettings.hidden=true;
 const printTitle=element('input','text-control');printTitle.id='print-title';printTitle.maxLength=60;printTitle.placeholder='예: 게스트 와이파이';
 const titleLabel=element('label','field-label','인쇄 제목 (선택)');titleLabel.htmlFor=printTitle.id;
 const printSize=element('select','text-control');printSize.id='print-size';for(const n of [40,50,70]){const o=element('option','',`${n}mm`);o.value=String(n);o.selected=n===50;printSize.append(o);}
 const sizeLabel=element('label','field-label','QR 인쇄 크기');sizeLabel.htmlFor=printSize.id;
 const copies=element('select','text-control');copies.id='print-copies';for(const n of [1,4]){const o=element('option','',`${n}장`);o.value=String(n);copies.append(o);}const copiesLabel=element('label','field-label','한 페이지 배치');copiesLabel.htmlFor=copies.id;
 printSettings.append(titleLabel,printTitle);if(mode.endsWith('-qr'))printSettings.append(sizeLabel,printSize,copiesLabel,copies);
 const openLink=element('a','button','확인한 웹 주소 열기 ↗');openLink.target='_blank';openLink.rel='noopener noreferrer';openLink.hidden=true;
 const passShow=element('label','option'),passShowCheck=element('input');passShowCheck.type='checkbox';passShow.append(passShowCheck,document.createTextNode('비밀번호 표시'));passShow.hidden=true;passShowCheck.addEventListener('change',()=>{secretOutput.type=passShowCheck.checked?'text':'password';});
 resultPanel.append(resultHeading,empty,image,meta,details,secretOutput,passShow,toolbar,openLink,printSettings);
 const batchList=element('div','barcode-batch-list');resultPanel.append(batchList);
 const note=element('p','unsaved-note',mode==='password-generator'?'페이지를 닫으면 결과가 사라집니다. 안전한 비밀번호 관리자로 옮겨 주세요.':'QR에 담은 정보는 누구나 읽을 수 있습니다. 저장·인쇄 후 실제 기기에서 확인하세요.');
 const actions=element('div','actions'),submit=button(mode==='qr-reader'?'QR 읽기':mode==='check-digit'?'계산·검증':mode==='password-generator'?'비밀번호 생성':'만들기','primary');submit.type='submit';actions.append(submit);
 form.append(inputs,settings,actions,status,note);body.append(form,resultPanel);root.append(top,body);
 function field(key:string,label:string,type='text',hint='',options?:[string,string][],def=''){
  const wrap=element('div','field'),l=element('label','field-label',label);l.htmlFor=key;
  let c:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  if(options){c=element('select','text-control');for(const [v,t] of options){const o=element('option','',t);o.value=v;c.append(o);}}
  else if(type==='textarea'){c=element('textarea','editor text-control');c.maxLength=10000;c.rows=5;c.spellcheck=false;}
  else{c=element('input','text-control');c.type=type;c.autocomplete='off';c.maxLength=type==='password'?128:2048;if(type==='number'){c.min=key==='length'?'8':'40';c.max=key==='length'?'128':'200';c.step='1';}}
  c.id=key;c.name=key;c.value=def;controls[key]=c;wrap.append(l,c);
  if(hint){const h=element('p','field-hint',hint);h.id=key+'-hint';c.setAttribute('aria-describedby',h.id);wrap.append(h);}
  inputs.append(wrap);return c;
 }
 function choice(key:string,label:string,def=false){const wrap=element('label','option'),c=element('input');c.type='checkbox';c.id=key;c.checked=def;controls[key]=c;wrap.append(c,document.createTextNode(label));settings.append(wrap);return c;}
 if(mode==='url-qr')field('url','웹사이트 주소','url','https://를 포함한 전체 주소를 입력하세요.');
 if(mode==='wifi-qr'){
  field('ssid','와이파이 이름 (SSID)','text','띄어쓰기 포함 UTF-8 32바이트까지. 공유기 이름과 정확히 맞춰 주세요.');
  const auth=field('auth','보안 방식','text','WPA3 전용·기업용 인증은 지원하지 않습니다.',[['WPA','WPA / WPA2 개인용'],['WEP','WEP (구형)'],['nopass','비밀번호 없음']],'WPA');
  const pwd=field('password','와이파이 비밀번호','password','WPA는 8~63바이트 또는 64자리 16진수. QR에는 비밀번호가 포함됩니다.');
  choice('hidden','숨겨진 네트워크');const show=choice('show-password','입력 비밀번호 표시');show.addEventListener('change',()=>{(pwd as HTMLInputElement).type=show.checked?'text':'password';});
  auth.addEventListener('change',()=>{pwd.disabled=auth.value==='nopass';});
 }
 if(mode==='text-qr')field('text','QR에 담을 내용','textarea','한글·줄바꿈·이모지 지원. 최대 2,000 UTF-8 바이트.');
 if(mode==='contact-qr'){inputs.classList.add('contact-fields');for(const [k,l] of [['family','성'],['given','이름'],['org','회사 (선택)'],['title','직함 (선택)'],['phone','전화번호 (선택)'],['email','이메일 (선택)'],['url','홈페이지 (선택)']])field(k,l,k==='email'?'email':k==='url'?'url':k==='phone'?'tel':'text');}
 if(mode==='email-qr'){field('email','받는 이메일','email');field('subject','제목 (선택)');field('body','본문 (선택)','textarea');}
 if(mode==='phone-qr')field('phone','전화번호','tel','국제 공유에는 +82 등 국가번호를 포함해 주세요.');
 const barcode=mode==='barcode-generator'||mode==='check-digit';
 if(barcode){field('format','바코드 규격','text','',(['CODE128','EAN13','EAN8','UPC','ITF14','CODE39'] as const).filter(v=>mode!=='check-digit'||!['CODE128','CODE39'].includes(v)).map(v=>[v,v==='UPC'?'UPC-A':v]),'EAN13');field('value','바코드 값','text','상품번호는 마지막 한 자리 없이 입력하면 계산하고, 전체 입력하면 검증합니다.');}
 if(mode==='barcode-generator'){field('scale','막대 최소 폭','text','너비는 내용 길이에 따라 달라집니다.',[['1','1px'],['2','2px (기본)'],['3','3px'],['4','4px']],'2');field('height','막대 높이 (px)','number','40~200px',undefined,'90');const bulk=field('bulkValues','일괄 바코드 값','textarea','한 줄에 하나, 최대50개. 선행 0을 유지합니다. 잘못된 줄은 건너뛰고 오류를 표시합니다.');bulk.parentElement!.hidden=true;const batch=choice('batch','일괄 생성');batch.addEventListener('change',()=>{bulk.parentElement!.hidden=!batch.checked;controls.value.disabled=batch.checked;});note.textContent='바코드를 생성해도 상품번호가 발급·등록되는 것은 아닙니다. 중복 번호와 체크디지트 오류를 확인하고 실제 인쇄물로 스캔하세요.';}
 if(mode.endsWith('-qr')){
  const opts=element('details','generation-options');opts.append(element('summary','','출력 옵션'));
  const before=inputs;
  const level=field('level','오류 복원 수준','text','높을수록 QR이 촘촘해지고 용량이 줄어듭니다.',[['L','L · 낮음'],['M','M · 기본'],['Q','Q · 높음'],['H','H · 가장 높음']],'M');
  const size=field('size','목표 이미지 크기','text','정수 픽셀로 맞추므로 실제 크기는 조금 커집니다.',[['256','256px'],['512','512px'],['1024','1024px']],'512');
  const color=field('color','코드 색상','text','배경은 흰색으로 고정합니다.',[['#17243b','차콜'],['#173d70','네이비'],['#253d32','딥 그린']],'#17243b');
  for(const c of [level,size,color])opts.append(c.parentElement!);before.append(opts);
 }
 if(mode==='password-generator'){field('length','비밀번호 길이','number','8~128자. 각 서비스의 길이·기호 제한을 확인하세요.',undefined,'20');choice('upper','영문 대문자',true);choice('lower','영문 소문자',true);choice('numbers','숫자',true);choice('symbols','기호',true);choice('exclude','헷갈리는 문자 제외 (0 O 1 I l |)',true);}
 let fileInput:HTMLInputElement|undefined;
 if(mode==='qr-reader'){
  const box=element('div','file-drop'),fileButton=button('QR 이미지 선택','',()=>fileInput?.click());fileInput=element('input');fileInput.type='file';fileInput.accept='image/png,image/jpeg,image/webp';fileInput.hidden=true;fileInput.id='qr-file';
  box.append(element('p','','PNG · JPG · WebP'),fileButton,fileInput,element('p','field-hint','최대 10MB · 1,600만 픽셀 · QR 한 개'));
  inputs.append(box);actions.hidden=true;topActions.firstElementChild?.remove();
  fileInput.addEventListener('change',()=>{if(fileInput?.files?.[0])void readImage(fileInput.files[0]);});
  box.addEventListener('dragover',e=>e.preventDefault());box.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer?.files.length===1)void readImage(e.dataTransfer.files[0]);else message('이미지 한 개만 선택해 주세요.',true);});
 }
 // Any source or generation option change invalidates the old result immediately.
 for(const [k,c] of Object.entries(controls))if(k!=='show-password')c.addEventListener(c instanceof HTMLSelectElement||c instanceof HTMLInputElement&&c.type==='checkbox'?'change':'input',()=>{invalidate();message('입력이 변경되었습니다. 다시 만들어 주세요.');});
 form.addEventListener('submit',e=>{e.preventDefault();void generate();});
 function values():Fields{return Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c instanceof HTMLInputElement&&c.type==='checkbox'?c.checked:c.value]));}
 function message(s:string,error=false){status.textContent=s;status.classList.toggle('error',error);}
 function cancel(){worker?.terminate();worker=null;if(timer)clearTimeout(timer);timer=null;rejectPending?.(new Error('작업이 취소되었습니다.'));rejectPending=null;submit.disabled=false;root.removeAttribute('aria-busy');}
 function invalidate(){sequence++;cancel();current=null;document.body.classList.remove('printing');for(const u of printURLs.splice(0))URL.revokeObjectURL(u);batchList.replaceChildren();savePNG.textContent='PNG 저장';saveSVG.textContent='SVG 저장';if(imageURL)URL.revokeObjectURL(imageURL);imageURL='';image.removeAttribute('src');image.hidden=true;toolbar.hidden=true;printSettings.hidden=true;details.hidden=true;details.open=false;output.hidden=true;output.value='';secretOutput.value='';secretOutput.type='password';secretOutput.hidden=true;passShow.hidden=true;passShowCheck.checked=false;openLink.hidden=true;openLink.removeAttribute('href');meta.textContent='';empty.hidden=false;document.querySelector('#print-area')?.remove();}
 function loadSample(){if(controls.batch instanceof HTMLInputElement){controls.batch.checked=false;controls.bulkValues.parentElement!.hidden=true;controls.value.disabled=false;}invalidate();for(const [k,c]of Object.entries(controls)){if(k==='show-password'){(c as HTMLInputElement).checked=false;continue;}const v=(tool.sample as Fields)[k];if(v===undefined)continue;if(c instanceof HTMLInputElement&&c.type==='checkbox')c.checked=Boolean(v);else c.value=String(v);}const p=controls.password;if(p instanceof HTMLInputElement){p.type='password';p.disabled=controls.auth?.value==='nopass';}message('예제를 불러왔습니다. 만들기 버튼을 눌러 결과를 확인하세요.');}
 function clear(){form.reset();if(controls.batch instanceof HTMLInputElement){controls.bulkValues.parentElement!.hidden=true;controls.value.disabled=false;}for(const [k,c]of Object.entries(controls)){if(c instanceof HTMLInputElement&&c.type==='checkbox')c.checked=['upper','lower','numbers','symbols','exclude'].includes(k);else if(c instanceof HTMLSelectElement)c.value=({auth:'WPA',format:'EAN13',scale:'2',level:'M',size:'512',color:'#17243b'} as Record<string,string>)[k]??c.options[0].value;else c.value=k==='length'?'20':k==='height'?'90':'';}if(controls.password instanceof HTMLInputElement){controls.password.type='password';controls.password.disabled=false;}printTitle.value='';if(fileInput)fileInput.value='';invalidate();message('입력과 결과를 지웠습니다. 저장한 파일과 클립보드는 별도로 관리하세요.');}
 async function generate(){
  if(exporting){message('ZIP 저장이 끝나면 다시 생성할 수 있습니다.');return;}
  invalidate();const ticket=sequence;
  try{
   if(mode==='password-generator'){const f=values();current=password(Number(f.length),f);empty.hidden=true;secretOutput.value=current.value!;secretOutput.hidden=false;passShow.hidden=false;toolbar.hidden=false;savePNG.hidden=true;saveSVG.hidden=true;printButton.hidden=true;meta.textContent=`${current.value!.length}자 · 선택한 문자 종류를 모두 포함`;message('새 비밀번호를 생성했습니다. 안전한 곳에 보관하세요.');return;}
   submit.disabled=true;root.setAttribute('aria-busy','true');message('코드를 만드는 중입니다…');
   const data=await execute(new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}),{kind:mode,fields:values()},5000);
   if(ticket!==sequence)return;cancel();if(data.error)throw new Error(data.error);current=data.result;
   showResult();message(mode==='check-digit'?'체크디지트를 확인했습니다.':'생성했습니다. 저장한 이미지도 실제 기기에서 읽어 보세요.');
  }catch(error){if(ticket!==sequence)return;cancel();message(error instanceof Error?error.message:'처리에 실패했습니다.',true);}
 }
 function execute(w:Worker,data:unknown,timeout:number,transfer:Transferable[]=[]):Promise<any>{worker=w;return new Promise((resolve,reject)=>{rejectPending=reject;timer=setTimeout(()=>{w.terminate();rejectPending=null;reject(new Error('처리 시간이 초과되었습니다. 내용을 줄여 다시 시도해 주세요.'));},timeout);w.onmessage=({data})=>{rejectPending=null;resolve(data);};w.onerror=()=>{rejectPending=null;reject(new Error('작업을 실행할 수 없습니다. 페이지를 새로고침해 주세요.'));};w.postMessage(data,transfer);});}
 function showResult(){
  if(!current)return;empty.hidden=true;toolbar.hidden=false;copy.hidden=false;
  if(current.batch){const valid=current.batch.filter(r=>r.svg);savePNG.textContent='PNG ZIP 저장';saveSVG.textContent='SVG ZIP 저장';savePNG.disabled=!valid.length;saveSVG.disabled=!valid.length;printButton.disabled=!valid.length;current.value=valid.map(r=>r.value).join('\n');output.value=current.value;output.hidden=false;resultPanel.insertBefore(output,toolbar);meta.textContent=`전체 ${current.batch.length}개 · 생성 ${valid.length} · 오류 ${current.batch.length-valid.length} · 중복 ${valid.filter(r=>r.duplicate).length} (중복도 포함)`;const list=element('ol');for(const row of current.batch){const li=element('li');li.append(element('strong','',`${row.index}. ${row.value||row.raw}`),element('p',row.error?'error':'',row.error||`${row.width}×${row.height}px${row.duplicate?' · 중복 번호':''}`));if(row.svg)li.append(button('미리보기','',()=>{if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(new Blob([row.svg!],{type:'image/svg+xml'}));image.src=imageURL;image.hidden=false;}));list.append(li);}batchList.append(list);return;}
  savePNG.disabled=false;saveSVG.disabled=false;printButton.disabled=false;
  if(mode==='check-digit'){output.value=current.value!;output.hidden=false;resultPanel.insertBefore(output,toolbar);savePNG.hidden=true;saveSVG.hidden=true;printButton.hidden=true;meta.textContent=current.checked?'전체 번호의 체크디지트가 일치합니다.':'체크디지트 '+current.value!.at(-1)+'를 더한 완성 번호입니다.';return;}
  if(current.svg){imageURL=URL.createObjectURL(new Blob([current.svg],{type:'image/svg+xml'}));image.src=imageURL;image.hidden=false;printSettings.hidden=false;meta.textContent=`${current.width} × ${current.height}px${current.modules?` · ${current.modules}모듈 · UTF-8 ${current.bytes}바이트 · 여백 4모듈 · 인쇄 모듈 약 ${(Number(printSize.value)/(current.modules+8)).toFixed(2)}mm`:''}`;}
  if(current.payload){details.hidden=false;output.hidden=false;output.value=current.payload;}
  else if(current.value){output.value=current.value;output.hidden=false;resultPanel.insertBefore(output,toolbar);}
 }
 async function exportPNG(){
  const ticket=sequence,result=current,url=imageURL;if(!result?.svg||!url)return;
  try{message('PNG 파일을 준비하고 있습니다…');const img=new Image();img.src=url;await img.decode();if(ticket!==sequence)return;const canvas=document.createElement('canvas');canvas.width=result.width!;canvas.height=result.height!;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('이미지 저장을 지원하지 않는 브라우저입니다.');ctx.drawImage(img,0,0);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/png'));if(ticket!==sequence)return;if(!blob)throw new Error('PNG 저장에 실패했습니다. SVG로 저장해 주세요.');download(blob,'png');message('PNG 저장을 요청했습니다. 브라우저 다운로드 목록을 확인하세요.');}catch(error){if(ticket===sequence)message(error instanceof Error?error.message:'PNG 저장 실패',true);}
 }
 async function exportBatch(ext:'svg'|'png'){
  if(exporting||!current?.batch)return;exporting=true;savePNG.disabled=true;saveSVG.disabled=true;
  const ticket=sequence,batch=current.batch.filter(r=>r.svg),files:{name:string;data:Uint8Array}[]=[];
  try{for(const row of batch){if(ticket!==sequence)return;let data:Uint8Array;
    if(ext==='svg')data=new TextEncoder().encode(row.svg!);
    else{const url=URL.createObjectURL(new Blob([row.svg!],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();if(ticket!==sequence)return;const canvas=element('canvas');canvas.width=row.width!;canvas.height=row.height!;const ctx=canvas.getContext('2d');if(!ctx)throw Error('PNG 저장을 지원하지 않습니다.');ctx.drawImage(img,0,0);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('PNG 저장 실패. SVG ZIP을 사용하세요.');data=new Uint8Array(await blob.arrayBuffer());canvas.width=canvas.height=1;}finally{URL.revokeObjectURL(url);}}
    files.push({name:`barcode-${String(row.index).padStart(3,'0')}.${ext}`,data});if(files.reduce((n,f)=>n+f.data.length,0)>50*1024*1024)throw Error('ZIP 합계가 50MB를 넘었습니다. 개수를 줄이세요.');message(`${ext.toUpperCase()} 준비 ${files.length}/${batch.length}`);
   }if(ticket!==sequence)return;const zip=storedZip(files);download(new Blob([zip as Uint8Array<ArrayBuffer>],{type:'application/zip'}),'zip');message(`${files.length}개 ${ext.toUpperCase()} ZIP 저장을 요청했습니다. 오류 줄은 제외했습니다.`);
  }catch(error){if(ticket===sequence)message(error instanceof Error?error.message:'ZIP 생성 실패',true);}finally{exporting=false;savePNG.disabled=false;saveSVG.disabled=false;}
 }
 function download(blob:Blob,ext:string){const url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download=`키미_${tool.name.replace(/[^가-힣A-Za-z0-9]+/g,'_')}_${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())}.${ext}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function copyResult(){const text=current?.payload??current?.value;if(!text)return;const ticket=sequence;try{await navigator.clipboard.writeText(text);if(ticket===sequence)message('복사했습니다. 클립보드 기록에 남을 수 있습니다.');}catch{if(ticket!==sequence)return;if(mode==='password-generator'){secretOutput.type='text';passShowCheck.checked=true;secretOutput.select();}else{details.open=true;output.focus();output.select();}message('자동 복사가 제한되어 내용을 선택했습니다. Ctrl+C 또는 길게 눌러 복사해 주세요.');}}
 async function printResult(){if(!current?.batch&&(!current?.svg||!imageURL))return;const ticket=sequence;document.querySelector('#print-area')?.remove();const area=element('section',`print-area print-size-${printSize.value} copies-${copies.value}`);area.id='print-area';const ready:Promise<void>[]=[];const urls=current?.batch?current.batch.filter(r=>r.svg).map(r=>{const url=URL.createObjectURL(new Blob([r.svg!],{type:'image/svg+xml'}));printURLs.push(url);return url;}):Array(Number(mode.endsWith('-qr')?copies.value:1)).fill(imageURL);for(const url of urls){const card=element('div','print-card');if(printTitle.value.trim())card.append(element('h2','',printTitle.value.trim()));const img=element('img');img.src=url;img.alt='인쇄할 코드';ready.push(img.decode());card.append(img);if(mode==='barcode-generator')card.classList.add('barcode-print');area.append(card);}try{await Promise.all(ready);if(ticket!==sequence)return;document.body.append(area);document.body.classList.add('printing');window.print();}catch{message('인쇄용 이미지를 준비하지 못했습니다. PNG나 SVG로 저장해 인쇄해 주세요.',true);for(const u of printURLs.splice(0))URL.revokeObjectURL(u);}}
 window.addEventListener('afterprint',()=>{document.body.classList.remove('printing');document.querySelector('#print-area')?.remove();for(const u of printURLs.splice(0))URL.revokeObjectURL(u);});
 if(mode.endsWith('-qr')){const help=element('p','field-hint','정적 QR은 생성 후 목적지를 수정할 수 없습니다. 원본 주소를 바꾸면 QR도 새로 만들어야 합니다. 흰 여백을 자르지 마세요.');resultPanel.append(help);printSize.addEventListener('change',()=>{if(current?.modules)meta.textContent=`${current.width}×${current.height}px · ${current.modules}모듈 · 여백 4모듈 · ${printSize.value}mm 인쇄 시 모듈 약 ${(Number(printSize.value)/(current.modules+8)).toFixed(2)}mm${Number(printSize.value)/(current.modules+8)<.4?' · 촘촘함: 크게 인쇄하고 실제 스캔을 확인하세요.':''}`;});}
 if(mode==='wifi-qr')note.textContent='와이파이 QR의 비밀번호는 암호화되지 않아 누구나 읽을 수 있습니다. 다운로드·인쇄물도 비밀번호처럼 관리하세요. 입력은 저장하지 않습니다.';
 async function readImage(file:File){
  invalidate();const ticket=sequence;let bitmap:ImageBitmap|undefined;
  try{
   if(file.size>10*1024*1024||file.size===0)throw new Error('빈 파일이거나 10MB를 초과합니다.');
   const encoded=new Uint8Array(await file.arrayBuffer());if(ticket!==sequence)return;imageInfo(encoded);
   root.setAttribute('aria-busy','true');message('이미지를 이 브라우저에서 읽고 있습니다…');
   bitmap=await createImageBitmap(file);if(ticket!==sequence)return;
   if(bitmap.width*bitmap.height>16000000)throw new Error('원본 이미지가 1,600만 픽셀을 초과합니다. QR 주변을 잘라 다시 선택해 주세요.');
   const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=element('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('브라우저에서 이미지 분석을 지원하지 않습니다.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();bitmap=undefined;
   const rgba=ctx.getImageData(0,0,canvas.width,canvas.height),data=await execute(new Worker(new URL('./reader-worker.ts',import.meta.url),{type:'module'}),{width:canvas.width,height:canvas.height,buffer:rgba.data.buffer},8000,[rgba.data.buffer]);
   if(ticket!==sequence)return;cancel();if(data.error)throw new Error(data.error);if(data.text===null)throw new Error('QR을 찾지 못했습니다. 정면에서 크게 촬영하거나 QR 주변을 잘라 다시 시도해 주세요.');
   current={value:data.text};empty.hidden=true;output.value=data.text;output.hidden=false;resultPanel.insertBefore(output,toolbar);toolbar.hidden=false;savePNG.hidden=true;saveSVG.hidden=true;printButton.hidden=true;meta.textContent='읽은 내용을 확인하세요. 링크나 접속 정보는 자동으로 실행하지 않습니다.';
   try{const u=webURL(data.text);if(u.length<=2048){openLink.href=u;openLink.hidden=false;openLink.textContent=`${new URL(u).hostname} 열기 ↗`;}}catch{/* A non-web payload is displayed as text only. */}
   message('QR 내용을 읽었습니다. 와이파이 QR이면 비밀번호가 포함될 수 있습니다.');
  }catch(error){if(ticket===sequence){cancel();message(error instanceof Error?error.message:'이미지를 읽지 못했습니다.',true);}}finally{bitmap?.close();if(fileInput)fileInput.value='';}
 }
 window.addEventListener('pagehide',()=>{invalidate();for(const c of Object.values(controls))if(!(c instanceof HTMLSelectElement)&&!(c instanceof HTMLInputElement&&c.type==='checkbox'))c.value='';printTitle.value='';});
 window.addEventListener('pageshow',e=>{if(e.persisted)clear();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='password-generator'){secretOutput.type='password';passShowCheck.checked=false;}});
}
