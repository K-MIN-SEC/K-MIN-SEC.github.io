document.querySelectorAll<HTMLElement>('[data-tag-picker]').forEach(root=>{
  const value=root.querySelector<HTMLInputElement>('input[type=hidden]')!;
  const input=root.querySelector<HTMLInputElement>('[data-tag-input]')!;
  const selected=root.querySelector<HTMLElement>('[data-selected]')!;
  const status=root.querySelector<HTMLElement>('[data-tag-status]')!;
  const options=[...root.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const values=()=>[...new Set(value.value.split(',').map(v=>v.trim()).filter(Boolean))];
  const render=()=>{
    const tags=values();selected.replaceChildren();
    options.forEach(b=>b.setAttribute('aria-pressed',String(tags.includes(b.dataset.tag!))));
    for(const tag of tags){const b=document.createElement('button');b.type='button';b.className='tag-chip';b.textContent=`${options.find(b=>b.dataset.tag===tag)?.textContent||tag} ×`;b.setAttribute('aria-label',`${tag} 선택 해제`);b.onclick=()=>toggle(tag);selected.append(b);}
    if(!tags.length){const hint=document.createElement('small');hint.textContent='아직 선택한 항목이 없습니다.';selected.append(hint);}
  };
  const toggle=(tag:string)=>{
    let tags=values();
    if(tags.includes(tag))tags=tags.filter(v=>v!==tag);
    else {if(tags.length>=Number(root.dataset.max)){status.textContent=`최대 ${root.dataset.max}개까지 선택할 수 있습니다.`;return;}tags.push(tag);}
    value.value=tags.join(', ');value.dispatchEvent(new Event('input',{bubbles:true}));render();status.textContent=`${tags.length}개 선택됨 · 저장 버튼을 눌러 반영하세요.`;
  };
  options.forEach(b=>b.onclick=()=>toggle(b.dataset.tag!));
  const add=()=>{const tag=input.value.trim();if(!tag){status.textContent='추가할 항목을 입력해 주세요.';input.focus();return;}if(tag.includes(',')){status.textContent='한 번에 한 항목씩 추가해 주세요.';return;}if(values().includes(tag)){status.textContent='이미 선택한 항목입니다.';return;}toggle(tag);input.value='';input.focus();};
  root.querySelector<HTMLButtonElement>('[data-tag-add]')!.onclick=add;
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();add();}});
  value.addEventListener('change',render);value.form?.addEventListener('reset',()=>setTimeout(render,0));render();
});
