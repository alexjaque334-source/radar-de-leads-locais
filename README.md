# Radar de Leads Locais

Aplicativo de prospecção por estado, cidade e bairro opcional. A interface reúne resultados de OpenStreetMap e TomTom, contatos públicos disponíveis, filtros e detalhes. A exportação CSV/XLSX e a interface do CRM estão temporariamente desativadas. O limite de resultados é aplicado ao total combinado.

## Criador de sites com IA

A página `/studio.html` cria uma landing page em um arquivo HTML, aceita ajustes em português, mantém um histórico local no navegador, mostra uma prévia em iframe isolado e permite baixar ou copiar o HTML. A ação “Criar site com IA” nos detalhes de um lead transfere para o briefing os dados que a busca já encontrou.

A geração usa o endpoint oficial `https://api.deepseek.com/chat/completions` e o modelo `deepseek-flash`. Configure `DEEPSEEK_API_KEY` como segredo do ambiente de produção do Site. Em desenvolvimento, injete a variável no ambiente local do Wrangler. Nunca inclua a chave no HTML ou em arquivos versionados. Sem a chave, a página continua disponível e mostra que a integração está aguardando configuração. Cada geração ou ajuste pode consumir tokens e gerar cobrança na conta DeepSeek.

A prévia executa o HTML em um iframe sandbox sem acesso à origem da aplicação. O histórico e o rascunho ficam no armazenamento local do navegador atual. O app não publica o site gerado automaticamente: use o download para revisar e hospedar na sua conta.

## Fontes e limitações

- **OpenStreetMap:** Nominatim para localizar a região; Overpass API para estabelecimentos. Dados sujeitos à atribuição e à ODbL.
- **TomTom Places:** resultados exibidos temporariamente conforme as condições do provedor. Exportação de dados TomTom está desativada até confirmação de permissão nos termos da conta.
- **DeepSeek:** recebe o briefing e, em ajustes, também o HTML atual para produzir a página solicitada. Não envie informações confidenciais.

As fontes de estabelecimentos não garantem cobertura completa. Um site, contato ou cardápio ausente nas tags consultadas não prova que o comércio não o possua. Revise os dados e o conteúdo gerado antes de apresentar ou publicar o site.

## Execução local

Use Node.js conforme `package.json`, execute `pnpm install` e `pnpm dev`. Para testar a geração local, copie `.dev.vars.example` para `.dev.vars` e informe sua chave nesse arquivo local, que não deve ser versionado. Para validar a versão de produção, execute `pnpm build`. A configuração de deploy para Cloudflare aceita o UUID do D1 em `CLOUDFLARE_D1_DATABASE_ID`; depois de criar o D1 `radar-leads-locais`, autentique com `pnpm exec wrangler login` e execute `pnpm deploy:cloudflare` para compilar, aplicar o SQL inicial e publicar. O script recusa um UUID ausente ou fictício. O e-mail superadmin é configurado como variável `SUPERADMIN_EMAIL` (padrão `apacessoria25@gmail.com`) e a senha deve ser cadastrada como segredo criptografado `SUPERADMIN_PASSWORD`; o primeiro login correto cria/aprova a conta. Cadastre `DEEPSEEK_API_KEY` e `TOMTOM_API_KEY` como segredos se usar esses recursos. Nunca versionar valores secretos. O painel fica em `/admin.html`. A API `/api/generate-site` retorna estado de configuração sem expor a chave e valida entradas, tamanho de HTML, formato de resposta, falhas, timeout e limites do provedor.

As páginas `/privacy` e `/terms` são rascunhos técnicos e precisam ser revisadas com os dados do operador antes de disponibilizar o serviço publicamente.

## API oficial WhatsApp Business (opcional)

A interface do CRM está temporariamente desativada. A rota de envio oficial da Meta permanece no código, mas não é acessível pelo fluxo atual. O lead precisa ter um número WhatsApp explícito e autorização registrada com data e origem. Um telefone público, por si só, não é consentimento. Configure no servidor, nunca no navegador: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_TEMPLATE_NAME` e `WHATSAPP_TEMPLATE_LANGUAGE` (padrão `pt_BR`). São necessários os dados da conta Meta, um número comercial registrado e um modelo aprovado no WhatsApp Manager. O envio tem limite de tentativas; o Radar informa quando a Meta aceita a solicitação, mas isso não garante a entrega.

O WA-AKG não foi incorporado: o repositório usa Baileys e sessões de WhatsApp vinculadas por QR, incluindo disparos com atrasos aleatórios descritos como proteção anti-ban. O Radar usa a integração oficial da Meta.
