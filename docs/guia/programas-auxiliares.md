# Programas auxiliares

Alguns recursos do Lyrizzy usam programas gratuitos que ficam fora do app. Instale **só os dos recursos que você usa**. Se faltar algum, o recurso ligado a ele fica indisponível e o app mostra um aviso, mas todo o resto continua funcionando.

| Programa | Para quê | Precisa? |
| --- | --- | --- |
| [LibreOffice](#libreoffice) | Importar PowerPoint e PDF | Só se você usa apresentações |
| [FFmpeg](#ffmpeg) | Miniatura e duração dos vídeos | Recomendado se você usa vídeos |
| [MediaMTX](#mediamtx) | Câmera no modo RTSP | Só para câmeras RTSP |
| [GStreamer](#gstreamer-so-no-linux) | Tocar vídeo MP4 no Linux | Só no Linux |

Depois de instalar um desses programas, **feche e abra o Lyrizzy** de novo.

::: info Como o Lyrizzy encontra os programas
Ele procura nesta ordem: uma cópia que venha junto com o instalador do Lyrizzy, uma [variável de ambiente](#variaveis-de-ambiente) e, por fim, os lugares onde esses programas costumam ser instalados. Na maioria dos casos, **instalar do jeito normal já basta**.
:::

## LibreOffice

Converte PowerPoint (**PPTX**, **PPSX**, **PPT**, **PPS**), **ODP** e **PDF** em slides de imagem. Sem ele, aparece o aviso **LibreOffice não encontrado** e não dá para importar apresentações.

- **Windows:** baixe e instale pelo site [pt-br.libreoffice.org](https://pt-br.libreoffice.org/). A instalação padrão é encontrada sozinha.
- **Ubuntu / Debian:** `sudo apt install libreoffice`
- **Outro Linux:** instale pelo gerenciador de pacotes da sua distribuição.

Instalou numa pasta diferente da padrão? Crie a variável `SOFFICE_PATH` apontando para o arquivo `soffice.exe` (no Linux, `soffice`).

## FFmpeg

Gera a miniatura dos vídeos e lê a duração e o tamanho deles. Sem ele, os vídeos são importados e tocam normalmente, mas ficam sem miniatura, e a tela Mídia mostra **ffmpeg não encontrado**.

**No Windows**, o jeito mais simples:

1. Entre em [ffmpeg.org/download](https://ffmpeg.org/download.html), clique no ícone do Windows e baixe uma versão pronta ("build"), em arquivo `.zip`.
2. Extraia o arquivo e renomeie a pasta extraída para `ffmpeg`.
3. Mova essa pasta para `C:\`, de modo que exista o arquivo `C:\ffmpeg\bin\ffmpeg.exe`.

O Lyrizzy procura o FFmpeg em `C:\ffmpeg\bin` e em `C:\Program Files\ffmpeg\bin`, então não é preciso mexer no PATH.

**No Ubuntu / Debian:** `sudo apt install ffmpeg`

Se o FFmpeg estiver em outra pasta, use as variáveis `FFMPEG_PATH` e `FFPROBE_PATH`, apontando para o arquivo ou para a pasta dele.

## MediaMTX

Converte a imagem das câmeras **RTSP** para um formato que o telão consegue tocar. Ele liga e desliga sozinho, em segundo plano. Os modos de câmera **Página web** e **MJPEG** não precisam dele.

1. Baixe a versão do seu sistema na [página de versões do MediaMTX](https://github.com/bluenviron/mediamtx/releases) (no Windows, o arquivo `windows_amd64.zip`).
2. Extraia o arquivo `mediamtx.exe` (no Linux, `mediamtx`) para uma pasta fixa, como `C:\mediamtx`.
3. Crie a variável `MEDIAMTX_PATH` apontando para o arquivo ou para a pasta. Também funciona colocar a pasta no PATH.

Sem o MediaMTX, a câmera RTSP mostra **MediaMTX não encontrado. Instale-o e defina MEDIAMTX_PATH ou adicione-o ao PATH.**

## GStreamer (só no Linux)

No Linux, o telão toca vídeos pelo GStreamer. Para os vídeos MP4 (H.264) funcionarem, instale:

```bash
sudo apt install -y gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
```

Sem esses pacotes, o vídeo MP4 aparece como um quadro preto, sem mensagem de erro. No Linux, os vídeos **WebM** são os mais garantidos. No Windows nada disso é necessário.

## Variáveis de ambiente

Só são necessárias quando um programa está numa pasta fora do padrão.

**No Windows:**

1. No menu Iniciar, procure **Editar as variáveis de ambiente do sistema** e abra.
2. Clique em **Variáveis de Ambiente…**.
3. Em **Variáveis do usuário**, clique em **Novo…**.
4. Informe o nome (por exemplo, `MEDIAMTX_PATH`) e o valor (por exemplo, `C:\mediamtx\mediamtx.exe`) e confirme.
5. Feche e abra o Lyrizzy.

**No Linux:** acrescente a linha no arquivo `~/.profile`, por exemplo `export SOFFICE_PATH=/opt/libreoffice/program/soffice`, e entre de novo na sessão.
