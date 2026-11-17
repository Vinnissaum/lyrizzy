# Configurações

Abra **Configurações** na faixa de cima. As opções ficam em abas: **Geral**, **Projeção**, **Aviso**, **Atalhos**, **Relatórios** e **Sobre**.

Tudo é salvo na hora, sem botão de salvar. As mudanças de aparência valem **imediatamente no telão**, então dá para ajustar o tamanho ou a posição da letra com ela no ar, antes do culto.

## Geral

![Aba Geral das Configurações](/telas/config-geral.webp)

| Opção | Para que serve |
| --- | --- |
| **Idioma** | **Português (Brasil)** ou **English**. Muda na hora. |
| **Tema** | A cor da janela do operador: **Claro**, **Escuro** ou **Preto**. O Preto ajuda numa cabine escura. O telão não muda. |
| **Monitor da apresentação** | Em qual tela o telão abre. **— Automático —** escolhe a tela estendida, nunca a tela principal. Ou escolha um monitor pelo nome e pela resolução. |
| **Detectar novamente** | Procura as telas de novo. O app também procura sozinho enquanto as Configurações estão abertas. |
| **Nomes dos monitores** | Um apelido para cada tela, como "Projetor" ou "TV do hall". Deixe em branco para usar o nome padrão. |
| **Buffer alvo (ms)** | Atraso da imagem das câmeras. Veja [Câmera e áudio](./camera#atraso-da-imagem). |

Com a [segunda tela](./duas-telas) ligada, aparecem dois seletores: **Monitor da Tela 1** e **Monitor da Tela 2**.

## Projeção

Aqui fica a aparência das **letras das músicas** no telão. Essas são as opções padrão de todas as músicas.

![Aba Projeção das Configurações](/telas/config-projecao.webp)

| Opção | Escolhas |
| --- | --- |
| **Tamanho do texto das músicas** | Pequeno, Médio, Grande, Enorme ou Gigante. |
| **Fonte** | Padrão, Serifada ou Monoespaçada. |
| **Espaçamento entre linhas** | Estreito, Normal, Relaxado ou Amplo. |
| **Nível de negrito** | Normal, Médio, Semi ou Forte. |
| **Tema (fundo padrão)** | **Fundo preto** (letra branca) ou **Fundo branco** (letra preta). Vale para as músicas sem fundo próprio. |
| **Posição na tela** | Onde a letra fica: um dos 9 pontos da grade, dos cantos ao centro. |
| **Margem** | O espaço livre em volta da letra: Nenhuma, Pequena, Média, Grande ou Máxima. Aumente se as bordas do projetor cortam o texto. |
| **Slide de título (título + autor)** | Começa cada música com um slide mostrando o título e o autor. |
| **Autor entre parênteses** | Mostra o autor entre parênteses nesse slide de título. |
| **Tela preta após cada música** | Coloca um slide preto no fim de cada música. |
| **Segunda tela (multi-saída)** | Liga a Tela 2. Veja [Duas telas](./duas-telas). |
| **Comportamento de início na segunda tela** | O que acontece ao clicar em Apresentar com duas telas. Só funciona com a segunda tela ligada. Veja [Ao clicar em Apresentar](./duas-telas#ao-clicar-em-apresentar). |

Com a segunda tela ligada, aparece também o **áudio por tela**. Veja [Som do microfone e da câmera](./camera#som-do-microfone-e-da-camera).

A prévia do editor de músicas segue estas opções. Para ver o resultado sem abrir o telão, abra uma música na [Biblioteca](./biblioteca).

## Aviso

Aparência dos **avisos** que você manda pelo botão **Aviso** durante a apresentação. As opções são parecidas com as da Projeção, mas separadas, para o aviso poder ter uma cara diferente da letra:

- **Fonte**, **Tamanho do texto do aviso**, **Espaçamento entre linhas** e **Nível de negrito**;
- **Tema (fundo padrão)**: fundo preto ou branco;
- **Posição na tela** e **Margem do aviso**.

Veja como mandar avisos em [Aviso, imagem e tela preta](./aviso-imagem-tela-preta#aviso).

## Atalhos

Mostra e muda as teclas que controlam a apresentação. Veja [Atalhos de teclado](./atalhos).

## Relatórios

O **Relatório CCLI** lista as músicas apresentadas em um período. As igrejas que têm licença CCLI usam essa lista para informar as músicas usadas.

![Aba Relatórios com o Relatório CCLI](/telas/config-relatorios.webp)

1. Escolha o período em **De** e **até**. O app já começa com os últimos 90 dias.
2. Confira a lista: **Data**, **Título**, **Autor**, **CCLI #** e **Direitos**.
3. Clique em **Exportar CSV** e escolha onde salvar. O arquivo abre no Excel, no LibreOffice Calc ou no Google Planilhas.

**Como as músicas são contadas:** quando um conjunto começa a ser apresentado, cada música dele conta **uma vez naquele dia**. Uma música incluída durante o culto também conta.

::: tip Deixe as músicas com os dados completos
O autor, o número CCLI e os direitos autorais vêm do campo **Direitos / Licença** de cada música. Veja [Biblioteca](./biblioteca#outras-opcoes-da-musica).
:::

::: warning O que apaga o histórico
Excluir um conjunto apaga os registros das apresentações dele. Restaurar um backup no modo **Substituir tudo** apaga o histórico inteiro. Se precisar do relatório, exporte o CSV antes.
:::

## Sobre

Mostra a versão instalada e o botão **Verificar atualizações**. Veja [Atualizar](./instalacao#atualizar).

O Lyrizzy é open source. O botão **Contribuir no GitHub** abre a página do projeto, onde você pode relatar problemas e sugerir melhorias.
