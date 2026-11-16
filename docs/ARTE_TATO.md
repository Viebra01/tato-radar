# Tato ilustrado

Na versão Tato Radar 2.0.0, ImageGen editou a imagem-mestra e as poses Atento, Em guarda e Modo Hacker para criar bocas abertas. O reprodutor sobrepõe apenas a região da boca ao personagem durante a fala. O novo ícone transparente também foi produzido com ImageGen usando a imagem-mestra como referência.

A versão 1.3 usa a prancha turquesa fornecida pelo usuário como referência obrigatória. A imagem-mestra e as duas folhas de atuação foram produzidas pela ferramenta integrada de geração e edição de imagens. O vetor anterior foi substituído integralmente na implementação do mascote.

## Arquivos e execução

- `public/tato/master.png` guarda a imagem-mestra original.
- `public/tato/master.webp` apresenta o Tato Tranquilo.
- `public/tato/frame-00.webp` até `frame-15.webp` contêm dezesseis quadros ilustrados de olhos, patas, recolhimento, capuz, máscara e terminal.
- `public/tato/recover-0.webp` até `recover-5.webp` apresentam o fechamento do terminal, a retirada da máscara e a volta da carapaça.
- Os recortes foram extraídos das folhas com alinhamento do ponto de apoio, redimensionados e compactados em WebP. O código de apresentação seleciona os arquivos locais. Não há reconstrução de partes do corpo.
- `src/domain/tato-animation.ts` define os caminhos de ida e recuperação.
- `src/ui/Tato.tsx` pré-carrega e reproduz os quadros uma vez, respeita movimento reduzido e chega ao estado mais recente quando recebe mudanças em sequência.
- `demo.html` usa o mesmo componente e os mesmos arquivos. A demonstração não grava incidentes nem dispara notificações.

Os ícones da barra são PNGs estáticos extraídos da mesma arte. A variante muda quando a fase muda ou ao atualizar a versão dos ícones.

## Direção e prompts utilizados

A geração integrada recebeu a prancha fornecida como referência de edição, seguida da imagem-mestra como referência para as poses.

**Imagem-mestra.** “EDIT the attached Tato character sheet into ONE production master character PNG. Mandatory visual identity: same turquoise three-band shell, cream golden face, expressive navy eyes, short rounded snout, tiny paws, coral claw details, mischievous small smile. Use LEFTMOST calm Tato as the design reference. Improve the polished friendly product-mascot illustration, large clean shapes and warm cheeky expression. Shorten and round ears drastically: small round armadillo ears, NOT rabbit ears. Tato is relaxed, eyes half open with amused eyebrow and confident curved smile. Preserve hand-illustrated professional mascot finish of reference, smooth curved shapes, dimensional turquoise shading. Entire animal visible facing right in three-quarter side view, no text, no logos, no environment. Center on a transparent square canvas. Paws baseline at 84% image height, character occupies about 78% width, generous transparent margin. This is the FINAL master product art, not a concept sketch. Do not use existing code assets or geometric polygon style.”

**Atuação.** Edição da imagem-mestra numa grade 4 × 4, com dezesseis ilustrações do mesmo personagem. A primeira linha muda o olhar e levanta uma pata. A segunda abaixa o focinho e recolhe as patas. A terceira abre as três faixas da carapaça como capuz e encaixa a meia-máscara. A quarta abre o mini-terminal, alterna as patas no teclado e termina num meio sorriso. Fundo transparente, mesmo ângulo, tamanho e ponto de apoio. A instrução explicita que o personagem deve permanecer um tatu e nunca virar um humano ou uma bola com olhos.

**Recuperação.** Edição da imagem-mestra e da folha de atuação numa grade 3 × 2. O terminal fecha, a máscara baixa, o rosto relaxa e o capuz retorna à carapaça. Uma edição adicional removeu o fundo colorido que veio na primeira resposta. Os recortes finais usam o canal alfa transparente.

## Validação visual

A imagem-mestra foi examinada no popup de 390 px antes da geração das poses. As capturas finais do popup mostram Tranquilo e Modo Hacker com avisos imediatamente abaixo. O vídeo de demonstração usa um perfil de teste e registros explicitamente fictícios.
