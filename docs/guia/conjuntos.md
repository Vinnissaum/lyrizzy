# Montar o conjunto

O **conjunto** é a ordem do culto: tudo o que vai aparecer no telão, na sequência certa. Você monta o conjunto na tela **Início** e, na hora do culto, clica em **Apresentar**.

Tudo o que você muda no conjunto é salvo na hora. Não existe botão de salvar.

![Conjunto com músicas, cronômetro, vídeo e câmera, e as opções do vídeo abertas](/telas/conjunto-itens.webp)

## Escolher, criar e renomear conjuntos

No alto da tela **Início** fica o conjunto em uso. Clique nele para trocar por outro.

Para criar, renomear ou excluir conjuntos, clique na **engrenagem** ao lado. Abre a janela **Gerenciar conjuntos**:

- **Novo conjunto:** digite o nome e confirme.
- **Renomear:** muda o nome do conjunto.
- **Excluir conjunto:** apaga o conjunto, depois de pedir confirmação.

![Janela Gerenciar conjuntos](/telas/gerenciar-conjuntos.webp)

Para renomear o conjunto em uso, também dá para clicar no nome dele, logo acima dos itens.

::: info Sempre existe um conjunto
A biblioteca mantém pelo menos um conjunto, então o último não pode ser excluído. Se um conjunto já foi apresentado, excluí-lo também apaga os registros dessas apresentações, usados no [relatório CCLI](./configuracoes#relatorios). O app avisa antes.
:::

::: tip Um conjunto por culto ou um só?
Tanto faz. Algumas igrejas criam um conjunto para cada culto ("Culto de domingo 17/11"), outras usam sempre o mesmo e trocam os itens toda semana.
:::

## Adicionar itens

Use os botões na parte de baixo do conjunto:

| Botão | O que adiciona |
| --- | --- |
| **Música** | Uma música da biblioteca. Abre uma busca: digite e clique na música. |
| **Mídia** | Uma imagem, um vídeo ou uma apresentação que já está na [Mídia](./midia). Abre a janela **Adicionar mídia ao conjunto**, com as miniaturas grandes: filtre por **Todos**, **Imagens** ou **Vídeos** e clique no item. A lixeira de cada miniatura exclui o arquivo da biblioteca, depois de confirmar; um arquivo usado por uma música ou um conjunto não é excluído, e o app avisa **Mídia em uso**. |
| **Contagem** | Um [cronômetro](./cronometro) de contagem regressiva, que já vem com 10 minutos. |
| **Câmera** | Uma [câmera ou página da internet](./camera). |
| **Tela preta** | Um momento com o telão todo preto. |
| **Apresentação** | Um arquivo de PowerPoint (PPTX, PPSX, PPT, PPS), ODP ou PDF. Cada página vira um slide. Precisa do [LibreOffice](./programas-auxiliares#libreoffice). |

O jeito mais rápido de colocar músicas é pela lista **Músicas**, à direita: clique na música ou arraste-a para o conjunto. A busca dessa lista procura no título e no artista, sem ligar para acentos.

Cada item novo entra no fim do conjunto. Depois é só mudar a ordem.

## Mudar a ordem e mexer nos itens

Passe o mouse sobre um item para ver os botões dele:

| Botão | O que faz |
| --- | --- |
| Lápis (**Editar música**) | Abre a música no editor da Biblioteca. |
| **Duplicar** | Cria uma cópia do item logo abaixo. |
| **Mover para cima** / **Mover para baixo** | Muda o item de lugar. |
| **Remover** | Tira o item do conjunto. A música ou a mídia continua na biblioteca. |

Também dá para **arrastar** o item pela alça (os pontinhos à esquerda) até o lugar certo.

O número à esquerda de cada item é a posição dele. Durante a apresentação, as teclas <kbd>1</kbd> a <kbd>9</kbd> pulam direto para os nove primeiros itens.

## Opções de cada tipo de item

Alguns itens têm opções. Clique no item (ou na setinha à direita) para abrir:

- **Vídeo:** **Repetir (loop)**, **Silenciar** e **Avançar ao terminar**, que passa para o próximo item quando o vídeo acaba. A última opção some quando o vídeo está em loop.
- **Imagem:** não tem opções. Ela fica no telão até você avançar.
- **Contagem:** use o botão **Configurar / Agendar**, sempre visível. Quando o cronômetro está agendado, o horário aparece ao lado (por exemplo, ⏰ 18:55). Veja [Cronômetro](./cronometro).
- **Câmera:** o endereço e o modo de conexão. Veja [Câmera e áudio](./camera).
- **Tela preta:** um campo de **Notas**.
- **Apresentação:** mostra quantos slides foram gerados.

Os campos de **Notas** servem de lembrete para quem opera e não aparecem no telão.

::: warning ⚠ Referência inválida
Se uma música ou mídia do conjunto foi apagada da biblioteca, o item mostra **⚠ Referência inválida**. Remova-o ou troque por outro.
:::

## Enviar o conjunto para outro computador

Clique no ícone de **compartilhar**, ao lado do nome do conjunto (**Exportar conjunto…**), e escolha onde salvar. O arquivo `.tlz` leva o conjunto com as músicas e as mídias que ele usa. Veja [Backup e compartilhamento](./backup).

## Apresentar

Com o conjunto pronto, clique em **Apresentar**, no alto à direita. Se o conjunto estiver vazio, o app avisa: **Adicione itens ao conjunto antes de apresentar**.

Continue em [Apresentar ao vivo](./apresentar).
