export function notify(message:string,kind:'success'|'error'|'info'='success'){
  let host=document.querySelector<HTMLElement>('[data-toast-host]');
  if(!host){host=document.createElement('div');host.dataset.toastHost='';host.className='toast-host';document.body.append(host);}
  const toast=document.createElement('div');toast.className=`toast toast-${kind}`;toast.setAttribute('role',kind==='error'?'alert':'status');
  const text=document.createElement('span');text.textContent=`${kind==='success'?'✓ ':kind==='error'?'! ':''}${message}`;
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','알림 닫기');close.onclick=()=>toast.remove();toast.append(text,close);host.replaceChildren(toast);
  if(kind!=='error')setTimeout(()=>toast.remove(),6500);
}
export function flash(message:string){sessionStorage.setItem('creator-feedback',message);}
export function installFeedback(){
  const saved=sessionStorage.getItem('creator-feedback');if(saved){sessionStorage.removeItem('creator-feedback');notify(saved);}
  // Preserve existing inline messages and repeat action results near the viewport.
  for(const status of document.querySelectorAll<HTMLElement>('[role=status]')){
    let previous=status.textContent;
    new MutationObserver(()=>{const message=status.textContent?.trim()||'';if(message===previous)return;previous=message;if(message.startsWith('새로 작성하거나'))return;
      if(/저장했습니다|수정했습니다|삭제했습니다|접수했습니다|접수되었습니다|보냈습니다|게시했습니다|업로드했습니다|변경했습니다|해제했습니다|등록했습니다/.test(message))notify(message);
      else if(/오류|실패|올바르지|초과|못했|못합|입력해 주세요|선택해 주세요|로그인해 주세요|권한이 없|다시 시도/.test(message))notify(message,'error');
    }).observe(status,{childList:true,characterData:true,subtree:true});
  }
  // Busy labels follow actual disabled state; no timer pretends a save succeeded.
  new MutationObserver(records=>{for(const record of records){const b=record.target;if(!(b instanceof HTMLButtonElement)||b.type!=='submit')continue;
    if(b.disabled){if(!b.dataset.idleLabel)b.dataset.idleLabel=b.textContent||'';b.textContent='처리 중…';b.setAttribute('aria-busy','true');}
    else if(b.dataset.idleLabel){b.textContent=b.dataset.idleLabel;delete b.dataset.idleLabel;b.removeAttribute('aria-busy');}
  }}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['disabled']});
}
