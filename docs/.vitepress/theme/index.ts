import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

/**
 * Amplia as capturas de tela: um clique na imagem abre em tela cheia; clique
 * de novo ou Esc para fechar. Delegação no documento, então funciona em toda
 * página sem depender da navegação.
 */
function installLightbox() {
  let overlay: HTMLDivElement | null = null

  const close = () => {
    overlay?.remove()
    overlay = null
  }

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (overlay) {
      close()
      return
    }
    if (!(target instanceof HTMLImageElement)) return
    if (!target.closest('.vp-doc') || target.closest('a')) return

    overlay = document.createElement('div')
    overlay.className = 'lyrizzy-lightbox'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-label', target.alt || 'Imagem ampliada')
    const image = document.createElement('img')
    image.src = target.currentSrc || target.src
    image.alt = target.alt
    overlay.appendChild(image)
    document.body.appendChild(overlay)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  })
}

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (typeof window !== 'undefined') installLightbox()
  },
} satisfies Theme
