# Fontes integradas

| Fonte                                                                          | Método                             | Intervalo mínimo automático | Cobertura                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| [GitHub Status](https://www.githubstatus.com/api)                              | Statuspage v2                      | 3 min / histórico 10 min    | Componentes, incidentes e manutenção                                                        |
| [Cloudflare Status](https://www.cloudflarestatus.com/api)                      | Statuspage v2                      | 3 min / histórico 10 min    | Componentes, incidentes e manutenção                                                        |
| [Discord Status](https://discordstatus.com/api)                                | Statuspage v2                      | 3 min / histórico 10 min    | Componentes, incidentes e manutenção                                                        |
| [OpenAI Status](https://status.openai.com/)                                    | JSON público de compatibilidade v2 | 3 min / histórico 10 min    | Estado agregado e histórico de incidentes. Disponibilidade por plano ou modelo pode diferir |
| [Microsoft 365](https://status.cloud.microsoft/api/feed/mac)                   | RSS oficial                        | 5 min                       | Comunicados públicos, inclusive avisos que citam Exchange Online                            |
| [Microsoft · Serviços pessoais](https://status.cloud.microsoft/)               | JSON público                       | 5 min                       | Estado de serviços pessoais, incluindo Outlook.com                                          |
| [Google Cloud Service Health](https://status.cloud.google.com/)                | JSON History                       | 3 min                       | Incidentes públicos e regiões declaradas. Dados personalizados dependem do projeto          |
| [Google Workspace Status](https://www.google.com/appsstatus/dashboard/)        | JSON History                       | 3 min                       | Incidentes públicos do Workspace                                                            |
| [GitLab System Status](https://status.gitlab.com/)                             | RSS oficial                        | 5 min                       | Comunicados de GitLab.com. Endpoints v2 consultados retornaram 404                          |
| [AWS Health](https://health.aws.amazon.com/health/status)                      | RSS público                        | 5 min                       | Comunicados públicos. Visão específica da conta depende de autenticação                     |
| [Azure Status](https://azure.status.microsoft/en-us/status)                    | RSS público                        | 5 min                       | Comunicados públicos. Um feed vazio é aceito como resultado válido                          |
| [CERT.br](https://cert.br/rss/certbr-rss.xml)                                  | RSS oficial                        | 30 min                      | Publicações do CERT.br                                                                      |
| [Tecnoblog](https://tecnoblog.net/feed/)                                       | RSS editorial em português         | 10 min                      | Notícias com vínculo ao Brasil e impacto relevante                                          |
| [Canaltech](https://canaltech.com.br/rss/)                                     | RSS editorial em português         | 10 min                      | Notícias com vínculo ao Brasil e impacto relevante                                          |
| [SecurityWeek](https://www.securityweek.com/feed/)                             | RSS editorial                      | 10 min                      | Incidentes com impacto no Brasil e avisos sobre serviços acompanhados                       |
| [Microsoft Security Response Center](https://msrc.microsoft.com/update-guide/) | RSS oficial                        | 60 min                      | Boletins de segurança do Windows                                                            |
| [Ubuntu Security Notices](https://ubuntu.com/security/notices)                 | RSS oficial                        | 60 min                      | Boletins de segurança dos pacotes oficiais do Ubuntu                                        |

A lista de URLs e os limites padrão são gerados a partir de `src/providers/catalog.ts`. A interface exibe a data publicada pela origem quando disponível, a última tentativa, o último sucesso, erros e o próximo horário permitido. RSS de status publica comunicados. A grade de componentes usa APIs com estado explícito ou as medições configuradas pelo usuário.

## Pendências

- **Exchange Online**. A cobertura usa os comunicados públicos do Microsoft 365. A visão específica de uma organização exige acesso autorizado ao tenant. [Documentação do Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/servicehealth-get?view=graph-rest-1.0).
- **CTIR Gov**. A rota RSS consultada retornou HTML. O coletor precisa de um endpoint estruturado verificável.
- **NVD e CISA KEV**. Os adaptadores existem no código. Essas fontes ficam fora da coleta padrão do radar.
- **SSW Sistemas e empresas da Caixa**. Os favoritos iniciais pesquisam termos em fontes já integradas. A disponibilidade local pode ser acompanhada por um teste HTTP de endereço autorizado.
