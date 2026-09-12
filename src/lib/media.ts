export function youtubeEmbed(src: string) {
  const parsed = new URL(src);
  const host = parsed.hostname.toLowerCase();
  const id = host === 'youtu.be' ? parsed.pathname.slice(1) : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host) ? (parsed.pathname === '/watch' ? parsed.searchParams.get('v') : parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]) : null;
  if (parsed.protocol !== 'https:' || !id || !/^[\w-]{11}$/.test(id)) throw new Error('올바른 YouTube 시청·공유·임베드 주소를 입력하세요.');
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
