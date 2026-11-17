# Cronômetro

O cronômetro mostra uma contagem regressiva grande no telão, com uma mensagem como "O culto começa em…". Ele pode começar na hora em que você chega nele no conjunto ou **sozinho, num horário marcado**.

![Telão com a contagem regressiva e a mensagem](/telas/telao-cronometro.webp)

## Colocar um cronômetro no conjunto

1. Em **Início**, clique em **Contagem**. O item entra no fim do conjunto, com 10 minutos.
2. Clique em **Configurar / Agendar**, no próprio item.
3. Ajuste as opções e clique em **Salvar**.

Arraste o item para o lugar certo. Normalmente o cronômetro é o primeiro item do culto.

## Opções

![Janela Configurar cronômetro](/telas/cronometro-config.webp)

| Opção | Para que serve |
| --- | --- |
| **Nome** | Como o item aparece no conjunto. Ajuda quando há mais de um cronômetro. |
| **Duração** / **Horário fixo** | **Duração** conta um tempo, como `05:00` (use `mm:ss` ou `hh:mm:ss`). **Horário fixo** conta até uma hora do relógio, informada em **Terminar em**: com 19:00, por exemplo, o cronômetro sempre termina às 19:00, não importa quando começou. |
| **Mensagem** | O texto acima dos números, como "O culto começa em…". Deixe em branco para mostrar só os números. |
| **Tamanho da mensagem** / **Tamanho dos dígitos** | Aumenta ou diminui cada parte. **Redefinir para 100%** volta ao tamanho padrão. |
| **Ao terminar** | O que acontece quando chega a zero: **Manter 00:00**, **Tela preta** ou **Avançar conjunto** (vai para o próximo item). |
| **Fundo (vídeo)** | Um vídeo da [Mídia](./midia) que fica repetindo atrás da contagem. |
| **Posição na tela** | Onde a contagem fica: em um dos 9 pontos da grade (cantos, laterais ou centro). |
| **Agendar este cronômetro** | Faz a contagem começar sozinha no horário de **Disparar às**. Veja abaixo. |

## Usar durante a apresentação

Quando você chega no cronômetro do conjunto, a contagem **começa sozinha**. Na janela do operador aparece a barra **Cronômetro**:

| Botão | O que faz |
| --- | --- |
| **+1 min** / **+5 min** | Acrescenta tempo. |
| **−1 min** | Tira um minuto. Não funciona quando falta 1 minuto ou menos. |
| **Pausar** / **Retomar** | Para e continua a contagem. A tecla <kbd>P</kbd> faz o mesmo. |
| **Reiniciar** | Começa de novo do tempo configurado. |

Esses ajustes valem só para a contagem em andamento. O item do conjunto continua como estava.

Para mudar a configuração com a apresentação no ar, clique no **lápis** ao lado do cronômetro no painel **Conjunto**. Se ele estiver contando, a mudança vale na hora.

## Agendar para começar sozinho

Com o agendamento, você deixa o cronômetro pronto e ele começa no horário certo, mesmo que ninguém esteja no computador.

1. Em **Configurar / Agendar**, deixe o modo em **Duração**.
2. Ligue **Agendar este cronômetro**.
3. Em **Disparar às**, informe a hora de começar. Exemplo: culto às 19:00 com 5 minutos de contagem, disparo às 18:55.
4. Clique em **Salvar**.

Um quadrinho flutuante aparece no canto inferior direito do app, com o horário do disparo e quanto falta para ele. O quadrinho tem os botões **Editar** e **Cancelar** e pode ser arrastado para outro lugar.

![Quadrinho do cronômetro agendado](/telas/cronometro-widget.webp)

No horário marcado:

- **Se você ainda não estiver apresentando**, o Lyrizzy abre o telão sozinho, vai até o cronômetro e começa a contar.
- **Se já estiver apresentando**, a contagem aparece por cima do que estiver no telão, até de uma música. Quando chega a zero, o telão volta ao que mostrava antes.

Ao chegar a zero, vale a opção escolhida em **Ao terminar**.

::: warning Detalhes do agendamento
- O horário precisa ser **mais tarde hoje**. Um horário que já passou dá o aviso **Este horário já passou hoje**.
- O agendamento só existe no modo **Duração**. No **Horário fixo** ele fica desligado.
- Cada tela conta um cronômetro por vez. Enquanto um cronômetro está contando, o agendamento fica indisponível.
- O horário vem do relógio do computador. Confira se ele está certo.
:::

Se você fechar e abrir o Lyrizzy no mesmo dia, o agendamento volta sozinho, desde que o horário ainda não tenha passado e o conjunto do cronômetro continue escolhido na tela **Início**.

Para desistir do agendamento, clique em **Cancelar** no quadrinho flutuante. Para mudar o horário, clique em **Editar**.
