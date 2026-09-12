import { ensureCommunityUser, messageOf, supabase } from './supabase';
import { contentActions } from './content-actions';
import { uploadFiles, validateFiles, removeFile, downloadFile } from './space-files';

const board = document.querySelector<HTMLElement>('[data-space-board]');
if (board && !board.dataset.ready) {
  board.dataset.ready = 'true';
  const status = board.querySelector<HTMLElement>('[data-space-status]')!;
  const form = board.querySelector<HTMLFormElement>('[data-post-form]')!;
  const feed = board.querySelector<HTMLElement>('[data-space-feed]')!;
  const more = board.querySelector<HTMLButtonElement>('[data-space-more]')!;
  const reportDialog = board.querySelector<HTMLDialogElement>('[data-space-report-dialog]')!;
  const reportForm = board.querySelector<HTMLFormElement>('[data-space-report-form]')!;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; };
  const button = (label: string, action: () => Promise<void>, cls = 'text-link') => {
    const b = el('button',label,cls); b.type='button'; b.onclick=async()=>{ b.disabled=true; try {await action();} catch(e){status.textContent=messageOf(e);} finally{b.disabled=false;} }; return b;
  };
  const report = (id: string,type: string) => button('신고',async()=>{
    await ensureCommunityUser(); (reportForm.elements.namedItem('target_id') as HTMLInputElement).value=id;
    (reportForm.elements.namedItem('target_type') as HTMLInputElement).value=type; reportDialog.showModal();
  },'report-button');
  let limit = 20;
  const sharedId = new URL(location.href).searchParams.get('post');
  const validSharedId = sharedId && /^[0-9a-f-]{36}$/i.test(sharedId) ? sharedId : null;
  async function load() {
    if (!supabase) {status.textContent='방문자 Space 연결을 준비하고 있습니다.';return;}
    status.textContent='게시글을 불러오는 중입니다.';
    const session = await supabase.auth.getSession(); const userId=session.data.session?.user.id;
    const adminResult = userId ? await supabase.rpc('is_admin') : {data:false,error:null};
    if(adminResult.error) throw adminResult.error;
    const admin = Boolean(adminResult.data);
    const summaries: {id:string;display_name:string;title:string;created_at:string;is_secret:boolean;is_notice:boolean}[]=[];
    for(let offset=0;offset<limit;offset+=20){
      const result=await supabase.rpc('list_space_posts',{p_offset:offset,p_id:validSharedId});
      if(result.error) throw result.error; summaries.push(...result.data); if(result.data.length<20) break;
    }
    feed.replaceChildren();
    for(const summary of summaries) {
      const article=el('article','','space-post'); article.id=`post-${summary.id}`;
      const meta=el('div','','space-post-meta');
      meta.append(el('strong',summary.display_name),el('time',new Date(summary.created_at).toLocaleDateString('ko-KR')));
      const heading=el('h3',`${summary.is_notice?'📌 공지 · ':''}${summary.is_secret?'🔒 ':''}${summary.title}`);
      article.append(meta,heading); feed.append(article);
      const shareUrl=new URL(location.href); shareUrl.search=''; shareUrl.hash='';shareUrl.searchParams.set('post',summary.id);
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
        }catch(e){status.textContent=messageOf(e);}finally{submit.disabled=false;}};article.append(unlock);continue;
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
      for(const file of files.data??[]) {const row=el('div','','form-actions');row.append(button(`📎 ${file.filename}`,()=>downloadFile(file.object_path,file.filename)));
        if(manages)row.append(button('첨부 삭제',async()=>{if(!confirm('이 첨부파일을 삭제할까요?'))return;await removeFile(file.object_path);await load();}));attachments.append(row);}
      if(manages){const label=el('label','첨부파일 추가 (이미지·PDF·TXT·ZIP, 각 10MB / 글당 5개)');const input=el('input');input.type='file';input.multiple=true;input.accept='.jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.zip';label.append(input);
        attachments.append(label,button('선택 파일 업로드',async()=>{const selected=Array.from(input.files??[]);if(!selected.length)throw new Error('첨부할 파일을 선택해 주세요.');try{await uploadFiles(post.id,selected);}catch(e){await load();throw e;}await load();},'button secondary'));}
      article.append(attachments);
      const liked=likes.data?.some(l=>l.user_id===userId);
      const like=button(`${liked?'♥':'♡'} 좋아요 ${likes.data?.length??0}`,async()=>{const user=await ensureCommunityUser();const result=liked?await supabase!.from('space_likes').delete().eq('post_id',post.id).eq('user_id',user.id):await supabase!.from('space_likes').insert({post_id:post.id,user_id:user.id});if(result.error)throw result.error;await load();},'like-button');like.setAttribute('aria-pressed',String(Boolean(liked)));article.append(like);
      const replyList=el('div','','space-replies');
      for(const reply of replies.data??[]){const row=el('article','','space-reply');const top=el('div','','space-reply-meta');top.append(el('strong',reply.display_name),report(reply.id,'space_comment'));row.append(top,el('p',reply.body));
        if(admin||reply.user_id===userId)row.append(contentActions(reply,'space_comment',load,status,admin));replyList.append(row);}
      if(userId){const replyForm=el('form','','space-reply-form');const nick=el('input');nick.placeholder='닉네임';nick.setAttribute('aria-label','답글 닉네임');nick.required=true;nick.maxLength=24;
        const body=el('input');body.placeholder='답글을 남겨주세요';body.setAttribute('aria-label','답글 내용');body.required=true;body.minLength=2;body.maxLength=800;const send=el('button','답글','button secondary');send.type='submit';replyForm.append(nick,body,send);
        replyForm.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{const user=await ensureCommunityUser();const result=await supabase!.from('space_comments').insert({post_id:post.id,user_id:user.id,display_name:nick.value,body:body.value});if(result.error)throw result.error;await load();}catch(error){status.textContent=messageOf(error);}finally{send.disabled=false;}};replyList.append(replyForm);
      }else replyList.append(el('p','댓글을 남기려면 상단에서 로그인해 주세요.'));
      article.append(replyList);
    }
    more.hidden=Boolean(validSharedId)||summaries.length<limit;
    status.textContent=summaries.length?'':validSharedId?'삭제되었거나 숨겨진 게시글입니다.':'첫 번째 이야기를 남겨보세요.';
  }
  form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;submit.disabled=true;let created=false;
    try{await ensureCommunityUser();const data=new FormData(form);const files=Array.from((form.elements.namedItem('files') as HTMLInputElement).files??[]);validateFiles(files);
      const result=await supabase!.rpc('create_space_post',{p_name:data.get('display_name'),p_title:data.get('title'),p_body:data.get('body'),p_link:data.get('link_url')||null,p_password:data.get('password')||null});if(result.error)throw result.error;created=true;
      // Reset immediately after the post commits so retries cannot duplicate it.
      form.reset();await uploadFiles(result.data,files);await load();status.textContent='게시했습니다.';
    }catch(error){if(created){await load();status.textContent=`글은 저장했지만 일부 첨부파일을 올리지 못했습니다. 해당 글에서 다시 첨부해 주세요. ${messageOf(error)}`;}else status.textContent=messageOf(error);}finally{submit.disabled=false;}};
  reportForm.onsubmit=async e=>{e.preventDefault();if((e.submitter as HTMLButtonElement).value==='cancel'){reportDialog.close();return;}try{const user=await ensureCommunityUser();const data=new FormData(reportForm);const result=await supabase!.from('reports').insert({user_id:user.id,target_id:data.get('target_id'),target_type:data.get('target_type'),reason:data.get('reason')});if(result.error)throw result.error;reportDialog.close();status.textContent='신고가 접수되었습니다.';}catch(error){status.textContent=messageOf(error);}};
  more.onclick=()=>{limit+=20;load().catch(e=>status.textContent=messageOf(e));};
  load().catch(e=>status.textContent=messageOf(e));
}
