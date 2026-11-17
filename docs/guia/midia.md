# Mídia e apresentações

A tela **Mídia** guarda as imagens e os vídeos do app: fundos de música, vinhetas, cartazes de avisos e vídeos de abertura. Tudo o que entra aqui fica disponível para o conjunto, para o fundo das músicas e para o botão **Imagem** da apresentação.

![Tela Mídia com miniaturas e o painel de detalhes](/telas/midia.webp)

## Adicionar arquivos

Abra **Mídia** e:

- clique em **Adicionar mídia** e escolha os arquivos, **ou**
- arraste os arquivos do computador para a área **Arraste arquivos ou clique para selecionar**.

Dá para mandar vários arquivos de uma vez. O app mostra o andamento e, no fim, quantos arquivos foram importados e quantos foram ignorados.

O Lyrizzy guarda uma cópia de cada arquivo. Depois de importar, você pode mover ou apagar o original sem problema.

## Formatos aceitos

| Tipo | Formatos |
| --- | --- |
| Imagem | PNG, JPG/JPEG, WebP, GIF |
| Vídeo | MP4 (H.264) e WebM |

Outros formatos de vídeo, como **MKV**, **AVI** e **MOV**, são recusados com a mensagem **Tipo de arquivo não suportado**. Converta o vídeo para MP4 antes, por exemplo com o programa gratuito [HandBrake](https://handbrake.fr/).

::: tip Vídeos leves rodam melhor
Para fundos e vinhetas, prefira vídeos em Full HD (1920×1080) em vez de 4K. O computador do culto agradece.
:::

## Encontrar, renomear e excluir

- Use **Todos**, **Imagens** e **Vídeos** para filtrar, e **Pesquisar mídia…** para buscar pelo nome.
- Clique em um item para abrir os **Detalhes**: nome, tipo, dimensões, duração (vídeos) e tamanho.
- Para renomear, mude o **Nome** nos detalhes.
- Para apagar, clique em **Excluir** nos detalhes e confirme.

Se o arquivo estiver em uso por alguma música ou conjunto, o app não deixa excluir e mostra onde ele é usado (**Mídia em uso**). Tire o arquivo desses lugares antes de excluir.

## Miniaturas dos vídeos

As miniaturas e a duração dos vídeos são geradas pelo **FFmpeg**. Sem ele, o vídeo entra e toca normalmente, mas fica sem miniatura, e a tela Mídia mostra o aviso **ffmpeg não encontrado**. Veja [Programas auxiliares](./programas-auxiliares#ffmpeg).

## Onde usar as mídias

| Onde | Como |
| --- | --- |
| No conjunto | Botão **Mídia** no conjunto. Veja [Montar o conjunto](./conjuntos#adicionar-itens). |
| Atrás da letra de uma música | Campo **Fundo** no editor da música. Veja [Biblioteca](./biblioteca#outras-opcoes-da-musica). |
| Atrás do cronômetro | Opção **Fundo (vídeo)**. Veja [Cronômetro](./cronometro#opcoes). |
| Na hora, durante o culto | Botão **Imagem**. Veja [Aviso, imagem e tela preta](./aviso-imagem-tela-preta#imagem). |

## PowerPoint e PDF

Arquivos de PowerPoint (**PPTX**, **PPSX**, **PPT**, **PPS**), **ODP** e **PDF** não entram pela tela Mídia. Eles entram pelo botão **Apresentação**:

- no conjunto, antes do culto (veja [Montar o conjunto](./conjuntos#adicionar-itens));
- na barra de cima, durante o culto (veja [Apresentação de última hora](./aviso-imagem-tela-preta#apresentacao-de-ultima-hora)).

O Lyrizzy transforma cada página do arquivo em um slide de imagem. No telão, você passa as páginas como passa as estrofes de uma música.

Depois de importada, a apresentação fica guardada na Mídia, no filtro **Todos**. Para usá-la em outro conjunto, adicione-a pelo botão **Mídia** do conjunto.

::: warning Precisa do LibreOffice
A conversão é feita pelo LibreOffice. Sem ele, aparece o aviso **LibreOffice não encontrado**. Veja [Programas auxiliares](./programas-auxiliares#libreoffice).
:::

::: info Animações e vídeos dentro do PowerPoint
Como cada página vira uma imagem, as animações, as transições e os vídeos que estão dentro do PowerPoint não aparecem. Para mostrar um vídeo, adicione o arquivo de vídeo pela Mídia.
:::
