/**
 * Per-route title, description and canonical URL. Shared by the runtime <RouteMeta /> (what the
 * browser tab and Google's JS crawler see) and the Vite build, which writes a static HTML copy for
 * the public pages so link previews (WhatsApp, Discord, iMessage) get the right card without JS.
 *
 * Keep this file free of browser and React imports: vite.config.ts imports it.
 */

export const SITE_URL = 'https://www.recta.app';

export interface PageMeta {
  title: string;
  description: string;
  /** Canonical path. Omitted for pages that must not be indexed. */
  canonicalPath?: string;
  noindex?: boolean;
}

export const HOME_META: PageMeta = {
  title: 'Recta - Gerenciador Financeiro | Controle suas Finanças em um Só Lugar',
  description:
    'Reúna todas as suas despesas em um único aplicativo e simplifique suas finanças com o Recta. Controle suas contas, cartões, orçamentos e metas de economia de forma inteligente e segura.',
  canonicalPath: '/',
};

/** Public pages with a static HTML copy generated at build time. */
export const STATIC_PAGE_META: Record<string, PageMeta> = {
  '/privacy': {
    title: 'Política de Privacidade | Recta',
    description:
      'Como o Recta coleta, usa e protege seus dados no app web, no iPhone e no Android, de acordo com a LGPD.',
    canonicalPath: '/privacy',
  },
  '/terms': {
    title: 'Termos de Uso | Recta',
    description: 'Os termos e condições de uso do Recta, o gerenciador financeiro pessoal e da casa.',
    canonicalPath: '/terms',
  },
  '/support': {
    title: 'Suporte | Recta',
    description:
      'Tire suas dúvidas sobre o Recta, fale com a gente por e-mail ou na comunidade do Discord.',
    canonicalPath: '/support',
  },
};

/** /join/:code: shared in chats, so it gets its own card, but it is never indexed. */
export const JOIN_META: PageMeta = {
  title: 'Convite para uma casa no Recta',
  description: 'Você foi convidado para organizar as finanças da casa junto no Recta. Abra o link para entrar.',
  noindex: true,
};

const LOGIN_META: PageMeta = {
  title: 'Entrar | Recta',
  description: HOME_META.description,
  noindex: true,
};

const APP_META: PageMeta = {
  title: 'Recta',
  description: HOME_META.description,
  noindex: true,
};

export function metaForPath(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return HOME_META;
  // /home renders the same landing, so it points search engines at /.
  if (path === '/home') return HOME_META;
  if (STATIC_PAGE_META[path]) return STATIC_PAGE_META[path];
  if (path.startsWith('/join/')) return JOIN_META;
  if (path === '/login') return LOGIN_META;
  return APP_META;
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Rewrites the head of the built index.html for one page. Used at build time only; every tag it
 * touches must exist in index.html, or the build fails instead of shipping a stale card.
 */
export function applyMetaToHtml(html: string, meta: PageMeta, path: string): string {
  const url = SITE_URL + (meta.canonicalPath ?? path);
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const swaps: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`],
    [/(<meta name="robots" content=")[^"]*(")/, `$1${meta.noindex ? 'noindex, follow' : 'index, follow'}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`],
    [/(<meta name="twitter:url" content=")[^"]*(")/, `$1${url}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`],
    [
      /<link rel="canonical" href="[^"]*" \/>\n?/,
      meta.canonicalPath ? `<link rel="canonical" href="${url}" />\n` : '',
    ],
  ];
  return swaps.reduce((out, [pattern, replacement]) => {
    if (!pattern.test(out)) throw new Error(`static page meta: ${pattern} not found in index.html`);
    return out.replace(pattern, replacement);
  }, html);
}
