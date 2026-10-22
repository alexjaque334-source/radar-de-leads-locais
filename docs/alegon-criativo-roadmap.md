# ALEGON Criativo — roteiro de evolução (PR #12)

Objetivo: oferecer uma experiência de criação visual profissional inspirada nos recursos públicos de editores como o Canva, sem copiar código, marcas, elementos ou coleções proprietárias. Preservar controle de custos de IA, autenticação Pro e proteção de arquivos privados.

## Sequência acordada

- [ ] **1. Motor de edição confiável** — seleção, arraste mouse/toque, captura de ponteiro, redimensionamento proporcional, alinhamento, limites do canvas, histórico desfazer/refazer e atalhos; testes automatizados com entrada realista. Fazer antes de expandir outras ferramentas.
- [ ] **2. Fidelidade e formatos de exportação** — renderização consistente PNG/HTML para Story, Feed, Post e Banner, efeito visual, imagens, vetores, tipografia, transparências e rotações; testes comparativos.
- [ ] **3. Persistência de imagens e projetos** — assets privados autorizados por usuário no R2, referências seguras, abertura em outro dispositivo, recuperação, quotas e estados de erro; nunca expor chaves ou arquivos de terceiros.
- [ ] **4. Múltiplas páginas e projetos** — adicionar/duplicar/reordenar páginas, formatos por página e navegação no projeto; salvar e restaurar corretamente.
- [ ] **5. Tipografia e efeitos** — fontes com licenças apropriadas, presets, sombra, espaçamento, curvas e estilos sem acoplamento a serviços pagos.
- [ ] **6. Grupos de elementos** — seleção múltipla, agrupamento, desagrupamento, alinhamento, distribuição, travamento e organização por camadas.
- [ ] **7. Tratamento avançado de imagens** — recorte, enquadramento, ajustes, filtros e substituição preservando molduras; armazenamento seguro.
- [ ] **8. Biblioteca mais ampla** — elementos e modelos próprios ou licenciados, busca por palavras-chave/categorias, favoritos, projetos recentes, identidade visual.
- [ ] **9. Guias e precisão** — snap to edges, center and peer elements, réguas, grid, margens, coordenadas e zoom consistente em desktop/mobile.
- [ ] **10. Exportações profissionais** — PNG/JPEG/WebP/SVG/PDF quando viável, transparência, tamanho/qualidade e formatos animados somente quando implementados e validados.
- [ ] **11. Testes ponta a ponta** — Playwright ou equivalente em desktop e touchscreen/mobile, autenticação Pro, regressão funcional, acessibilidade, crashes, persistência, uploads, erros de API e segurança.
- [ ] **12. Pré-lançamento** — auditoria técnica, revisar custos/limites, publicar apenas após aprovação explícita para merge/deploy.

## Critérios para declarar uma etapa concluída
- Mudança em branch única e PR #12, sem merge automático.
- Testes de regressão + lint + build aprovados.
- Testes reais de navegador e mobile realizados quando houver ambiente; se não realizados, registrar a lacuna.
- Sem afirmação de “100% sem bugs” ou equivalência integral ao Canva sem evidências.

## Situação
Etapa prioritária atual: **8 — biblioteca ampliada**. Controles de fontes de sistema, alinhamento, espaçamento, altura da linha, transformação, contorno, brilho, sombra, profundidade e estilos prontos implementados na PR #12; aguardando validação da aparência e da exportação em navegadores reais. A etapa 4 segue com homologação multipágina manual pendente. Estrutura inicial de até 10 páginas, criação/duplicação/exclusão/ordenação e armazenamento em formato v4 implementados na PR #12; ainda falta a homologação de interface, ciclo completo de salvamento/reabertura e exportação multipágina. A etapa 3 continua com validação real entre dispositivos pendente. As etapas 1 e 2 receberam implementação e testes automatizados, mas continuam com homologação visual pendente.


## Etapa 6 — andamento
Seleção múltipla por Ctrl/clique, identificação persistida de grupos, movimento simultâneo de elementos, desagrupamento e regressões automatizadas foram adicionados. Falta homologação visual por usuário após publicação autorizada, sem declarar a etapa completa prematuramente.


## Etapa 7 — tratamento de imagens
Adicionados: enquadramento cover/contain, posição X/Y, zoom, máscaras quadrada/arredondada/circular, brilho/contraste/saturação/preto-e-branco/sépia/desfoque, substituição mantendo geometria, ajustes de capa e persistência no modelo de páginas. Faltam testes visuais de fidelidade e interação, reservados à homologação.


## Etapa 8 — biblioteca ampliada
Ampliação do catálogo para mais de 100 ícones vetoriais originais em novas categorias de setores locais; 20 modelos editáveis por segmento com busca e filtro; favoritos de ícones e kit de cores e nome da marca por usuário no armazenamento local do navegador. Os favoritos e o kit de marca não sincronizam entre dispositivos: exigem evolução posterior para persistência privada na nuvem. Falta homologação visual geral antes do lançamento.


### Etapa 8 — complemento: sincronização privada de identidade e favoritos
API autenticada `/api/creative-preferences` para contas Pro; migração D1 `0006_creative_preferences.sql`; favoritos e nome/cores de marca persistidos por `user_id`. Ao entrar, o editor carrega preferências do servidor e pode migrar valores locais quando ainda não existe um registro; mantém fallback local quando indisponível. Testes automatizados de permissão, entrada e migração adicionados. A sincronização real entre navegadores fica pendente da homologação e da aplicação da migração no ambiente de publicação; sem merge/deploy.
