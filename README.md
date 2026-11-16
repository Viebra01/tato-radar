# CyberWatch · Radar de segurança digital no Brasil

Extensão Manifest V3 para acompanhar status oficial, avisos, vulnerabilidades e publicações de segurança. Opera localmente em português, com fuso padrão `America/Sao_Paulo`, sem conta, servidor ou API paga.

## Download e instalação

1. Baixe **CyberWatch.zip** na [versão mais recente do GitHub](https://github.com/Viebra01/CyberWatch/releases/latest) e extraia o arquivo em uma pasta permanente. A instalação é manual no navegador de desktop.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
3. Ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
4. Abra o menu de extensões e fixe o **CyberWatch** na barra. A primeira coleta carrega o histórico sem enviar notificações sobre eventos anteriores.

Se já usa o CyberWatch, extraia os arquivos novos na mesma pasta da instalação e use **Recarregar** no cartão da extensão. Isso preserva o histórico, os favoritos e as preferências.

O build usa APIs da família Chromium com suporte ao painel lateral. Políticas do navegador administrado podem restringir a instalação local ou a abertura do painel. [Instalação no Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [instalação no Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

## Uso diário

- O popup reúne Tato, situação no Brasil e última coleta no mesmo bloco. Os alertas, os serviços restabelecidos e os favoritos aparecem logo abaixo.
- O painel usa **Agora · Serviços · Histórico**. Favoritos, fontes, verificações HTTP e preferências ficam em **Configurações**.
- O Tato conta incidentes canônicos confiáveis em andamento no Brasil. Manchetes, componentes, notícias e alertas não lidos ficam fora dessa contagem.
- Avisos oficiais de favoritos com alcance desconhecido ficam separados. A opção para notificá-los começa desativada. Outlook pessoal tem cobertura distinta de Exchange Online.
- Histórico, favoritos, permissões e integrações da instalação existente são preservados. Recarregue a extensão no mesmo caminho, sem removê-la do perfil.
- **Configurações → Demonstração do Tato** abre a prévia isolada com as mesmas imagens e o mesmo reprodutor do produto. A prévia não escreve incidentes nem dispara notificações.
- O Tato anima automaticamente. Se o sistema pedir movimento reduzido, a extensão suaviza os efeitos de repouso e mantém ações localizadas como a piscada.
- **Ver cobertura** abre a situação das fontes em uma tela própria. Os controles de coleta ficam em **Configurações → Avançado**.
- **Alertas agora** mostra incidentes em andamento com impacto no Brasil. Incidentes com mais de 24 horas continuam no radar quando o painel oficial consultado ainda os apresenta como ativos. A mensagem de lista vazia informa o alcance da verificação. Relatos e avisos dos favoritos aparecem em seções próprias.
- **Outlook pessoal** usa o estado geral publicado pela Microsoft para Outlook.com. Para **Outlook corporativo**, a extensão mostra os comunicados públicos recentes relacionados ao Exchange Online, quando disponíveis.
- **Serviços fixados** traz até quatro favoritos logo abaixo do Tato. Em **Personalizar**, escolha quais aparecem e configure as notificações de disponibilidade por favorito. O detalhe do serviço reúne estado, fonte, horário, relatos e histórico.
- O Tato cochila após cerca de sete segundos no radar tranquilo. Passe o mouse sobre ele ou acione **Acordar o Tato** para ver o susto, o levantar e o retorno à expressão tranquila.
- **Boletins de segurança** reúne publicações oficiais recentes sobre Windows e Ubuntu com filtro por plataforma, contagem de registros e busca por CVE, USN ou componente. O Tato usa capuz e terminal no modo consulta. Abra **Cobertura dos boletins** para conferir as coletas. A coleta de boletins tem cobertura própria.
- As entradas antigas com entidades HTML são normalizadas na apresentação. Títulos e resumos ficam em português, com link original e metadados recolhíveis no detalhe.

## Fontes e interpretação

Consulte o [catálogo de fontes e pendências](docs/FONTES.md) e a [política de privacidade](docs/PRIVACIDADE.md).

Os adaptadores mantêm datas de ocorrência, publicação, detecção e atualização separadas. A interface identifica se a informação veio de uma reportagem, um comunicado oficial ou uma medição local.

Os testes HTTP acumulam falhas consecutivas e exigem sucessos consecutivos para recuperar. Respostas 5xx e falhas genéricas de rede com conectividade recente observada podem contar como falhas. Redirecionamentos, respostas 4xx, limitação 429 e conectividade incerta produzem estado desconhecido. O navegador normalmente reúne DNS, TLS e outros erros de rede na mesma exceção. A duração observada começa na primeira falha da sequência. As evidências do teste têm escopo local.

## Desenvolvimento

Requer Node.js 24 e pnpm. O build usa React, TypeScript estrito, Vite, CSS local, Lucide, Dexie e Zod. A interface foi escrita com CSS próprio. A pasta `src/providers` concentra catálogo, transporte e adaptadores, `src/domain` contém regras de classificação e correlação, `src/storage` define IndexedDB, `src/background` controla coleta e alertas e `src/ui` serve as três superfícies.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:live
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Os testes unitários usam fixtures e IndexedDB em memória. A suíte de integração consulta endpoints públicos. O Playwright abre o build da extensão em um perfil isolado e injeta exemplos fictícios para reproduzir fases e recuperações. Consulte [validação e limitações](docs/VALIDACAO.md) para os resultados da entrega.

## Limites de operação

- A coleta depende do navegador em execução e dos alarmes permitidos pelo sistema. Suspensão, economia de energia e fechamento do navegador podem adiar ciclos.
- O agendamento é de melhor esforço. Há limite de concorrência, uma tarefa por origem por lote, cache condicional, Retry-After e backoff. O botão de atualização respeita os limites.
- A correlação combina ID da origem, URL editorial canônica e similaridade conservadora. O painel aproveita títulos em português dos feeds nacionais e cria títulos e resumos em português a partir dos campos estruturados de fontes internacionais. O link da fonte abre a publicação original.
- A interface prioriza o status e o escopo publicados pelas fontes. Ausência de registro indica ausência de evidência no recorte coletado. O catálogo público do NVD usa uma janela móvel e uma página por ciclo.
- A notificação depende de permissão e disponibilidade do navegador e do sistema operacional. O histórico de alertas evita duplicatas por cooldown. Em caso de encerramento no intervalo entre o registro do alerta e a entrega pela API, o registro fica acessível no feed.
- O estado de disponibilidade de Microsoft 365 por tenant, integração com MSRC, cobertura geográfica mais ampla e múltiplos pontos de observação são possibilidades de evolução. O contrato `Snapshot` separa aquisição e ingestão para futura origem remota.

Para remover o histórico local, remova a extensão do perfil. Exporte as preferências antes se quiser reutilizá-las.

## Abertura e uso diário em 1.4

A imagem inicial do Tato é local, pré-carregada e renderizada antes de concluir a leitura do banco. Se o WebP falhar, a interface usa a imagem-mestra PNG de reserva. O popup prioriza Precisa de atenção, Restabelecidos e Seus serviços. Ver cobertura explica as fontes sem verificação. Configurações reúne O que acompanhar, Quando me avisar e Aparência, com os controles técnicos em Avançado.

A pose faz uma reação curta com quadros existentes ao abrir. A transformação completa corresponde a mudanças reais, e a recuperação exige evidência. A animação acompanha a preferência de movimento reduzido automaticamente.
