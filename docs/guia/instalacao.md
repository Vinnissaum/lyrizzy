# Instalar e atualizar

O Lyrizzy é instalado no computador que fica ligado ao projetor ou à TV. Ele funciona no **Windows 10 ou 11** e no **Linux**.

## Baixar

Abra a página de [downloads do Lyrizzy](https://github.com/Vinnissaum/lyrizzy/releases/latest) e, na lista **Assets** da versão mais recente, baixe o arquivo do seu sistema:

| Sistema | Arquivo |
| --- | --- |
| Windows | o que termina em **`-setup.exe`** |
| Linux (Ubuntu, Debian e derivados) | o que termina em **`.deb`** |
| Linux (qualquer distribuição) | o que termina em **`.AppImage`** |

::: tip Ignore os arquivos `.sig` e `latest.json`
Eles são usados pela atualização automática. Você não precisa baixá-los.
:::

## Instalar no Windows

1. Dê dois cliques no arquivo `-setup.exe` que você baixou.
2. Siga o instalador. Se faltar algum componente do Windows de que o app precisa (o WebView2), o próprio instalador cuida disso.
3. Abra o **Lyrizzy** pelo menu Iniciar.

::: warning Aviso azul do Windows
Se aparecer a mensagem "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo**. Esse aviso é comum em programas baixados da internet que ainda não são conhecidos pelo Windows.
:::

## Instalar no Linux

Com o arquivo `.deb` (Ubuntu, Debian e derivados), abra um terminal na pasta do download e rode:

```bash
sudo apt install ./nome-do-arquivo.deb
```

Com o arquivo `.AppImage`, dê permissão de execução e abra:

```bash
chmod +x nome-do-arquivo.AppImage
./nome-do-arquivo.AppImage
```

No Linux, alguns recursos precisam de pacotes extras, como os de vídeo. Veja a lista em [Programas auxiliares](./programas-auxiliares).

## Atualizar

O Lyrizzy procura uma versão nova sempre que é aberto. Quando existe uma, aparece uma faixa no topo da janela: **Nova versão disponível**.

1. Clique em **Atualizar**.
2. Leia o que mudou e clique em **Baixar e instalar**. Se preferir deixar para depois, clique em **Mais tarde**.
3. O app baixa a versão nova, instala e **reinicia sozinho**.

Para procurar uma versão nova a qualquer momento, vá em **Configurações → Sobre** e clique em **Verificar atualizações**.

::: danger Não atualize durante o culto
A atualização fecha e reabre o Lyrizzy, e o telão fica sem nada até o app voltar. Atualize antes ou depois do culto.
:::

Suas músicas, conjuntos, mídias e configurações continuam no lugar depois de atualizar.

## Onde ficam os seus dados

Tudo o que você cadastra fica guardado no próprio computador, nesta pasta:

| Sistema | Pasta |
| --- | --- |
| Windows | `%APPDATA%\com.igreja-trindade.trinity-lyrics\` |
| Linux | `~/.local/share/com.igreja-trindade.trinity-lyrics/` |

Para não perder nada se o computador der problema, faça cópias pela tela **Backup**. Veja [Backup e compartilhamento](./backup).

## Próximo passo

Com o app instalado, siga os [Primeiros passos](./primeiros-passos).
