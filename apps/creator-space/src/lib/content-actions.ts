import { supabase, messageOf } from './supabase';
import { removeFile, spaceExtendedEnabled } from './space-files';
export type ContentType = 'space_post' | 'space_comment' | 'project_comment';
export const contentTables = { space_post: 'space_posts', space_comment: 'space_comments', project_comment: 'project_comments' } as const;
export type CommunityContent = { id: string; display_name: string; body: string; title?: string; link_url?: string | null; status?: string; is_secret?: boolean; is_notice?: boolean };

export function contentActions(item: CommunityContent, type: ContentType, reload: () => Promise<void>, status: HTMLElement, admin = false) {
  const actions = document.createElement('div'); actions.className = 'form-actions';
  const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'text-link'; edit.textContent = '수정';
  edit.addEventListener('click', () => {
    if(type==='space_post'){location.assign('/space/edit/?post='+encodeURIComponent(item.id));return;}
    const dialog = document.createElement('dialog'); dialog.className = 'report-dialog';
    const form = document.createElement('form'); const heading = document.createElement('h3'); heading.textContent = '내용 수정'; form.append(heading);
    const add = (labelText: string, name: string, value: string, max: number, multiline = false) => {
      const label = document.createElement('label'); label.textContent = labelText;
      const input = document.createElement(multiline ? 'textarea' : 'input'); input.name = name; input.value = value; input.maxLength = max; input.required = name !== 'link_url'; input.minLength = name === 'display_name' ? 1 : name === 'link_url' ? 0 : 2;
      if (input instanceof HTMLTextAreaElement) input.rows = 6;
      if (input instanceof HTMLInputElement && name === 'link_url') input.type = 'url';
      label.append(input); form.append(label);
    };
    const author=document.createElement('p');author.textContent=item.display_name;form.append(author);
    add('내용', 'body', item.body, 800, true);
    const notice = document.createElement('p'); notice.setAttribute('role', 'status'); form.append(notice);
    const row = document.createElement('div'); row.className = 'form-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'button secondary'; cancel.textContent = '취소'; cancel.onclick = () => dialog.close();
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'button primary'; save.textContent = '저장'; row.append(cancel, save); form.append(row);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const data = new FormData(form); save.disabled = true;
      try {
        const { error } = await supabase!.rpc('edit_community_content', { p_type: type, p_id: item.id, p_name: item.display_name, p_body: String(data.get('body')).trim(), p_title: data.get('title'), p_link: data.get('link_url') || null });
        if (error) throw error;
        dialog.close(); await reload(); status.textContent = '수정했습니다.';
      } catch (error) { notice.textContent = messageOf(error); }
      finally { save.disabled = false; }
    });
    dialog.append(form); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-link'; remove.textContent = '삭제';
  remove.addEventListener('click', async () => {
    if (!window.confirm('이 내용을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return;
    remove.disabled = true;
    try {
      if (type === 'space_post' && spaceExtendedEnabled) {
        const files = await supabase!.from('space_attachments').select('object_path').eq('post_id', item.id);
        if (files.error) throw files.error;
        for (const file of files.data) await removeFile(file.object_path);
      }
      const { error } = await supabase!.from(contentTables[type]).delete().eq('id', item.id); if (error) throw error; await reload(); status.textContent = '삭제했습니다.'; }
    catch (error) { status.textContent = messageOf(error); } finally { remove.disabled = false; }
  });
  actions.append(edit, remove);
  if (type === 'space_post' && spaceExtendedEnabled) {
    const privacy = document.createElement('button'); privacy.type = 'button'; privacy.className = 'text-link'; privacy.textContent = item.is_secret ? '게시글 비밀번호 변경 / 공개 전환' : '비밀글로 전환';
    privacy.onclick = () => {
      const dialog = document.createElement('dialog'); dialog.className = 'report-dialog';
      const form = document.createElement('form'); const title = document.createElement('h3'); title.textContent = '게시글 공개 설정';
      const label = document.createElement('label'); label.textContent = '새 게시글 비밀번호 (계정 비밀번호와 별개)';
      const input = document.createElement('input'); input.type = 'password'; input.autocomplete = 'off'; input.minLength = 8; input.maxLength = 72; input.required = true; label.append(input);
      const note = document.createElement('p'); note.textContent = '변경하면 기존 비밀번호로 열었던 사람의 열람 권한도 초기화됩니다.'; note.setAttribute('role', 'status');
      const save = document.createElement('button'); save.type = 'submit'; save.className = 'button primary'; save.textContent = '비밀글로 저장';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'button secondary'; open.textContent = '공개글로 전환'; open.hidden = !item.is_secret;
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'text-link'; cancel.textContent = '취소'; cancel.onclick = () => dialog.close();
      const update = async (password: string | null) => {
        save.disabled = open.disabled = true;
        try { const result = await supabase!.rpc('set_space_password', { p_id: item.id, p_password: password }); if (result.error) throw result.error; dialog.close(); await reload(); status.textContent='공개 설정을 변경했습니다.'; }
        catch (error) { note.textContent = messageOf(error); } finally { save.disabled = open.disabled = false; }
      };
      form.onsubmit = e => { e.preventDefault(); void update(input.value); };
      open.onclick = () => { if (confirm('본문·댓글·첨부파일을 모든 방문자에게 공개할까요?')) void update(null); };
      form.append(title,label,note,save,open,cancel); dialog.append(form); dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();
    };
    actions.append(privacy);
    if (admin) {
      const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'text-link'; pin.textContent = item.is_notice ? '공지 해제' : '공지로 등록';
      pin.disabled = Boolean(item.is_secret); if (item.is_secret) pin.title = '공개글만 공지로 등록할 수 있습니다.';
      pin.onclick = async () => { pin.disabled = true; try { const result = await supabase!.rpc('set_space_notice', { p_id: item.id, p_notice: !item.is_notice }); if (result.error) throw result.error; await reload(); status.textContent=item.is_notice?'공지를 해제했습니다.':'공지로 등록했습니다.'; } catch (error) { status.textContent = messageOf(error); pin.disabled = false; } };
      actions.append(pin);
    }
  }
  if (admin) {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'text-link'; toggle.textContent = item.status === 'hidden' ? '다시 공개' : '숨기기';
    toggle.addEventListener('click', async () => {
      toggle.disabled = true;
      try { const { error } = await supabase!.rpc('set_community_visibility', { p_type: type, p_id: item.id, p_status: item.status === 'hidden' ? 'visible' : 'hidden' }); if (error) throw error; await reload(); }
      catch (error) { status.textContent = messageOf(error); } finally { toggle.disabled = false; }
    });
    actions.append(toggle);
  }
  return actions;
}
