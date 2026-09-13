type SlideInfo = {id:string; label:string; caption:string; href?:string; durationMs?:number; fit?:'contain'|'cover'};
type HeroMedia = {type:'image';src:string} | {type:'gif';src:string;poster:string} | {type:'video';src:string;poster:string};
export type HeroSlide = SlideInfo & HeroMedia;
// Replace these entries with featured project artwork or demo footage.
// GIF/video require a still poster for inactive slides and loading fallback.
export const heroSlides:HeroSlide[]=[
  {id:'ai',label:'AI',caption:'아이디어를 실험하고',type:'image',src:'/images/creator/ai.webp',fit:'contain'},
  {id:'game',label:'게임',caption:'새로운 세계를 만들고',type:'image',src:'/images/creator/game.webp',fit:'contain'},
  {id:'art',label:'아트',caption:'상상에 모습을 입히고',type:'image',src:'/images/creator/art.webp',fit:'contain'},
  {id:'sound',label:'사운드',caption:'경험에 소리를 더하고',type:'image',src:'/images/creator/sound.webp',fit:'contain'},
];
