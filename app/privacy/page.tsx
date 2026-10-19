export default function Privacy() {
  return (
    <main style={{ maxWidth: 780, margin: "48px auto", padding: "0 20px", fontFamily: "system-ui", color: "#17233c", lineHeight: 1.65 }}>
      <a href="/radar.html">← Voltar ao Radar de Leads Locais</a>
      <h1>Política de Privacidade</h1>
      <p>O responsável pelo Radar de Leads Locais atende solicitações relacionadas a dados pessoais pelo WhatsApp/telefone +55 (41) 99753-3584 e pelo e-mail apacessoria25@gmail.com. O serviço trata os dados descritos abaixo para autenticar usuários, realizar buscas comerciais solicitadas e gerar páginas quando o usuário aciona a ferramenta.</p>
      <h2>Dados consultados</h2>
      <p>O usuário informa estado, cidade, bairro opcional e segmento. Esses dados são enviados aos serviços de geocodificação e busca escolhidos para localizar estabelecimentos comerciais. O aplicativo não solicita nem armazena contas ou senhas de empresas.</p>
      <h2>OpenStreetMap</h2>
      <p>Quando selecionado, o app consulta Nominatim e Overpass API. Os resultados OpenStreetMap são mostrados com atribuição. A exportação está temporariamente desativada. O endereço de e-mail e a senha da conta não são enviados a esses provedores.</p>
      <h2>DeepSeek e criação de sites</h2>
      <p>Quando o usuário solicita uma geração ou ajuste, o briefing comercial e, nos ajustes, o HTML atual são enviados à API DeepSeek para produzir o site. Não envie informações confidenciais. A chave da API é mantida como segredo no servidor e não é enviada ao navegador.</p>
      <h2>Contas e recursos temporariamente indisponíveis</h2>
      <p>Para criar uma conta, armazenamos o e-mail, um hash criptográfico da senha, o status de aprovação e sessões de acesso. Senhas em texto não são armazenadas. A sessão expira após sete dias. O painel visual do CRM e a exportação estão temporariamente indisponíveis. Registros de leads salvos em versões anteriores podem continuar na base até serem removidos pelo administrador; não use o serviço como armazenamento permanente de leads enquanto o CRM estiver desativado.</p>
      <p>O disparo de mensagens não está disponível na interface pública atual. Não envie dados pessoais ou informações confidenciais na busca ou no briefing de geração.</p>
      <p>O cadastro aguarda autorização manual do superadmin. Usamos o e-mail e o status da conta para prestar e proteger o acesso, limitar tentativas de login e impedir acessos não autorizados. Para aplicar os limites, guardamos somente um identificador hash derivado da conta e do endereço de rede, junto com a janela de tentativas; não guardamos o endereço de rede em claro. Registros vencidos são removidos em requisições posteriores.</p>
      <h2>Rascunhos e fontes externas</h2>
      <p>Rascunhos de sites ficam no armazenamento local do navegador, separados por conta neste dispositivo. O histórico de buscas fica no armazenamento local do navegador e pode ser visto por quem usar o mesmo perfil do navegador. Os resultados TomTom Places permanecem somente na memória da página e não são armazenados no CRM. O briefing comercial enviado para geração ou ajuste é processado pela API DeepSeek conforme a solicitação do usuário.</p>
      <h2>Direitos e retenção</h2>
      <p>Para solicitar acesso, correção ou exclusão de dados, contate o responsável pelo e-mail apacessoria25@gmail.com ou pelo WhatsApp/telefone +55 (41) 99753-3584. Dados de conta e sessões são mantidos enquanto necessários à operação e segurança do serviço; registros antigos do CRM poderão ser excluídos mediante solicitação ao responsável, ressalvadas obrigações legais aplicáveis.</p>
      <h2>Contato do responsável</h2>
      <p>WhatsApp/telefone: <a href="https://wa.me/5541997533584">+55 (41) 99753-3584</a>. E-mail: <a href="mailto:apacessoria25@gmail.com">apacessoria25@gmail.com</a>.</p>
      <p><small>Última atualização: 19 de outubro de 2026. Documento de implementação sujeito à revisão do responsável pelo serviço.</small></p>
    </main>
  );
}
