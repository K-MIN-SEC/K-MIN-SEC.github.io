# Home hero media

Edit `src/data/hero-slides.ts` to add, reorder, remove or replace slides.
No Supabase migration or runtime CMS permission is involved. Commit and deploy
this repository to publish changes. Featured-project selection is manual here;
this is not an automatic selection system.

Supported media:

- `type: 'image'`: PNG, WebP, JPEG or other browser-supported still `src`.
- `type: 'gif'`: animated GIF `src`, with a required still `poster`.
- `type: 'video'`: directly playable MP4/WebM `src`, with a required still `poster`.
  YouTube/watch-page URLs are not direct video files.

Optional fields: `href` (project detail link), `durationMs` (default 6500,
minimum 3000), and `fit` (`contain` for cutouts, `cover` for full frames).
`label` names the selector; `caption` describes the project or theme.
Put locally served media in `public/images/creator/` or use an authorized HTTPS
media URL. Do not expose private attachments through this public hero.

Example replacement entry:

```ts
{
  id: 'featured-game', label: '선정 작품', caption: '작품명 · 플레이 데모',
  type: 'video', src: '/media/game-demo.webm',
  poster: '/media/game-demo-poster.webp',
  href: '/works/REAL_PROJECT_ID/', durationMs: 10000, fit: 'cover'
}
```

Only the active video plays, muted and inline. GIFs use posters while inactive. Slides start rotating automatically on entry. Reduced-motion CSS disables
the crossfade transition but does not stop the requested automatic rotation.
There is no pause/play control, as requested. Rotation continues while the page
is visible. Selecting a slide restarts its timer. Background tabs stop playback.
Default images are AI-generated cutouts, not actual community project works.
Image colors are unchanged; dimming and edge blending are CSS display effects.

Rollback: revert the hero component/data/style/assets commit and redeploy the
Worker. No profile, community or database data changes are involved.


QA: production build passed (0 errors/warnings; existing 3 deprecation hints).
Browser checked manual selection and automatic slide advance,
mobile layout with no horizontal
page overflow, and all four deployed images loaded successfully. Default four
WebP cutouts total about 386 KiB and retain alpha. GIF/video branches are ready
for supplied project media; an actual project GIF/video was not uploaded in this
pass. Desktop and mobile visual inspection completed.

Autoplay correction: a fresh browser visit starts running without clicking any
control. Observed selection advance from AI to Art with no interaction.
