import { defineConfig } from 'vitepress'

const repo = 'https://github.com/Vinnissaum/lyrizzy'

export default defineConfig({
  lang: 'pt-BR',
  title: 'Lyrizzy',
  titleTemplate: ':title · Lyrizzy',
  description:
    'Guia do usuário do Lyrizzy: letras, mídia, avisos, cronômetro e câmera no telão da igreja.',

  // Publicado em https://vinnissaum.github.io/lyrizzy/
  base: '/lyrizzy/',
  cleanUrls: true,
  lastUpdated: true,

  // Os documentos técnicos (em inglês) ficam nesta pasta, mas fora do site.
  srcExclude: ['TDD-v2.md', 'installation.md', 'linux-compat.md', 'release.md'],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/lyrizzy/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#0a7bbc' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'pt_BR' }],
    ['meta', { property: 'og:site_name', content: 'Lyrizzy' }],
    ['meta', { property: 'og:image', content: 'https://vinnissaum.github.io/lyrizzy/telas/telao-letra.webp' }],
  ],

  markdown: {
    container: {
      tipLabel: 'Dica',
      infoLabel: 'Saiba mais',
      warningLabel: 'Atenção',
      dangerLabel: 'Cuidado',
      detailsLabel: 'Detalhes',
    },
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guia', link: '/guia/primeiros-passos', activeMatch: '/guia/' },
      { text: 'Baixar', link: `${repo}/releases/latest` },
    ],

    sidebar: [
      {
        text: 'Começando',
        items: [
          { text: 'Instalar e atualizar', link: '/guia/instalacao' },
          { text: 'Primeiros passos', link: '/guia/primeiros-passos' },
        ],
      },
      {
        text: 'No culto',
        items: [
          { text: 'Biblioteca de músicas', link: '/guia/biblioteca' },
          { text: 'Importar do Holyrics', link: '/guia/importar-holyrics' },
          { text: 'Montar o conjunto', link: '/guia/conjuntos' },
          { text: 'Apresentar ao vivo', link: '/guia/apresentar' },
          { text: 'Aviso, imagem e tela preta', link: '/guia/aviso-imagem-tela-preta' },
          { text: 'Cronômetro', link: '/guia/cronometro' },
          { text: 'Mídia e apresentações', link: '/guia/midia' },
        ],
      },
      {
        text: 'Telas e câmera',
        items: [
          { text: 'Duas telas', link: '/guia/duas-telas' },
          { text: 'Câmera e áudio', link: '/guia/camera' },
        ],
      },
      {
        text: 'Ajustes e cuidados',
        items: [
          { text: 'Configurações', link: '/guia/configuracoes' },
          { text: 'Atalhos de teclado', link: '/guia/atalhos' },
          { text: 'Backup e compartilhamento', link: '/guia/backup' },
          { text: 'Programas auxiliares', link: '/guia/programas-auxiliares' },
        ],
      },
      {
        text: 'Ajuda',
        items: [{ text: 'Solução de problemas', link: '/guia/problemas' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: repo, ariaLabel: 'Lyrizzy no GitHub' }],

    editLink: {
      pattern: `${repo}/edit/main/docs/:path`,
      text: 'Sugerir uma correção nesta página',
    },

    footer: {
      message: 'O Lyrizzy é open source. Dúvidas e sugestões são bem-vindas no GitHub.',
    },

    outline: { level: [2, 3], label: 'Nesta página' },
    lastUpdated: { text: 'Atualizado em', formatOptions: { dateStyle: 'short' } },
    docFooter: { prev: 'Anterior', next: 'Próxima' },
    returnToTopLabel: 'Voltar ao topo',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Aparência',
    lightModeSwitchTitle: 'Mudar para o tema claro',
    darkModeSwitchTitle: 'Mudar para o tema escuro',
    skipToContentLabel: 'Pular para o conteúdo',
    externalLinkIcon: true,
    notFound: {
      code: '404',
      title: 'PÁGINA NÃO ENCONTRADA',
      quote: 'Este endereço não existe ou mudou de lugar.',
      linkLabel: 'Voltar ao início',
      linkText: 'Voltar ao início',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar no guia' },
          modal: {
            displayDetails: 'Mostrar detalhes',
            resetButtonTitle: 'Limpar a busca',
            backButtonTitle: 'Fechar a busca',
            noResultsText: 'Nenhum resultado para',
            footer: {
              selectText: 'abrir',
              selectKeyAriaLabel: 'enter',
              navigateText: 'navegar',
              navigateUpKeyAriaLabel: 'seta para cima',
              navigateDownKeyAriaLabel: 'seta para baixo',
              closeText: 'fechar',
              closeKeyAriaLabel: 'esc',
            },
          },
        },
        miniSearch: {
          options: {
            // Busca sem acento e sem ç, como a busca de músicas do app:
            // "cancao" encontra "canção" e "cronometro" encontra "Cronômetro".
            processTerm: (term: string) =>
              term
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase(),
          },
        },
      },
    },
  },
})
