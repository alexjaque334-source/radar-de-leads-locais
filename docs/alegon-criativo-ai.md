# ALEGON Criativo — plano de IA unificada

## Marca e objetivo
Marca pública: **ALEGON Criativo**, integrada ao Radar de Leads. Não utilizar marcas de editores terceiros. O produto atende peças gráficas (posts, stories, banners, logotipos), cardápios e projetos de sites.

## Estratégia de provedores
Escolha candidata: **Google Gemini API** para texto, leitura de imagens, conteúdo, JSON estruturado e geração de código; um modelo da família Gemini com capacidade de gerar e editar imagens para operações de modificação visual. A mesma conta/API pode disponibilizar modelos distintos, com tarifas distintas. Verificar nome e disponibilidade efetivos de cada modelo no momento da implementação; não fixar modelo imaginário.

**Não confundir** edição local do documento com edição rasterizada por IA. DeepSeek atualmente atende a geração de sites. Migrar somente com teste de qualidade e custos, preservando fallback e a configuração existente. Gemini não produz sozinho um editor visual: o editor local permanece responsável por layers, operações, undo/redo, zoom, exportação e formatos.

## Fluxos
- Texto/código: validar dados -> enviar contexto necessário -> exigir JSON estruturado/HTML sanitizado -> prévia isolada -> edição manual.
- Imagem: upload autorizado -> compactação e orçamento -> pedido textual -> geração/edição por IA -> resultado como nova camada, preservando original e histórico; evitar prometer edição granular de objetos internos de uma imagem achatada.
- Cardápio: digitação do zero ou importação de imagem/PDF -> extração com revisão humana obrigatória de preços -> categorias e itens editáveis -> exportação.
- Assets: biblioteca de projetos por usuário no D1; binários em armazenamento dedicado somente depois de validar custos e controles de acesso.

## Segurança e limites
- Chave Gemini em segredo de Worker, nunca em HTML ou GitHub.
- Autenticação, rate limit, limites de tamanho/MIME, cancelamento, idempotência, tokens e quantidade de imagens.
- Contabilidade por conta, modelo e operação, com reserva anterior ao provedor e reconciliação com uso real. Créditos unificados com operações de imagem precificadas separadamente.
- A exceção de QA interna não deve bypassar proteções contra abuso nem orçamento externo: stop-loss global, alertas e limites externos configuráveis.
- Provedores cobram por uso, possivelmente em moeda estrangeira. Não presumir cobrança em BRL até confirmar na conta de faturamento.
- Não subir chave nem habilitar gastos reais sem consentimento e orçamento do operador.

## Entrega incremental
1. Editor visual ALEGON Criativo e múltiplos formatos + biblioteca e exportação.
2. Integração de texto/código Gemini com feature flag e testes; DeepSeek mantido enquanto não houver migração validada.
3. Geração/edição de imagens via modelo compatível da mesma API, com orçamento.
4. Cardápio completo do zero + foto/PDF com validação.
5. Comparação de qualidade/custo e ativação progressiva para usuários.

Sem deploy automático de recursos cobrados antes de teste e decisão de preços.
