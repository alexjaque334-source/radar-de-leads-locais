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
Etapa prioritária atual: **3 — persistência de imagens e projetos**. Integração do editor com API privada R2 e biblioteca D1 implementada na PR #12; falta validar R2 configurado e ciclo de salvamento/reabertura em dispositivos diferentes. As etapas 1 e 2 receberam implementação e testes automatizados, mas continuam com homologação visual pendente.
