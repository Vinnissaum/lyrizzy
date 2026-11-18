<p align="center"><img src="app-icon.svg" width="128" alt="Ícone do Lyrizzy: o Escudo da Trindade em vitral"></p>

# Lyrizzy

Aplicativo de projeção para igrejas: organize a biblioteca de músicas, monte o
conjunto do culto e controle um ou dois telões com letras, avisos, imagens,
vídeos, PowerPoint e PDF, cronômetro e câmera ao vivo. Feito com Tauri, React e
TypeScript, para Windows e Linux.

**[Guia do usuário](https://vinnissaum.github.io/lyrizzy/)** ·
**[Baixar a versão mais recente](https://github.com/Vinnissaum/lyrizzy/releases/latest)**

---

## Guia do usuário

Toda a documentação de uso, em português e com capturas de tela, está em
**<https://vinnissaum.github.io/lyrizzy/>**.

| Para… | Leia |
| --- | --- |
| Instalar o app e receber atualizações | [Instalar e atualizar](https://vinnissaum.github.io/lyrizzy/guia/instalacao) |
| Ligar as telas e conhecer o app | [Primeiros passos](https://vinnissaum.github.io/lyrizzy/guia/primeiros-passos) |
| Cadastrar e importar músicas | [Biblioteca de músicas](https://vinnissaum.github.io/lyrizzy/guia/biblioteca) · [Importar do Holyrics](https://vinnissaum.github.io/lyrizzy/guia/importar-holyrics) |
| Montar e apresentar o culto | [Montar o conjunto](https://vinnissaum.github.io/lyrizzy/guia/conjuntos) · [Apresentar ao vivo](https://vinnissaum.github.io/lyrizzy/guia/apresentar) |
| Usar dois telões e câmera | [Duas telas](https://vinnissaum.github.io/lyrizzy/guia/duas-telas) · [Câmera e áudio](https://vinnissaum.github.io/lyrizzy/guia/camera) |
| Resolver um problema | [Solução de problemas](https://vinnissaum.github.io/lyrizzy/guia/problemas) |

### Referência rápida

- **Dois telões?** Ligue **Segunda tela (multi-saída)** em *Configurações →
  Projeção* e escolha o monitor de cada tela em *Configurações → Geral*. Veja
  [Duas telas](https://vinnissaum.github.io/lyrizzy/guia/duas-telas).
- **Vai importar PowerPoint ou PDF?** Instale o **LibreOffice**. Veja
  [Programas auxiliares](https://vinnissaum.github.io/lyrizzy/guia/programas-auxiliares).
- **Câmera RTSP?** Instale o **MediaMTX**. Veja
  [Câmera e áudio](https://vinnissaum.github.io/lyrizzy/guia/camera).

---

## Para desenvolvedores

### Rodar o app

```bash
npm install
npm run tauri dev                                  # app em modo de desenvolvimento
npx vitest                                         # testes do frontend
cargo test --manifest-path src-tauri/Cargo.toml    # testes do Rust
npm run tauri build                                # instaladores
```

### Documentação técnica (em inglês)

- [`docs/installation.md`](docs/installation.md): gerar os instaladores e instalar no computador do culto
- [`docs/linux-compat.md`](docs/linux-compat.md): pré-requisitos de build e de execução no Linux, codecs
- [`docs/release.md`](docs/release.md): assinatura, GitHub Releases e atualização automática
- [`docs/TDD-v2.md`](docs/TDD-v2.md): arquitetura e design

### Site do guia do usuário

O guia é um site [VitePress](https://vitepress.dev/) na pasta `docs/`, com as
páginas em `docs/guia/`. Ele é publicado no GitHub Pages pelo workflow
[`.github/workflows/docs.yml`](.github/workflows/docs.yml) a cada push na `main`
que muda algo em `docs/`.

```bash
npm --prefix docs install   # uma vez
npm run docs:dev            # site local em http://localhost:5173/lyrizzy/
npm run docs:build          # gera o site em docs/.vitepress/dist
```

As capturas de tela (`docs/public/telas/`) saem da interface real do app,
montada com dados de exemplo em `scripts/docs-screenshots/`. Quando uma tela
mudar, gere as capturas de novo:

```bash
npm run docs:screenshots                   # todas
npm run docs:screenshots -- inicio midia   # só algumas
```

O script precisa de um Chromium: ele usa a variável `CHROME_PATH` ou o navegador
do Playwright (`npx playwright install chromium-headless-shell`).

### IDE recomendada

[VS Code](https://code.visualstudio.com/) com as extensões
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
e [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
