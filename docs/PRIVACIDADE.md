# Privacidade do Tato Radar

O Tato Radar guarda preferências no armazenamento local da extensão. IndexedDB armazena incidentes, evidências, histórico de componentes, observações HTTP e metadados de notificações. Esses dados pertencem ao perfil do navegador. Arquivos de exportação de preferências são gerados localmente e podem conter os domínios e termos cadastrados.

A extensão envia requisições diretas aos provedores públicos e aos hosts adicionais que você autoriza. O servidor de destino recebe dados normais da conexão, incluindo o endereço IP público. A coleta usa requisições sem credenciais e bloqueia redirecionamentos. A aplicação não incorpora telemetria, conta de usuário, serviço de IA ou backend próprio.

O manifesto solicita armazenamento, alarmes, notificações e painel lateral. Os acessos iniciais de rede correspondem ao catálogo. Permissões opcionais são solicitadas por host ao cadastrar ou reautorizar um endereço. Remover um cadastro interrompe a coleta dele. As permissões de host concedidas podem ser revistas nas configurações de acesso a sites da extensão.

URLs personalizadas devem ser públicas. O cadastro bloqueia endereços IP literais, nomes locais conhecidos, credenciais e portas não padrão. Como a extensão não inspeciona o IP efetivamente escolhido pela resolução DNS do navegador, use exclusivamente domínios públicos sob autorização. Um backend futuro precisaria verificar DNS e IP de conexão em cada requisição.

Você pode exportar preferências, pausar fontes, desligar notificações ou desinstalar a extensão para remover os dados locais.
