import { z } from 'astro/zod';
import projectData from '../data/projects.json';
import playData from '../data/play.json';
import { youtubeEmbed } from './media';

import { projectSchema, playSchema, unique } from './content-schemas';

export const projects = unique(z.array(projectSchema).parse(projectData.items), 'project').map((project) => ({ ...project, videos: project.videos.map((video) => ({ ...video, src: video.type === 'youtube' ? youtubeEmbed(video.src) : video.src })) }));
export const playItems = unique(z.array(playSchema).parse(playData.items), 'play');
export type Project = z.infer<typeof projectSchema>;
export type PlayItem = z.infer<typeof playSchema>;
