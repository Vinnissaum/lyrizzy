// Temporary error code → pt-BR message map.
// To be migrated into locales/pt-BR.json by T30 (i18n extraction task).
export const ERROR_MESSAGES: Record<string, string> = {
  // Song domain
  "song.not_found": "Música não encontrada",
  "song.db_error": "Erro no banco de dados: {{detail}}",

  // Import domain
  "import.io_error": "Falha ao ler arquivo: {{detail}}",
  "import.parse_error": "Falha ao processar arquivo: {{detail}}",

  // Set domain
  "set.not_found": "Conjunto não encontrado",
  "set.item_not_found": "Item não encontrado",
  "set.db_error": "Erro no banco de dados: {{detail}}",

  // Presentation domain
  "presentation.index_out_of_bounds": "Índice de item fora dos limites",

  // Countdown domain
  "countdown.duration_not_set": "Defina a duração antes de iniciar",

  // Media domain
  "media.no_extension": "Arquivo sem extensão",
  "media.unsupported_type": "Tipo de mídia não suportado: .{{ext}}",
  "media.copy_error": "Falha ao copiar arquivo de mídia: {{detail}}",
  "media.db_error": "Erro no banco de dados: {{detail}}",

  // Window domain
  "window.build_error": "Falha ao criar janela: {{detail}}",

  // Generic
  "legacy": "{{message}}",
};

export function formatError(
  code: string,
  params: Record<string, string>
): string {
  const template = ERROR_MESSAGES[code] ?? code;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? "");
}
