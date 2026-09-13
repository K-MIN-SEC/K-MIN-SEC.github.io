import { flash, notify } from './feedback';
import { ensureCommunityUser, communityDisplayName, messageOf, supabase } from './supabase';
import { contentActions } from './content-actions';
import { uploadFiles, validateFiles, removeFile, downloadFile, spaceExtendedEnabled, isPreviewImage, previewImage } from './space-files';

const board = document.querySelector<HTMLElement>('[data-space-board]')!;
if (board && !board.dataset.ready) {
  board.dataset.ready = 'true';
  const previewUrls:string[]=[];let previewGeneration=0;
  const clearPreviews=()=>{previewGeneration++;previewUrls.splice(0).forEach(url=>URL.revokeObjectURL(url));};
  window.addEventListener('pagehide',clearPreviews);
  const status = board.querySelector<HTMLElement>('[data-space-status]')!;
  const form = board.querySelector<HTMLFormElement>('[data-post-form]');
  const mode=board.dataset.mode;
  let editingPost:{id:string;user_id:string;display_name:string}|null=null;
  let existingFiles:{filename:string;object_path:string}[]=[];
  let replyName='회원';
  if(mode==='list'&&location.hash==='#write')location.replace('/space/write/');
  let filter='all';
  let search='';
  const filterStatus=document.createElement('p');filterStatus.className='field-help';filterStatus.setAttribute('role','status');if(mode==='list')board.querySelector('[data-space-feed]')?.after(filterStatus);
  const filterRows=()=>{for(const row of feed.querySelectorAll<HTMLElement>('[data-board-row]'))row.hidden=!(filter==='all'||row.dataset.kind===filter)||!row.textContent?.toLowerCase().includes(search);if(mode==='list'){const total=feed.querySelectorAll('[data-board-row]').length;const count=feed.querySelectorAll('[data-board-row]:not([hidden])').length;filterStatus.textContent=search||filter!=='all'?`불러온 ${total}개 중 ${count}개 · 더 보기를 누르면 다음 글도 검색합니다.`:'';}};
  board.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter!;board.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filterRows();});
  board.querySelector<HTMLInputElement>('[data-board-search]')?.addEventListener('input',e=>{search=(e.target as HTMLInputElement).value.toLowerCase();filterRows();});
  const feed = board.querySelector<HTMLElement>('[data-space-feed]')!;
  const more = board.querySelector<HTMLButtonElement>('[data-space-more]')!;
  const reportDialog = board.querySelector<HTMLDialogElement>('[data-space-report-dialog]')!;
  const reportForm = board.querySelector<HTMLFormElement>('[data-space-report-form]')!;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; };
  const button = (label: string, action: () => Promise<void>, cls = 'text-link') => {
    const b = el('button',label,cls); b.type='button'; b.onclick=async()=>{ b.disabled=true; try {await action();} catch(e){status.textContent=messageOf(e);notify(messageOf(e),'error');} finally{b.disabled=false;} }; return b;
  };
  const report = (id: string,type: string) => button('신고',async()=>{
    await ensureCommunityUser(); (reportForm.elements.namedItem('target_id') as HTMLInputElement).value=id;
    (reportForm.elements.namedItem('target_type') as HTMLInputElement).value=type; reportDialog.showModal();
  },'report-button');
  let limit = 20;
  const sharedId = board.dataset.sharedPost || new URL(location.href).searchParams.get('post');
  const validSharedId = sharedId && /^[0-9a-f-]{36}$/i.test(sharedId) ? sharedId : null;
  async function loadBasic() {
    const postResult = await supabase!.from('space_posts').select('id,user_id,display_name,title,body,link_url,created_at').eq('status','visible').order('created_at',{ascending:false}).limit(50);
    if(postResult.error) throw postResult.error;
    const posts=postResult.data??[]; const ids=posts.map(post=>post.id); const session=await supabase!.auth.getSession(); const userId=session.data.session?.user.id;
    const [likes,replies]=ids.length?await Promise.all([
      supabase!.from('space_likes').select('post_id,user_id').in('post_id',ids),
      supabase!.from('space_comments').select('id,user_id,post_id,display_name,body,created_at').in('post_id',ids).eq('status','visible').order('created_at')
    ]):[{data:[],error:null},{data:[],error:null}];
    if(likes.error)throw likes.error;if(replies.error)throw replies.error;feed.replaceChildren();
    for(const post of posts){
      const article=el('article','','space-post');const meta=el('div','','space-post-meta');meta.append(el('strong',post.display_name),el('time',new Date(post.created_at).toLocaleDateString('ko-KR')),report(post.id,'space_post'));
      article.append(meta,el('h3',post.title),el('p',post.body));if(post.user_id===userId)article.append(contentActions(post,'space_post',load,status));
      if(post.link_url){const link=el('a','공유한 작업 보기 ↗','text-link');link.href=post.link_url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}
      const postLikes=(likes.data??[]).filter(like=>like.post_id===post.id);const liked=postLikes.some(like=>like.user_id===userId);
      const like=button(`${liked?'♥':'♡'} 좋아요 ${postLikes.length}`,async()=>{await ensureCommunityUser();const result=await supabase!.rpc('toggle_space_like',{p_post_id:post.id});if(result.error)throw result.error;await load();notify(liked?'좋아요를 취소했습니다.':'좋아요를 눌렀습니다.');},'like-button');like.setAttribute('aria-pressed',String(liked));article.append(like);
      const replyList=el('div','','space-replies');for(const reply of (replies.data??[]).filter(row=>row.post_id===post.id)){const row=el('article','','space-reply');const top=el('div','','space-reply-meta');top.append(el('strong',reply.display_name),el('time',new Date(reply.created_at).toLocaleDateString('ko-KR')),report(reply.id,'space_comment'));row.append(top,el('p',reply.body));if(reply.user_id===userId)row.append(contentActions(reply,'space_comment',load,status));replyList.append(row);}
      if(userId){const replyForm=el('form','','space-reply-form');const nick=el('span',replyName,'reply-author');const body=el('input');body.placeholder='답글을 남겨주세요';body.setAttribute('aria-label','답글 내용');body.required=true;body.minLength=2;body.maxLength=800;const send=el('button','답글','button secondary');send.type='submit';replyForm.append(nick,body,send);replyForm.onsubmit=async event=>{event.preventDefault();send.disabled=true;try{await ensureCommunityUser();const result=await supabase!.rpc('create_space_comment',{p_post_id:post.id,p_name:await communityDisplayName(),p_body:body.value});if(result.error)throw result.error;await load();status.textContent='댓글을 등록했습니다.';}catch(error){status.textContent=messageOf(error);}finally{send.disabled=false;}};replyList.append(replyForm);}
      article.append(replyList);feed.append(article);
    }
    more.hidden=true;status.textContent=posts.length?'':'첫 번째 이야기를 남겨보세요.';
  }
  async function load() {
    if(mode==='write'){status.textContent='';return;}
    if(mode==='edit'){await loadEditor();return;}
    if (!supabase) {status.textContent='방문자 Space 연결을 준비하고 있습니다.';return;}
    status.textContent='게시글을 불러오는 중입니다.';
    if(!spaceExtendedEnabled){await loadBasic();return;}
    const session = await supabase.auth.getSession(); const userId=session.data.session?.user.id;
    const adminResult = userId ? await supabase.rpc('is_admin') : {data:false,error:null};
    if(adminResult.error) throw adminResult.error;
    const admin = Boolean(adminResult.data);
    const summaries: {id:string;display_name:string;title:string;created_at:string;is_secret:boolean;is_notice:boolean}[]=[];
    for(let offset=0;offset<limit;offset+=20){
      const result=await supabase.rpc('list_space_posts',{p_offset:offset,p_id:validSharedId});
      if(result.error) throw result.error; summaries.push(...result.data); if(result.data.length<20) break;
    }
    clearPreviews();feed.replaceChildren();
    for(const summary of summaries) {
      if(mode==='list'){
        const row=el('a','','board-row');row.href='/space/'+summary.id+'/';row.dataset.boardRow='';row.dataset.kind=summary.is_notice?'notice':summary.is_secret?'secret':'general';
        row.append(el('span',summary.is_notice?'공지':summary.is_secret?'비밀':'일반','board-badge'),el('strong',summary.title,'board-title'),el('span',summary.display_name,'board-author'),el('time',new Date(summary.created_at).toLocaleDateString('ko-KR'),'board-date'));feed.append(row);continue;
      }
      const article=el('article','','space-post'); article.id=`post-${summary.id}`;
      const meta=el('div','','space-post-meta');
      meta.append(el('strong',summary.display_name),el('time',new Date(summary.created_at).toLocaleDateString('ko-KR')));
      const heading=el('h1',`${summary.is_notice?'📌 공지 · ':''}${summary.is_secret?'🔒 ':''}${summary.title}`);
      article.append(meta,heading); feed.append(article);
      const shareUrl=new URL(`/space/${summary.id}/`,location.origin);
      const share=el('a','글 공유 링크','text-link');share.href=shareUrl.href;article.append(share);
      const detail=await supabase.from('space_posts').select('*').eq('id',summary.id).maybeSingle();
      if(detail.error) throw detail.error;
      if(!detail.data) {
        article.append(el('p','로그인 후 비밀번호를 입력하면 본문·댓글·첨부파일을 볼 수 있습니다. 작성자와 관리자는 바로 열람할 수 있습니다.'));
        const unlock=el('form','','space-reply-form');const label=el('label','글 비밀번호');const password=el('input');password.type='password';password.required=true;password.autocomplete='off';label.append(password);
        const submit=el('button','비밀글 열기','button secondary');submit.type='submit';unlock.append(label,submit);
        unlock.onsubmit=async(event)=>{event.preventDefault();submit.disabled=true;try{
          await ensureCommunityUser();const result=await supabase!.rpc('unlock_space_post',{p_id:summary.id,p_password:password.value});password.value='';
          if(result.error)throw result.error;if(!result.data)throw new Error('비밀번호가 올바르지 않거나 시도 횟수를 초과했습니다. 5회 실패한 경우 15분 뒤 다시 시도해 주세요.');await load();
        }catch(e){status.textContent=messageOf(e);notify(messageOf(e),'error');}finally{submit.disabled=false;}};article.append(unlock);continue;
      }
      const post=detail.data; const manages=admin||post.user_id===userId;
      meta.append(report(post.id,'space_post'));article.append(el('p',post.body));
      if(post.link_url){const link=el('a','공유한 작업 보기 ↗','text-link');link.href=post.link_url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}
      if(manages) article.append(contentActions(post,'space_post',load,status,admin));
      const [files,likes,replies]=await Promise.all([
        supabase.from('space_attachments').select('filename,object_path').eq('post_id',post.id),
        supabase.from('space_likes').select('user_id').eq('post_id',post.id),
        supabase.from('space_comments').select('*').eq('post_id',post.id).eq('status','visible').order('created_at'),
      ]);
      for(const result of [files,likes,replies])if(result.error)throw result.error;
      const attachments=el('div','','space-attachments');
      for(const file of files.data??[]) {
        if(isPreviewImage(file.filename)){
          const figure=el('figure','','attachment-image');const caption=el('figcaption',file.filename);figure.append(caption);attachments.append(figure);
          const generation=previewGeneration;caption.textContent=file.filename+' · 사진을 불러오는 중입니다.';
          void previewImage(file.object_path,file.filename).then(source=>{
            if(!source)return;if(generation!==previewGeneration||!figure.isConnected){URL.revokeObjectURL(source);return;}
            previewUrls.push(source);const img=el('img');img.src=source;img.alt=file.filename;img.loading='lazy';img.decoding='async';caption.textContent=file.filename;
            img.onerror=()=>{img.remove();caption.textContent=file.filename+' · 미리보기를 불러오지 못했습니다.';};figure.prepend(img);
          }).catch(()=>{caption.textContent=file.filename+' · 미리보기를 불러오지 못했습니다. 아래 다운로드를 이용해 주세요.';});
        }
        const row=el('div','','form-actions');row.append(button(`📎 ${file.filename}`,()=>downloadFile(file.object_path,file.filename)));
        attachments.append(row);}
      article.append(attachments);
      const liked=likes.data?.some(l=>l.user_id===userId);
      const like=button(`${liked?'♥':'♡'} 좋아요 ${likes.data?.length??0}`,async()=>{await ensureCommunityUser();const result=await supabase!.rpc('toggle_space_like',{p_post_id:post.id});if(result.error)throw result.error;await load();notify(liked?'좋아요를 취소했습니다.':'좋아요를 눌렀습니다.');},'like-button');like.setAttribute('aria-pressed',String(Boolean(liked)));article.append(like);
      const replyList=el('div','','space-replies');replyList.append(el('h2','댓글 '+(replies.data?.length??0)));
      for(const reply of replies.data??[]){const row=el('article','','space-reply');const top=el('div','','space-reply-meta');top.append(el('strong',reply.display_name));row.append(top,el('p',reply.body));
        const actions=admin||reply.user_id===userId?contentActions(reply,'space_comment',load,status,admin):el('div','','form-actions');actions.classList.add('comment-actions');actions.append(report(reply.id,'space_comment'));row.append(actions);replyList.append(row);}
      if(userId){const replyForm=el('form','','space-reply-form');const nick=el('span',replyName,'reply-author');
        const body=el('input');body.placeholder='답글을 남겨주세요';body.setAttribute('aria-label','답글 내용');body.required=true;body.minLength=2;body.maxLength=800;const send=el('button','답글','button secondary');send.type='submit';replyForm.append(nick,body,send);
        replyForm.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await ensureCommunityUser();const result=await supabase!.rpc('create_space_comment',{p_post_id:post.id,p_name:await communityDisplayName(),p_body:body.value});if(result.error)throw result.error;await load();status.textContent='댓글을 등록했습니다.';}catch(error){status.textContent=messageOf(error);}finally{send.disabled=false;}};replyList.append(replyForm);
      }else replyList.append(el('p','댓글을 남기려면 상단에서 로그인해 주세요.'));
      article.append(replyList);
    }
    filterRows();
    more.hidden=Boolean(validSharedId)||summaries.length<limit;
    status.textContent=summaries.length?'':validSharedId?'삭제되었거나 숨겨진 게시글입니다.':'첫 번째 이야기를 남겨보세요.';
  }
  async function loadEditor(){
    const fields=board.querySelector<HTMLFieldSetElement>('[data-edit-fields]')!;fields.disabled=true;
    await ensureCommunityUser();
    const allowed=await supabase!.rpc('can_manage_space',{p_id:validSharedId});if(allowed.error)throw allowed.error;
    if(!allowed.data)throw new Error('이 글을 수정할 권한이 없습니다. 작성자 또는 운영자만 수정할 수 있습니다.');
    const result=await supabase!.from('space_posts').select('*').eq('id',validSharedId!).maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error('수정할 글을 찾지 못했습니다.');
    const post=result.data;editingPost=post;
    for(const name of ['title','body','link_url','display_name']){const input=form!.elements.namedItem(name) as HTMLInputElement;input.value=post[name]||'';}
    board.querySelector<HTMLElement>('[data-post-author]')!.textContent=post.display_name;
    await loadExistingFiles();fields.disabled=false;status.textContent=post.is_secret?'비밀글입니다. 기존 게시글 비밀번호와 공개 범위는 유지됩니다.':'내용과 첨부파일을 수정할 수 있습니다.';
  }
  async function loadExistingFiles(){
    const files=await supabase!.from('space_attachments').select('filename,object_path').eq('post_id',validSharedId!);if(files.error)throw files.error;existingFiles=files.data||[];
    const section=board.querySelector<HTMLElement>('[data-existing-files]')!,list=board.querySelector<HTMLElement>('[data-existing-file-list]')!;list.replaceChildren();section.hidden=false;
    for(const file of existingFiles){const row=el('div','','existing-file-row');const label=el('label');const checkbox=el('input');checkbox.type='checkbox';checkbox.name='remove_files';checkbox.value=file.object_path;label.append(checkbox,el('span','삭제 선택'));row.append(button(file.filename,()=>downloadFile(file.object_path,file.filename)),label);list.append(row);}
    if(!existingFiles.length)list.append(el('p','첨부된 파일이 없습니다.'));
  }
  async function saveEdit(data:FormData,files:File[]){
    if(!editingPost)throw new Error('수정할 글과 권한을 먼저 확인해 주세요.');
    const removals=existingFiles.filter(f=>data.getAll('remove_files').includes(f.object_path));
    if(existingFiles.length-removals.length+files.length>5)throw new Error('기존 파일과 새 파일을 합쳐 최대 5개까지 첨부할 수 있습니다.');
    const result=await supabase!.rpc('edit_community_content',{p_type:'space_post',p_id:editingPost.id,p_name:editingPost.display_name,p_title:data.get('title'),p_body:data.get('body'),p_link:data.get('link_url')||null});if(result.error)throw result.error;
    try{for(const file of removals)await removeFile(file.object_path);await uploadFiles(editingPost.id,files);}
    catch(error){await loadExistingFiles();const input=form!.elements.namedItem('files') as HTMLInputElement;if(input){input.value='';input.dispatchEvent(new Event('change'));}throw new Error('본문은 저장했습니다. 첨부 처리 중 오류가 발생했습니다. 현재 파일 목록을 확인하고 다시 선택해 주세요. '+messageOf(error));}
    dirty=false;flash('게시글을 수정했습니다.');location.assign('/space/'+editingPost.id+'/');
  }
  if(form)form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;submit.disabled=true;let created=false;let createdId='';
    try{const user=await ensureCommunityUser();const data=new FormData(form);const fileInput=form.elements.namedItem('files') as HTMLInputElement|null;const files=Array.from(fileInput?.files??[]);if(spaceExtendedEnabled)validateFiles(files);
      if(mode==='edit'){await saveEdit(data,files);return;}
      const result=spaceExtendedEnabled
        ? await supabase!.rpc('create_space_post',{p_name:await communityDisplayName(),p_title:data.get('title'),p_body:data.get('body'),p_link:data.get('link_url')||null,p_password:data.get('password')||null})
        : await supabase!.from('space_posts').insert({user_id:user.id,display_name:await communityDisplayName(),title:data.get('title'),body:data.get('body'),link_url:data.get('link_url')||null}).select('id').single();
      if(result.error)throw result.error;created=true;createdId=typeof result.data==='string'?result.data:result.data.id;
      // Reset immediately after the post commits so retries cannot duplicate it.
      form.reset();dirty=false;if(spaceExtendedEnabled)await uploadFiles(createdId,files);flash('게시글을 등록했습니다.');location.assign('/space/'+createdId+'/');
    }catch(error){if(created){const link=el('a','수정 페이지에서 첨부파일 다시 올리기 →','button secondary');link.href='/space/edit/?post='+encodeURIComponent(createdId);board.append(link);submit.hidden=true;status.textContent=`글은 저장했지만 일부 첨부파일을 올리지 못했습니다. 수정 페이지에서 다시 첨부해 주세요. ${messageOf(error)}`;}else status.textContent=messageOf(error);}finally{submit.disabled=false;}};
  reportForm.onsubmit=async e=>{e.preventDefault();if((e.submitter as HTMLButtonElement).value==='cancel'){reportDialog.close();return;}try{await ensureCommunityUser();const data=new FormData(reportForm);const result=await supabase!.rpc('create_community_report',{p_target_id:data.get('target_id'),p_type:data.get('target_type'),p_reason:data.get('reason')});if(result.error)throw result.error;reportDialog.close();status.textContent='신고가 접수되었습니다.';}catch(error){status.textContent=messageOf(error);}};
  more.onclick=()=>{limit+=20;load().catch(e=>status.textContent=messageOf(e));};
  let dirty=false;
  form?.addEventListener('input',()=>dirty=true);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  const fileInput=form?.elements.namedItem('files') as HTMLInputElement|null;
  if(fileInput){
    const note=el('small');note.setAttribute('role','status');const previews=el('div','','attachment-selection');fileInput.after(note,previews);
    const selectedUrls:string[]=[];const clear=()=>{selectedUrls.splice(0).forEach(u=>URL.revokeObjectURL(u));previews.replaceChildren();};
    window.addEventListener('pagehide',clear);form?.addEventListener('reset',()=>{clear();note.textContent='';fileInput.setCustomValidity('');});
    fileInput.onchange=()=>{clear();try{
      const files=Array.from(fileInput.files??[]);validateFiles(files);note.textContent=files.length?files.length+'개 선택됨 · '+(mode==='edit'?'수정 저장':'게시하기')+'를 누르면 업로드됩니다.':'선택한 파일이 없습니다.';fileInput.setCustomValidity('');
      for(const file of files){const figure=el('figure','','attachment-image');const caption=el('figcaption',file.name+' · '+(file.size/1024).toFixed(1)+' KB');figure.append(caption);
        if(isPreviewImage(file.name)&&['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){const source=URL.createObjectURL(file);selectedUrls.push(source);const img=el('img');img.src=source;img.alt=file.name+' 미리보기';img.onerror=()=>{img.remove();caption.textContent=file.name+' · 미리보기 불가';};figure.prepend(img);}previews.append(figure);}
    }catch(e){note.textContent=messageOf(e);fileInput.setCustomValidity(messageOf(e));notify(messageOf(e),'error');}};
  }
  const prefill=async()=>{if(!supabase||mode==='edit')return;const session=await supabase.auth.getSession();if(!session.data.session?.user)return;replyName=await communityDisplayName();const label=board.querySelector<HTMLElement>('[data-post-author]');if(label)label.textContent=replyName;};
  prefill().catch(()=>{}).then(()=>load()).catch(e=>status.textContent=messageOf(e));
}
