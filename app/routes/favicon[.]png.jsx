import { readFile } from 'fs/promises';
import { join } from 'path';

export async function loader() {
  const faviconPath = join(process.cwd(), 'public', 'favicon.png');
  const favicon = await readFile(faviconPath);
  
  return new Response(favicon, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
