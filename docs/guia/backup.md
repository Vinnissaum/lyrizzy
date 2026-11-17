# Backup e compartilhamento

Os arquivos **`.tlz`** servem para duas coisas:

- **Backup:** uma cópia completa da biblioteca, para não perder nada se o computador der problema.
- **Compartilhar:** levar algumas músicas ou um conjunto para outro computador com Lyrizzy.

Tudo isso fica na tela **Backup**.

![Tela Backup com Exportar biblioteca e Importar biblioteca](/telas/backup.webp)

## Fazer um backup completo

1. Abra **Backup**.
2. Em **Exportar biblioteca**, clique em **Exportar biblioteca…**.
3. Escolha onde salvar o arquivo `.tlz`.

O arquivo leva as músicas, os conjuntos, os arquivos de mídia e as configurações. No fim, o app mostra **Exportado com sucesso** e quanto de cada coisa foi salvo.

::: tip Guarde o backup fora do computador
Salve o arquivo num pendrive ou numa pasta na nuvem (Google Drive, OneDrive). Um backup que fica só no mesmo computador se perde junto com ele. Como as mídias vão junto, o arquivo pode ficar grande.
:::

Bons momentos para fazer backup: depois de importar muitas músicas, antes de trocar de computador e uma vez por mês.

## Restaurar um backup completo

1. Abra **Backup**.
2. Em **Importar biblioteca**, clique em **Selecionar arquivo…** e escolha o `.tlz`.
3. Confira o **Conteúdo do arquivo**: a data em que foi exportado, a versão do app e quanto de cada coisa ele tem.
4. Escolha o **Modo de restauração**:
   - **Mesclar:** só adiciona o que ainda não existe. Nada que está no computador é apagado.
   - **Substituir tudo:** apaga a biblioteca atual e coloca a do arquivo no lugar. Para confirmar, digite **SUBSTITUIR**.
5. Clique em **Restaurar**.

Quando terminar, aparece **Restaurado com sucesso**. **Reinicie o app** para todas as telas mostrarem os dados novos.

::: danger Substituir tudo não tem volta
O modo **Substituir tudo** apaga as músicas, os conjuntos e as mídias atuais e também o histórico do [relatório CCLI](./configuracoes#relatorios). Se estiver em dúvida, faça antes um backup do que existe hoje.
:::

### Se a restauração for interrompida

Se o computador desligar ou o app fechar no meio de uma restauração, na próxima vez aparece **Restauração interrompida**. A biblioteca pode estar incompleta:

1. Clique em **Cancelar restauração** e depois em **Confirmar e limpar**. O app apaga os dados pela metade e volta ao estado de instalação nova.
2. Restaure de novo a partir do arquivo de backup.

## Enviar músicas ou um conjunto

Para mandar só uma parte da biblioteca para outro computador:

- **Algumas músicas:** na **Biblioteca**, clique em **Selecionar**, marque as músicas e clique em **Exportar selecionadas…**.
- **Um conjunto inteiro:** em **Início**, clique no ícone de **compartilhar** ao lado do nome do conjunto (**Exportar conjunto…**). O conjunto vai com todas as músicas e mídias que usa.

Mande o arquivo `.tlz` por pendrive, e-mail ou WhatsApp.

## Importar músicas ou um conjunto

No outro computador:

1. Abra **Backup** e, em **Importar biblioteca**, clique em **Selecionar arquivo…**.
2. Escolha o `.tlz`. O app percebe que são músicas ou um conjunto (e não um backup completo) e abre **Revisar importação**.
3. Confira a lista e decida o que fazer com cada conflito.
4. Clique em **Importar**.

![Janela Revisar importação com os conflitos e as escolhas](/telas/revisar-importacao.webp)

Quando algo do arquivo já existe no computador, aparece um aviso:

| Aviso | Significa |
| --- | --- |
| **Já existe** | É o mesmo item, que já está no computador. |
| **Possível duplicata** | Existe outro item com o mesmo título e artista. |

Para cada conflito, escolha:

| Escolha | O que acontece |
| --- | --- |
| **Ignorar** | Mantém o que já existe e não importa este item. |
| **Substituir** | Troca o que existe pelo item do arquivo. |
| **Importar como cópia** | Mantém os dois. |

Os itens sem conflito entram como novos. Se não houver nenhum conflito, o app avisa: **Nenhum conflito — tudo será importado como novo.**

::: info Importar não mexe no resto
Ao importar músicas ou um conjunto, só muda o que você marcar como **Substituir**. Todo o resto continua como está. Apenas o modo **Substituir tudo**, do backup completo, apaga a biblioteca inteira.
:::
