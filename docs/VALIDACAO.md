# Validação do Tato Radar

## Tato Radar 2.0.0

- A extensão passa a se chamar Tato Radar, com a assinatura “Tem algo fora da toca?”. Nome do manifesto, títulos, notificações e ícone usam a nova marca.
- O ícone foi ilustrado com ImageGen a partir do Tato original e exportado nos tamanhos 16, 32, 48 e 128 px com transparência real. O estado do radar aparece no selo numérico e na descrição do ícone.
- Os balões usam frases locais ligadas à fase do radar, à coleta e à consulta de boletins. Novos quadros de boca aberta foram editados com ImageGen a partir das poses existentes. O reprodutor mostra a região da boca por alguns segundos e encerra o movimento. O cochilo esconde o balão e o despertar tem uma fala própria.
- O banco IndexedDB continua com o nome interno anterior para manter o histórico, os favoritos e as preferências da instalação existente.

## Versão 1.11.0

- Incidentes em andamento com mais de 24 horas aparecem quando o painel oficial recente ainda os lista como ativos. Uma ocorrência antiga encontrada apenas no histórico, um painel sem o incidente e uma coleta com falha não contam como reconfirmação.
- O coletor do Google Cloud usa as regiões atualmente afetadas para alertas ativos. Regiões de etapas anteriores continuam disponíveis em incidentes encerrados.
- A auditoria de 16/11/2026 consultou 21 endpoints públicos e encontrou 612 registros, zero incidentes ativos com impacto confirmado no Brasil, um aviso ativo da Cloudflare sem confirmação de impacto no país e dois relatos nacionais. O Tesouro Nacional também publicou uma nota oficial sobre o incidente detectado em 4 de novembro. Esta leitura se limita ao que as fontes publicaram no momento da coleta. [Nota à imprensa do Tesouro Nacional](https://www.gov.br/tesouronacional/pt-br/noticias/nota-a-imprensa-2).

## Versão 1.10.0

- O Tato anima automaticamente. Com movimento reduzido, a piscada, o cochilo ilustrado, o susto e os toques no terminal continuam disponíveis. Os zês aparecem em sequência no mesmo lugar, a respiração para e as mudanças de alerta usam menos quadros. [MDN sobre movimento reduzido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
- O popup nativo do Chrome abriu via `chrome.action.openPopup()`, em perfil isolado, com rede desativada, movimento reduzido e coleta parcial simulada. A captura mostra olhos abertos e fechados na mesma fase durante os primeiros dois segundos.
- O Chrome também executou o fluxo automatizado no documento do popup com cochilo, despertar, terminal, cobertura a 320 px e persistência de favoritos. A coleta separada no Chromium recebeu 612 registros de 21 coletores, todos sem erro nessa rodada.
- O radar mostra a data da sua última coleta útil. Os boletins têm cobertura própria e mostram a data da última coleta útil de cada fonte. Histórico, favoritos e preferências usam o mesmo armazenamento.

## Versão 1.9.0

- O repouso usa o atlas `public/tato/cochilo-sequencia.png`, produzido pela ferramenta integrada ImageGen a partir do Tato original e da arte 1.8.0. O prompt pediu seis quadros alinhados na mesma altura: olhar sonolento, abaixar a cabeça, dormir com bolha, despertar assustado, levantar e relaxar. Pediu fundo transparente, carapaça turquesa, rosto creme e as mesmas proporções do mascote.
- O modo consulta reutiliza a pose com capuz e terminal e anima uma região da pata em intervalos. Esse modo não cochila nem modifica a classificação do radar. Movimento reduzido mantém o quadro estático até a autorização específica para cochilo e consulta.

## Versão 1.8.1

- A tela de boletins da 1.8.0 criava o Tato com a animação desligada. No radar, o movimento reduzido excluía o cochilo. A versão 1.8.1 usa as preferências de animação nas duas telas e apresenta a pose fixa de cochilo no modo reduzido.
- O cochilo reutiliza a arte da 1.8.0. O radar ao vivo continua limitando o cochilo à fase Tranquilo. Na consulta de boletins o cochilo é apenas uma reação visual.
- Os filtros mostram os totais coletados. A busca aceita CVE, USN e palavras do componente ou do título original.

## Versão 1.8.0

- Fontes de boletins integradas: RSS do Microsoft Security Response Center para Windows e Ubuntu Security Notices da Canonical. As suítes consultam os endpoints com os mesmos adaptadores do build. Total de 21 consultas públicas e 22 testes incluindo a auditoria de classificação.
- A seção Boletins de segurança mostra as entradas oficiais coletadas com até 30 dias. Para Windows, usa boletins com Windows, Win32k ou NTFS no título. Para Ubuntu, usa os avisos USN do feed oficial. A origem informa os produtos, versões e correções aplicáveis.
- A arte do repouso foi produzida pela ferramenta integrada de geração de imagens, em `public/tato/cochilo.png`. A ferramenta recebeu o Tato mestre como imagem de referência para gerar quatro quadros em fundo transparente.
- O teste do popup no Chrome verificou o cochilo, o despertar por movimento do mouse, a pose de consulta e o filtro de boletins. O teste complementar abriu o build no Chromium com dados públicos, verificou os filtros Windows e Ubuntu e coletou 21 respostas sem erros.

Prompt de arte: “Edit the supplied CyberWatch mascot into a transparent sprite atlas of EXACTLY four equal square cells, two columns by two rows, no dividers, no background, no titles or letters. Each cell has the same character scale and foot contact line and centered framing. Preserve the identical expressive cute yellow cream armadillo face, blue-black nose, coral inside small ears and three thick rounded turquoise armored shell bands, same direction facing right, same polished softly shaded 3D mascot look. Top-left: beginning to doze, sleepy eyes half shut, head lowers slightly and forepaws tuck. Top-right: fully asleep, head lowered, eyes entirely closed, chin on front paws, tiny round translucent saliva bubble gently protruding from corner of mouth, calm. Bottom-left: waking and lifting up on little paws, surprised eyes half opening, bubble gone. Bottom-right: fully awake, stretching up slightly and cheerful one-sided grin, no bubble. Character stays distinctly Tato. Consistent framing and overall position in each cell; leave clear transparent margin around each cell, never overlap. No symbols, no text, no floor, no ground shadows, use actual alpha transparency.”

## Versão 1.7.0

- Os serviços fixados usam os favoritos existentes. Os quatro padrões são Outlook corporativo, Caixa/Pix, SSW e ChatGPT/OpenAI. Os cartões diferenciam status publicado, falta de aviso público e relatos recentes.
- As preferências por favorito filtram apenas as notificações de disponibilidade. As categorias, o recorte e a pausa definidos nas preferências gerais continuam sendo aplicados.
- A arte existente e a regra de movimento reduzido continuam no build. Relatos vêm das fontes editoriais integradas. O build não coleta uma contagem de reclamações do Downdetector.

## Versão 1.6.1

- A página pública da Microsoft usa o coletor de serviços pessoais integrado nesta versão. O teste de integração verificou a leitura de Outlook.com na resposta real. O feed corporativo continua separado e pode divulgar apenas incidentes amplos.
- Alertas ativos exigem observação recente da fonte e publicação ou atualização do incidente nas últimas 24 horas. Uma resposta bem-sucedida ao consultar um registro antigo não redefine essa idade. Notícias de queda ou instabilidade usam a janela de 48 horas na tela inicial.
- As 19 consultas a endpoints públicos e a auditoria de classificação passaram. A regra de idade e a ordenação foram exercitadas na suíte de 51 testes unitários.

## Versão 1.6.0

- Em 16/11/2026 às 14h03 no horário de Brasília, os 18 endpoints públicos do radar responderam e passaram pelos adaptadores. O total corresponde a 14 fontes configuradas e quatro consultas de histórico.
- O build carregado como extensão em um perfil isolado do Chromium completou dois ciclos de coleta com 18 tarefas bem-sucedidas e 412 registros únicos persistidos. A captura do popup usa esses dados públicos.
- A rodada encontrou um aviso ativo de favorito sem impacto confirmado no Brasil, três recuperações de favoritos, três relatos relevantes e nenhum alerta atual confirmado no Brasil. O recorte e a confirmação são atribuídos conforme o conteúdo das fontes.
- Os 50 testes unitários, 19 testes de integração e o teste Playwright no Chrome passaram. O teste no Chrome exercitou a piscada com movimento reduzido após autorização, capuz, recuperação, detalhes, favoritos e a página de cobertura a 320 px.
- O status público do Microsoft 365 tem alcance limitado. A integração não consulta a conta corporativa do usuário. SSW e Caixa/Pix continuam cobertos por publicações, conforme descrito em Cobertura.

## Versão 1.5.1

- O Chrome abriu o pacote 1.5.0 pelo ícone da barra em um perfil isolado. O popup ficou visível e mostrou a pose local. O navegador reportou movimento reduzido e as camadas de animação ficaram ausentes.
- O mesmo caminho com o pacote 1.5.1 foi exercitado em Monitoramento parcial, com resolução de rede bloqueada, o alarme de coleta limpo após a preparação e dados de teste carregados antes do clique. A primeira renderização útil já mostrou a arte. Com o movimento habilitado no alvo de teste por emulação de mídia, os quadros capturados mostram olhos abertos, pálpebras cobrindo os olhos em cerca de 1,5 s após o clique e olhos abertos novamente. A fase permaneceu constante. A preferência do Windows não foi alterada.
- A tela Cobertura foi aberta a partir do popup da barra. O botão Voltar ao radar aparece no topo. O teste complementar a 320 px mede a largura rolável e verifica o retorno ao radar.
- O popup da barra ficou estático com Animar o Tato desligado. Também ficou estático com a opção ligada e o Chrome reportando movimento reduzido. As configurações exibem “Animações reduzidas pelo sistema” nessa condição.
- O Chrome tem a extensão registrada em `dist`. A arte empacotada é idêntica à versão 1.5.0. O identificador, as permissões, o armazenamento e as regras dos alertas foram preservados.

## Versão 1.5.0

- 48 testes unitários e 19 testes de integração. A integração consultou 18 endpoints públicos e rastreou as decisões do radar com os adaptadores e o armazenamento da extensão. Veja a [auditoria da coleta](AUDITORIA-RADAR.md).
- O cenário unitário de notificação registra um único alerta para o incidente, suprime a atualização duplicada e registra o restabelecimento. O banner nativo do Windows não foi verificado visualmente.
- Os clipes mostram a página `popup.html` do pacote carregado como extensão Chromium, com o viewport do popup. O clipe de alerta usa registros fictícios em perfil isolado e inclui os quadros do capuz e do terminal. A coleta e o histórico públicos foram auditados em uma execução separada.
- O teste de abertura alternou dois processos do Chromium, seis aberturas e o fallback PNG com WebP bloqueado. O bloqueio de rede aplicado à página do popup não interfere na coleta independente do service worker.
- O fluxo do build passou no Chromium, Google Chrome e Microsoft Edge. Os testes abriram o detalhe pelo histórico, adicionaram e reencontraram um favorito e exercitaram a animação, a recuperação e o movimento reduzido.
- Uma atualização de 1.4.0 para 1.5.0 no mesmo caminho e perfil isolado do Chromium manteve o ID da extensão, um registro salvo, um favorito e as preferências de animação e de notificações.

## Referência da versão 1.4.0

A abertura foi reproduzida antes da alteração, incluindo reinício e reabertura. A primeira superfície útil criava um DIV sem imagem enquanto aguardava a consulta IndexedDB. Na primeira abertura observada houve DIV aos 442 ms, IMG ainda não decodificada aos 737 ms e imagem carregada aos 1015 ms. Na segunda houve DIV aos 347 ms e imagem carregada aos 678 ms. Evidência bruta em work/cold-baseline-*.json.

A versão corrigida apresenta imagem local desde o conteúdo inicial e mantém IMG no resumo enquanto os dados são consultados. O teste verifica seis reaberturas offline em dois processos de navegador, incluindo a reserva PNG quando o WebP é bloqueado.

46 testes unitários passaram. Typecheck, ESLint e build aprovados; 18 consultas de integração a fontes públicas reais aprovadas. O teste adicional percorre fonte Statuspage, persistência do incidente com dois componentes, alerta, resolução, título Restabelecido e novo processamento sem notificação duplicada. O clique da notificação mantém o ID do registro.

As gravações Abertura-a-frio.webm e Alerta-restabelecido.webm documentam o popup do build. A recuperação usa exemplos fictícios explicitamente identificados, em perfil isolado. A coleta real é validada separadamente por test:live.

O banner visual do sistema operacional continua sem verificação visual. Os testes de notificação verificam os argumentos da API e a persistência. As versões de esquema do banco, os favoritos, as preferências antigas, a identidade e as permissões do manifesto foram mantidos.

O fluxo de interface do build passou no Google Chrome e no Microsoft Edge, incluindo Modo Hacker, retorno de fase, movimento reduzido, serviços, histórico, detalhe e preferências.
