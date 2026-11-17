# Câmera e áudio

O Lyrizzy mostra no telão a imagem ao vivo de uma câmera de rede (IP) ou qualquer página da internet. Com duas telas, ele também leva o som do microfone e da câmera para a TV certa. Uma montagem comum é **letra na Tela 1** e **câmera na Tela 2**.

## Colocar a câmera no conjunto

1. Em **Início**, clique em **Câmera**. O item entra no fim do conjunto.
2. Clique no item para abrir as opções.
3. Escolha o **Modo** e preencha a **URL** (o endereço da câmera).

O item mostra uma prévia enquanto você configura. Na apresentação, a câmera aparece quando você chega nesse item, como qualquer outro.

![Opções de um item de câmera no modo RTSP, com perfis de transmissão](/telas/camera-editor.webp)

## Qual modo escolher

| Modo | Use quando… | Exemplo de URL |
| --- | --- | --- |
| **Página web (URL)** | A câmera tem uma página que mostra o vídeo, ou você quer mostrar um site. | `https://exemplo.com` |
| **MJPEG** | A câmera fornece um fluxo MJPEG (comum em câmeras IP mais simples). | `http://192.168.1.10/stream` |
| **RTSP** | A câmera fornece um fluxo RTSP (o mais comum em câmeras IP). | `rtsp://192.168.15.50/1` |

O endereço exato fica no manual ou na página de configuração da câmera.

::: warning RTSP precisa do MediaMTX
O telão não toca RTSP diretamente. O Lyrizzy usa o programa **MediaMTX**, em segundo plano, para converter a imagem. Instale-o antes. Veja [Programas auxiliares](./programas-auxiliares#mediamtx). Os modos **Página web** e **MJPEG** não precisam de nada extra.
:::

## Opções de cada modo

### Página web (URL)

- **Autenticação básica (opcional):** se a página pede usuário e senha, preencha **Usuário** e **Senha**.
- **Recorte / zoom:** amplia e desloca a página para enquadrar só uma parte dela, como o vídeo da câmera, sem os menus. Use **Zoom**, **Deslocamento horizontal** e **Deslocamento vertical**, olhando a prévia. **Redefinir** desfaz o recorte.

O recorte é só visual: a página inteira continua carregando por trás.

Endereços que começam com `http://`, sem o "s", podem ser bloqueados. O app avisa quando isso pode acontecer. Prefira `https://` quando existir.

### MJPEG

Também aceita **Autenticação básica (opcional)**, com **Usuário** e **Senha**.

### RTSP

Em **Transporte**, escolha como a imagem viaja pela rede: **UDP**, **TCP** ou **Automático**. Comece com UDP (é o mesmo que a opção `rtsp_transport=udp` do OBS). Se a imagem falhar ou travar, teste **TCP**.

::: info Modos antigos
Itens criados em versões antigas com RTMP, SRT ou Multicast mostram **Este modo não é mais suportado**. Abra o item e escolha RTSP, MJPEG ou Página web.
:::

## Perfis de transmissão

Muitas câmeras oferecem mais de um fluxo: um principal, com resolução alta, e um reduzido, mais leve. Nos modos **RTSP** e **MJPEG**, você pode salvar cada um como um perfil:

1. Em **Perfis de transmissão**, clique em **Adicionar perfil**.
2. Dê um **Nome** (por exemplo, "Principal (4K)" ou "Reduzido (1080p)") e informe a **URL**.

Com dois perfis ou mais, aparece o seletor **Perfil** durante a apresentação, para trocar o fluxo sem parar nada.

::: tip Câmera compartilhada com o OBS
O perfil só muda o que **o Lyrizzy** recebe. Se a mesma câmera também manda imagem para o OBS ou para o YouTube, eles continuam recebendo o fluxo de sempre. Um perfil mais leve no Lyrizzy alivia a rede sem afetar a transmissão.
:::

## Atraso da imagem

Em **Configurações → Geral → Câmera**, o **Buffer alvo (ms)** controla quanto a imagem espera antes de aparecer:

- **0** deixa a imagem o mais perto possível do tempo real.
- Se a imagem de uma câmera instável travar, aumente aos poucos (por exemplo, para 50 a 150).

A mudança vale na hora, com a câmera no ar.

## Som do microfone e da câmera

Com a [segunda tela](./duas-telas) ligada, aparece em **Configurações → Projeção** a parte de **Áudio da câmera e microfone por tela**. Ela serve, por exemplo, para tocar o microfone do púlpito e o som da câmera na TV que mostra a câmera.

Clique primeiro em **Permitir microfone**. Sem essa permissão, os nomes dos aparelhos não aparecem nas listas. Depois, ajuste cada tela:

| Opção | O que faz |
| --- | --- |
| **Tocar microfone nesta tela** | Manda o som do microfone do computador para a saída desta tela. |
| **Áudio da câmera** | Liga o som da própria câmera nesta tela (as câmeras começam sem som). |
| **Atraso do microfone (ms)** | Atrasa o microfone para combinar com a imagem da câmera, que costuma chegar um pouco atrasada. Aumente até a voz bater com o movimento da boca. |
| **Microfone (entrada)** | Qual microfone usar. |
| **Saída de áudio (TV/HDMI)** | Por onde o som sai, normalmente a saída HDMI da TV. |

Se o sistema não permitir escolher a saída de áudio, o app avisa e usa a saída padrão.

::: tip Montagem típica: câmera na TV lateral
Na **Tela 2**, ligue **Tocar microfone nesta tela**, escolha a TV em **Saída de áudio**, ligue **Áudio da câmera** se a câmera tiver som e aumente o **Atraso do microfone** até a voz combinar com a imagem.
:::

### Silenciar o microfone durante o culto

Com o microfone ligado em uma tela, a apresentação mostra uma faixa **Microfone** para aquela tela. Ali dá para deixar o microfone **mudo** e voltar a ligar com um clique, sem mexer nas configurações, e também ajustar o **Atraso**.
