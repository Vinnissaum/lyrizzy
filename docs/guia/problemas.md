# Solução de problemas

Os problemas mais comuns e como resolver. Use a busca (no alto da página) para achar uma mensagem específica.

## Telas

### O telão abriu na tela errada

Abra **Configurações → Geral** e, em **Monitor da apresentação**, escolha o monitor certo em vez de **— Automático —**. Com duas telas, ajuste o **Monitor da Tela 1** e o **Monitor da Tela 2**. Veja [Duas telas](./duas-telas).

### A igreja está vendo a minha janela de trabalho

As telas estão **duplicadas** no sistema. No Windows, aperte <kbd>Win</kbd> + <kbd>P</kbd> e escolha **Estender**.

### A TV não aparece na lista de telas

Confira se a TV está ligada, na entrada certa, e se o sistema a reconhece como tela estendida. Com **Configurações → Geral** aberto, espere alguns segundos ou clique em **Detectar novamente**.

### A apresentação abriu por cima da janela do operador

Só há uma tela ligada ao computador. Isso é normal para testar. No culto, ligue o projetor ou a TV e deixe as telas estendidas.

## Durante a apresentação

### Os menus de cima estão bloqueados

Durante a apresentação, **Início**, **Biblioteca**, **Mídia**, **Backup** e **Configurações** ficam bloqueados (**Indisponível durante a apresentação**). Clique em **Parar** para usá-los.

### O Esc não parou a apresentação

Se havia um aviso ou uma imagem no telão, o primeiro <kbd>Esc</kbd> só fecha esse aviso ou imagem. Aperte <kbd>Esc</kbd> de novo.

### As teclas não fazem nada

Os atalhos não funcionam enquanto o cursor está num campo de texto, como uma busca. Clique numa área vazia da janela e tente de novo. Confira também os atalhos em **Configurações → Atalhos**.

### O passador de slides não funciona

Ele provavelmente manda <kbd>Page Down</kbd> e <kbd>Page Up</kbd>. Adicione essas teclas aos atalhos. Veja [Passador de slides](./atalhos#passador-de-slides-controle-remoto).

### Mandei uma imagem, mas o telão continua preto

A tela preta está ligada, e ela esconde as imagens. Desligue a tela preta (<kbd>B</kbd>, <kbd>F10</kbd> ou o botão **Tela preta**).

### Não consigo remover um item do conjunto

O item que está no telão não pode ser removido (**No ar — não pode ser removido**). Passe para outro item e remova depois.

## Músicas

### Não acho uma música

A busca da **Biblioteca** procura no título, no artista e na letra. As listas rápidas (a lista **Músicas** do Início e a busca para incluir música durante o culto) procuram só no título e no artista. Se lembrar só de um trecho da letra, procure na Biblioteca.

### Uma estrofe virou dois slides

Estrofes com mais de 4 linhas são divididas em slides de até 4 linhas. Para controlar a divisão, coloque uma linha em branco onde quer que o slide quebre. Veja [Como a letra vira slides](./biblioteca#como-a-letra-vira-slides).

### A letra está cortada nas bordas do telão

Aumente a **Margem** ou diminua o **Tamanho do texto das músicas** em **Configurações → Projeção**. As mudanças aparecem na hora no telão.

## Vídeo, apresentações e câmera

### O vídeo não aparece ou fica preto

- **No Windows:** confira se o vídeo é **MP4 (H.264)** ou **WebM**. Vídeos em outros formatos, mesmo com a extensão `.mp4`, podem não tocar. Converta com o [HandBrake](https://handbrake.fr/).
- **No Linux:** instale os pacotes do [GStreamer](./programas-auxiliares#gstreamer-so-no-linux) ou use vídeos WebM.
- Se aparecer **Não foi possível reproduzir o vídeo** na barra Vídeo, o arquivo pode estar danificado. Teste-o em outro programa.

### O vídeo foi recusado na importação

O Lyrizzy aceita só **MP4** e **WebM**. Arquivos **MKV**, **AVI** e **MOV** precisam ser convertidos antes, por exemplo com o [HandBrake](https://handbrake.fr/). Veja [Mídia](./midia#formatos-aceitos).

### O vídeo não tem miniatura

Falta o **FFmpeg**. O vídeo toca normalmente mesmo assim. Veja [Programas auxiliares](./programas-auxiliares#ffmpeg).

### Não consigo importar PowerPoint ou PDF

Se aparece **LibreOffice não encontrado**, instale o [LibreOffice](./programas-auxiliares#libreoffice) e abra o Lyrizzy de novo. Se aparece **Não foi possível converter a apresentação**, abra o arquivo no PowerPoint ou no LibreOffice, salve uma cópia (ou exporte em PDF) e importe essa cópia.

### A câmera não aparece

- Confira a **URL** no item da câmera e se o computador está na mesma rede da câmera.
- No modo **RTSP**, o [MediaMTX](./programas-auxiliares#mediamtx) precisa estar instalado. Teste também o **Transporte TCP**.
- No modo **Página web**, um endereço `http://` pode ser bloqueado. Use `https://` se a câmera oferecer.

Veja [Câmera e áudio](./camera).

### A imagem da câmera trava ou atrasa

Se a imagem trava, aumente o **Buffer alvo (ms)** em **Configurações → Geral → Câmera** (comece com 50 a 150). Se a rede estiver sobrecarregada, use um perfil com o fluxo reduzido da câmera. Veja [Perfis de transmissão](./camera#perfis-de-transmissao).

## Cronômetro

### O cronômetro agendado não começou

Confira se:

- o horário era mais tarde **no mesmo dia** e o relógio do computador está certo;
- o Lyrizzy estava aberto no horário;
- depois de reabrir o app, o conjunto com o cronômetro continuava escolhido na tela **Início**.

Veja [Agendar para começar sozinho](./cronometro#agendar-para-comecar-sozinho).

### Não consigo tirar um minuto do cronômetro

O **−1 min** não funciona quando falta 1 minuto ou menos.

## Backup

### Apareceu "Restauração interrompida"

Uma restauração anterior não terminou. Siga os passos em [Se a restauração for interrompida](./backup#se-a-restauracao-for-interrompida).

## Não encontrou a resposta?

Relate o problema na [página de problemas do projeto no GitHub](https://github.com/Vinnissaum/lyrizzy/issues). Conte o que você fez, o que esperava e o que aconteceu, e mande, se puder, uma foto da tela e a versão do app (em **Configurações → Sobre**).
