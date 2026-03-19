import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'orders/success/:id',
    renderMode: RenderMode.Ssr
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
