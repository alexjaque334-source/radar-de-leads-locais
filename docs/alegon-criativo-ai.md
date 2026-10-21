# ALEGON Criativo — plano de IA unificada

## Marca e objetivo
Marca pública: **ALEGON Criativo**, integrada ao Radar de Leads. Não utilizar marcas de editores terceiros. O produto atende peças gráficas (posts, stories, banners, logotipos), cardápios e projetos de sites.

## Estratégia de provedores
Escolha candidata: **OpenRouter** como gateway de modelos de múltiplos provedores, usando uma única integração e chave da plataforma. Diferentes modelos podem atender sites (código/texto), cardápios (texto/visão) e imagens (geração/edição). Nem todo modelo aceita imagens como entrada ou gera imagens: consultar disponibilidade, preço, formato e termos de cada modelo antes de habilitar. Gateway não garante preço idêntico ao do provedor direto.

**Não confundir** edição local do documento com edição rasterizada por IA. DeepSeek atualmente atende a geração de sites. Migrar somente com teste de qualidade e custos, preservando fallback e a configuração existente. OpenRouter não produz sozinho um editor visual: o editor local permanece responsável por layers, operações, undo/redo, zoom, exportação e formatos.

## Fluxos
- Texto/código: validar dados -> enviar contexto necessário -> exigir JSON estruturado/HTML sanitizado -> prévia isolada -> edição manual.
- Imagem: upload autorizado -> compactação e orçamento -> pedido textual -> geração/edição por IA -> resultado como nova camada, preservando original e histórico; evitar prometer edição granular de objetos internos de uma imagem achatada.
- Cardápio: digitação do zero ou importação de imagem/PDF -> extração com revisão humana obrigatória de preços -> categorias e itens editáveis -> exportação.
- Assets: biblioteca de projetos por usuário no D1; binários em armazenamento dedicado somente depois de validar custos e controles de acesso.

## Segurança e limites
- Chave OpenRouter em segredo de Worker, nunca em HTML ou GitHub.
- Autenticação, rate limit, limites de tamanho/MIME, cancelamento, idempotência, tokens e quantidade de imagens.
- Contabilidade por conta, modelo e operação, com reserva anterior ao provedor e reconciliação com uso real. Créditos unificados com operações de imagem precificadas separadamente.
- A exceção de QA interna não deve bypassar proteções contra abuso nem orçamento externo: stop-loss global, alertas e limites externos configuráveis.
- Provedores cobram por uso, possivelmente em moeda estrangeira. Não presumir cobrança em BRL até confirmar na conta de faturamento.
- Não subir chave nem habilitar gastos reais sem consentimento e orçamento do operador.

## Entrega incremental
1. Editor visual ALEGON Criativo e múltiplos formatos + biblioteca e exportação.
2. Integração OpenRouter para texto/código e visão com feature flag e testes; DeepSeek permanece atendendo sites enquanto houver saldo e até decisão explícita de migração.
3. Geração/edição de imagens via modelo compatível roteado pela OpenRouter, com orçamento.
4. Cardápio completo do zero + foto/PDF com validação.
5. Comparação de qualidade/custo e ativação progressiva para usuários.

## Planos e liberação de modelos por especialidade

**Regra do produto:** cada plano pode realizar as tarefas suportadas (sites, cardápios e imagens), mas o catálogo de modelos e os limites financeiros variam por plano. Escolher o modelo é um benefício do Pro/Premium, não um bloqueio de funções no Essencial.

| Plano | Preço | Site | Cardápio | Arte / imagem |
| --- | --- | --- | --- | --- |
| Essencial | R$ 24,90/mês | Um modelo fixo e econômico definido pela ALEGON | Um modelo fixo e econômico definido pela ALEGON | Um modelo visual fixo e econômico definido pela ALEGON |
| Pro | A definir | 2–3 modelos curados | 2–3 modelos curados | 2–3 modelos compatíveis com criação/edição |
| Premium | Pretensão comercial acima de R$ 100/mês; não precificado | Catálogo profissional curado, incluindo modelos anteriores | Catálogo profissional curado | Catálogo profissional curado de modelos visuais |

- Os modelos elegíveis ficam em configuração **servidor-side** por função e plano, nunca confiando em nome/preço/modelo enviado pelo cliente. Não expor modelos sem suporte à operação escolhida.
- Quando uma conta Essential envia uma tarefa, o backend roteia para o modelo fixo da função. No Pro e no Premium, o usuário escolhe somente entre a lista permitida e visualiza custos em créditos antes de confirmar.
- O catálogo pode mudar, mas exige versionamento e aviso. As escolhas dos usuários são registradas nos projetos para reprodutibilidade quando possível.
- **Acesso a modelos NÃO é utilização ilimitada.** Quotas separadas para busca, geração de site, leituras de cardápio, geração de imagem e edição de imagem, com custo variável por modelo e plano, reservas atômicas e reembolso por erro não cobrado.
- Prever máximo diário/mensal por conta, custo máximo por operação, limite total de gastos do provedor e recarga automática desativada quando disponível. A exceção de QA não anula orçamento global nem proteção contra abuso.
- Sem cobrar pelos recursos manuais locais do editor; edição por IA gera débito. O preço de operação deve cobrir repetições e impostos/taxas estimados.
- No estágio atual, **a DeepSeek continua nos sites**, independentemente da seleção futura de IA, até decidirmos migrar a função.
- Preços de Pro e Premium, nomes exatos dos modelos e franquias ficam pendentes de testes reais de qualidade/custo e aprovação comercial.

Sem deploy automático de recursos cobrados antes de teste e decisão de preços.
