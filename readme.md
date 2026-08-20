# NikoLight ⚔️

Jogo de estratégia em pixel art focado no controle de exércitos massivos.

O jogador controla suas tropas em batalhas em tempo real, enfrenta ondas de inimigos, administra recursos e precisa proteger seu castelo.

## 🎮 Gameplay

* Controle de grandes grupos de unidades
* Quatro tipos de tropas: Cavaleiros (⚔️), Arqueiros (🏹), Tanques (🛡️) e Campeões (⭐)
* Combate em tempo real
* Arqueiros com ataque à distância real, flechas visíveis e manutenção de distância
* Arqueiros priorizam alvos apropriados e podem atacar estruturas à distância
* Tropas possuem papéis distintos de frente, retaguarda e elite
* Inimigos organizados em waves com composição e dificuldade progressiva por tiers
* Inimigos utilizam táticas de grupo, incluindo formação de avanço e flancos em tiers mais avançados
* Castelo central fortificado com muralhas segmentadas, quatro portões e quatro torres defensivas
* Inimigos podem entrar pelos portões ou romper segmentos das muralhas
* Minas de ouro ficam dentro da área fortificada
* Economia limitada, com geração de ouro durante a batalha e pausada durante a preparação
* Ouro obtido através de minas, eliminações e recompensas de wave
* Preparação de 30s entre waves, com opção de iniciar a próxima wave antecipadamente
* Sistema de progressão durante a partida (Infinito e Aventuras): Castelo com 5 níveis, 3 níveis por classe de tropa, construções (Casa, Mercado e Torre) e Diamantes
* Seleção de dificuldade no modo Infinito: Fácil (🟢), Médio (🟡) e Difícil (🔴), além de Hardcore (⚫ 🔒) bloqueado como "EM DESENVOLVIMENTO"; cada dificuldade altera a curva das waves (HP, dano, velocidade, alcance, cooldown, defesa e quantidade dos inimigos, além da composição e dos tiers) e o estado inicial da partida
* Modo Infinito em Fácil: tropas iniciais + 1 Campeão, com 1 Mercado e 2 Casas automáticos próximos ao castelo e crescimento mais lento; em Médio: tropas padrão + 2 Casas automáticas; em Difícil: apenas tropas padrão, sem construções nem Campeão iniciais, com inimigos mais fortes, numerosos e avançando de tier mais cedo
* Formações manuais para o exército selecionado: linha (`L`), V (`V`), quadrado (`Q`) e defensiva (`B`)
* Formações manuais são preservadas durante o movimento
* Tropas sem ordens não devem realizar movimentação espontânea
* Modo História como campanha de 10 fases (Fases 1–10 jogáveis)
* Desbloqueio progressivo de fases: concluir uma fase libera a próxima
* Sistema de 3 estrelas por fase, com critérios próprios de cada missão e melhor resultado preservado
* Fases 1–10: Escolta Real, O Primeiro Cerco, Flechas na Névoa, Duas Frentes, Linha de Ferro, Emboscada, Minas Perdidas, O Cerco, Marcha do Exército e Senhor da Ruína
* Fase 10 com confronto contra o Boss Senhor da Ruína: entidade própria com barra de vida, IA própria, ataque normal e habilidade especial de área com aviso prévio
* Ao concluir a Fase 10, a primeira campanha é marcada como concluída com tela de final específica
* Modo Aventuras: abre um mapa do continente com regiões (Fase 1 jogável, Fases 2–3 em desenvolvimento, regiões misteriosas sob névoa), clique em região para jogar, mapa explorável maior que a tela, névoa animada em áreas desconhecidas, dois castelos (aliado e inimigo), 5 cavaleiros iniciais, limite de 50 tropas (+10 por Casa construída), minas neutras/inimigas que precisam ser capturadas por tropas aliadas, economia própria (tempo + minas capturadas, sem waves), defesa do castelo inimigo (8 cavaleiros, 3 arqueiros e 2 tanques que reagem a tropas próximas), vitória/derrota por destruição de castelo, retorno ao continente após o resultado com desbloqueio das Fases 2–3 e progresso persistido em `localStorage`
* Cenários (biomas) que mudam conforme o avanço das waves
* Foco em estratégia e controle macro
* Menu principal com cards laterais: Criativo (🛠️, desbloqueado, à esquerda) e COOP (🤝 🔒, bloqueado, à direita); seleção de modos com três modos principais (Infinito, História e Aventuras)

## 🎵 Música e Som

* Trilha própria para o menu e para a batalha
* Transição suave entre músicas através de fade
* Música procedural utilizando Web Audio API
* Suporte opcional a `public/audio/menu-music.ogg`
* Suporte opcional a `public/audio/battle-music.ogg`
* Arquivos de áudio externos substituem automaticamente a trilha procedural quando disponíveis
* Intensidade da música reduzida durante a preparação e normal em batalha
* Efeitos sonoros procedurais (Web Audio API) para recrutamento, combate, flechas, torres, muralhas, castelo, waves e interface
* Sons de interface com volume próprio (categoria Interface)
* Sons ambientais leves por bioma (vento, pássaros, fogo, ambiente abstrato), com volume próprio e opção de desligar
* Mixagem em categorias independentes (Música, SFX, Interface, Ambiente) respeitando as configurações persistidas
* Efeitos com limitação de frequência (cooldown) para evitar spam com centenas de unidades
* O jogo funciona sem nenhum asset externo (tudo é gerado proceduralmente)

## 🕹️ Controles

| Ação                        | Controle                    |
| --------------------------- | --------------------------- |
| Selecionar unidade / grupo  | Clique esquerdo ou arrastar |
| Mover tropas selecionadas   | Clique direito              |
| Recrutar cavaleiros         | Tecla `E`                   |
| Recrutar arqueiros          | Tecla `F`                   |
| Recrutar tanques            | Tecla `C`                   |
| Recrutar campeão            | Tecla `G`                   |
| Formação em linha           | Tecla `L`                   |
| Formação em V               | Tecla `V`                   |
| Formação quadrada           | Tecla `Q`                   |
| Formação defensiva          | Tecla `B`                   |
| Começar wave antes do tempo | Botão no HUD                |
| Câmera / zoom               | WASD / roda do mouse        |
| Pausar                      | `Esc`                       |

> Os controles ainda podem mudar durante o desenvolvimento.

## 🎯 Objetivo

Derrotar os inimigos, proteger o castelo e avançar pelas waves.

## 🗺️ Roadmap

* [x] Protótipo inicial
* [x] Sistema de movimentação
* [x] Combate
* [x] Sistema de waves
* [x] Castelo e defesa
* [x] Diferentes unidades
* [x] Sistema de progressão completo (Castelo 5 níveis, tropas 3 níveis, construções, Diamantes)
* [x] Tela de progressão de tropas/castelo/economia
* [x] Progressão
* [ ] Melhorias de performance
* [x] Menu principal
* [x] Seleção de modo de jogo
* [x] Seleção de dificuldade no modo Infinito (Fácil/Médio/Difícil + Hardcore bloqueado)
* [x] Pausa
* [x] Configurações
* [x] HUD
* [x] Música (menu e batalha)
* [x] Cenários por wave
* [x] Modo História (Fases 1–10 — Escolta Real, O Primeiro Cerco, Flechas na Névoa, Duas Frentes, Linha de Ferro, Emboscada, Minas Perdidas, O Cerco, Marcha do Exército, Senhor da Ruína)
* [x] Modo História (sistema de estrelas, desbloqueio e persistência de campanha)
* [x] Modo História (Fase 10 — Boss)
* [x] Conclusão da primeira campanha
* [x] Modo Aventuras (continente, Fase 1 jogável, minas capturáveis, defesa do castelo inimigo, persistência)
* [x] Modo Aventuras (casas, mercado, torres e progressão de tropas/castelo)
* [ ] Modo Aventuras (expansão: rios, fases múltiplas jogáveis)
* [x] Modo Criativo (fundação: card desbloqueado e tela própria, sem sandbox completa)
* [x] Modo Criativo (editor de batalhas: mapa, times AZUL/VERMELHO separados por lado com restrição de posicionamento, tropas, estruturas e Boss com identidade de time, rotação de estruturas via tecla `R`, mover/remover, câmera livre, validação e transição 3-2-1 para batalha com IA)
* [x] Modo Criativo (batalha com IA dos dois times, captura de minas, economia, recrutamento, vitória/derrota, resultado e tentar novamente/editar)
* [x] Modo Criativo (polish: contagem 3-2-1 com banner "⚔️ BATALHA!" em fade, HUD do espectador com cronômetro/contagem de tropas/dica de câmera/botão de pausa, velocidade da simulação 1x/2x/4x, título "CRIATIVO — PAUSADO", e resultado com perdas + realce da cor do vencedor)
* [x] Modo COOP (card bloqueado com cadeado e microinteração; sem gameplay)
* [ ] Modo COOP (cooperativo)
* [x] Menu principal com identidade neon (fundo de energia/plasma, logo, parallax sutil)
* [ ] Conteúdo adicional

## 🛠️ Tecnologias

Stack atual:

* **TypeScript** — linguagem principal
* **Canvas 2D API** — renderização do jogo
* **Vite** — desenvolvimento e build

A stack prioriza:

* boa performance com muitas unidades;
* desenvolvimento rápido;
* código organizado;
* facilidade para expandir o projeto.

> A stack pode ser alterada futuramente caso exista uma justificativa técnica clara relacionada a performance ou gameplay.

## 📁 Estrutura

```text
src/
├── main.ts                  # bootstrap
├── config.ts                # constantes de balanceamento
├── types.ts                 # tipos compartilhados
├── core/                    # loop do jogo, grid espacial e movimento
├── camera/                  # câmera com pan e zoom
├── combat/                  # alvos, ataques, dano, morte e projéteis
├── waves/                   # spawn, composição por tier e táticas inimigas
├── story/                   # missões do modo História
├── adventure/               # modo Aventuras (continente, territórios, névoa, nível, progresso)
├── input/                   # teclado, mouse e câmera
├── entities/                # unidades, castelo, minas e carroça
├── economy/                 # ouro e economia
├── progression/             # progressão de castelo/tropas e construções
├── settings/                # configurações persistidas
├── audio/                   # áudio e música procedural
├── biomes/                  # cenários por wave
├── ui/                      # telas, HUD e painéis
└── render/                  # renderização Canvas 2D
```

## 🚧 Status

**Protótipo jogável avançado**

* Seleção por clique/retângulo, movimentação por clique direito e formações `L`/`V`/`Q`/`B`
* Quatro tipos de tropas com teclas `E`/`F`/`C`/`G`
* Arqueiros com ataque à distância e flechas visíveis com rastro
* Ouro proveniente de minas e recompensas de combate, com geração pausada durante a preparação
* Waves com dificuldade e composição progressivas
* Castelo com HP, muralhas segmentadas, quatro portões e quatro torres defensivas
* Inimigos podem entrar pelos portões ou romper muralhas
* Preparação de 30s entre waves com opção de iniciar imediatamente
* Progressão na partida (Infinito e Aventuras): painel `📈` no HUD abre a progressão; Castelo com 5 níveis (custos 0/200/400/800/1500 ouro, +250/500/900/1500 HP, torres mais rápidas ×0.85/0.72/0.6/0.5 e limite de construções 6/10/16/22/30); tropas com 3 níveis por classe (Cavaleiro, Arqueiro e Tanque por ouro; Campeão níveis 2–3 por Diamante 💎); novas unidades nascem no nível atual e unidades existentes são atualizadas na hora; upgrades são temporários (duram a partida)
* Construções posicionadas pelo jogador no mapa (prévia verde/vermelha, alcance visível em torres, clique esquerdo coloca, clique direito/`Esc` cancela): Casa (60 ouro, +10 limite de tropas), Mercado (120 ouro, +200 ouro por minuto) e Torre (500 ouro, atira nos inimigos com dano 25 e alcance 320; cooldown afetado pelo nível do Castelo); não podem ser colocadas sobre tropas/construções/castelo/minas/estrada do Aventuras/nas bordas do mapa e respeitam o limite de construções do Castelo; todas possuem HP e área física — bloqueiam a passagem de tropas e inimigos, podem ser atacadas e destruídas pelos inimigos (que atacam a construção que bloqueia seu caminho) e, ao serem destruídas, param de bloquear, de gerar bônus/renda e de contar no limite de construções (ficando como escombros)
* Limite de tropas de 50 +10 por Casa nos modos Infinito e Aventuras (HUD `X/Y`); Diamante 💎 a cada 15 waves no modo Infinito
* Seleção de dificuldade no Infinito: tela "Escolha a dificuldade" entre a seleção de modos e o início da partida (4 cards: 🟢 Fácil, 🟡 Médio, 🔴 Difícil e ⚫ Hardcore 🔒); dificuldade guardada no estado da partida e mantida ao reiniciar; a curva de dificuldade é uma camada sobre o sistema de waves existente via `CONFIG.difficulty` (`enemyScaling` para HP/dano/velocidade/alcance/cooldown, `spawnScaling` para a quantidade, `compositionScaling` para o avanço de tiers e `defenseGrowth` para resistência); as construções iniciais usam o sistema real de construções (contam no limite, têm HP e podem ser destruídas) e o Campeão inicial respeita a progressão atual
* Movimentação automática geral limitada para evitar movimento espontâneo; comandos manuais e formações continuam funcionando
* Modo História: campanha de 10 fases com Fases 1–10 jogáveis; seleção de fases com estados bloqueada/disponível/concluída, estrelas por fase e progresso persistido em `localStorage`; campanha marcada como concluída após a Fase 10
* Fase 1 "Escolta Real": 10 cavaleiros, carroça de ouro, tutorial contextual e condições próprias de vitória/derrota
* Fase 2 "O Primeiro Cerco": defesa do castelo contra ataques de várias direções (10 cavaleiros e 5 tanques)
* Fase 3 "Flechas na Névoa": uso tático de arqueiros na retaguarda (10 cavaleiros e 5 arqueiros, bioma neve)
* Fase 4 "Duas Frentes": defender dois postos simultaneamente, dividindo o exército (10 cavaleiros, 5 arqueiros e 1 campeão)
* Fase 5 "Linha de Ferro": linha de tanques à frente com arqueiros atrás contra inimigos resistentes (8 cavaleiros, 5 arqueiros e 5 tanques)
* Fase 6 "Emboscada": ataques de múltiplas direções terminando em ataque combinado (10 cavaleiros, 5 arqueiros, 5 tanques e 1 campeão)
* Fase 7 "Minas Perdidas": proteger múltiplos pontos de mineração espalhados pelo mapa enquanto o inimigo avança contra o castelo (10 cavaleiros, 5 arqueiros, 2 tanques e 1 campeão)
* Fase 8 "O Cerco": cerco completo ao castelo com ataques aos quatro portões e tentativas de romper as muralhas (12 cavaleiros, 6 arqueiros, 3 tanques e 1 campeão)
* Fase 9 "Marcha do Exército": missão em etapas (marcha, defesa, ataque, defesa e batalha final) combinando todas as mecânicas (12 cavaleiros, 6 arqueiros, 4 tanques e 1 campeão)
* Tela especial ao concluir a Fase 9, criando clima para o Boss e desbloqueando a Fase 10
* Fase 10 "Senhor da Ruína": batalha preparatória com grupos inimigos de várias direções, apresentação do Boss com mensagem e barra de vida própria, e confronto final onde o Boss avança, ataca tropas/estruturas/castelo e usa o Impacto da Ruína (dano em área com aviso prévio "⚠️ ATAQUE DA RUÍNA", reação possível e cooldown)
* Tela de conclusão da campanha ao derrotar o Boss, com estrelas, desempenho e a indicação de fim da primeira campanha
* Entidade do Boss implementada como unidade própria (`boss`) independente da Fase 10, pronta para reutilização futura no modo Infinito
* Introdução curta antes de cada fase, com a missão e o objetivo
* Menu principal, seleção de modos, pausa, controles e configurações persistidas
* HUD com ouro, wave, tropas, castelo e informações de combate
* Polish de UI/UX: estado de wave visível (batalha/preparação), contador de preparação destacado nos últimos 10s, feedbacks visuais de seleção, movimento, formações, ouro, recrutamento, combate (flash de dano, números, morte), minas, castelo, muralhas e torres
* Polish de UI/UX: HUD em blocos (Recursos, Wave, Exército e Castelo), menu principal refinado, seleção de modos com progresso dinâmico da campanha, seleção de fases com barra de progresso, total de estrelas e cards com número/nome/objetivo/estado (bloqueada/disponível/próxima/concluída), telas de vitória com objetivo e estatísticas, tela de derrota com estatísticas e incentivo, configurações organizadas em categorias (Áudio, Interface, Jogabilidade) e controles em grupos, e silhuetas distintas por classe de tropa (cavaleiro angular, arqueiro triangular, tanque quadrado com escudo e campeão maior e elaborado) com mesma forma entre jogador e inimigo
* Polish de UI/UX: fundo animado procedural nas telas de menu/modos/história (chamas com variação gradual de tonalidade na paleta quente, brasas e poeira subindo), transições suaves entre telas (fade-out + fade-in com variantes para vitória e derrota), microanimações de hover/press nos botões, overlay de transição de bioma com ícone, cor do bioma e animação de entrada, e detalhes sutis no castelo (fumaça) e nas torres (brilho pulsante)
* Polish de UI/UX (identidade neon do menu): fundo procedural de energia/plasma (orbs de luz, ondas de plasma com glow, partículas luminosas com profundidade, variação de intensidade e brilho aditivo, fonte de energia inferior com pulsação e mudança lenta de tonalidade), parallax sutil do fundo seguindo o mouse, logo NikoLight com símbolo de raio, gradiente, glow pulsante e reflexo de luz ocasional, painel de vidro com blur leve, cards laterais no menu principal (Criativo à esquerda com identidade âmbar e engrenagens girando lentamente; COOP à direita bloqueado com cadeado e glow vermelho no hover), microinteração do cadeado do COOP (shake horizontal + balanço do cadeado + toast "EM DESENVOLVIMENTO" e som de bloqueio) e progresso real da campanha no card História (`X / 10 fases` + barra de segmentos)
* Áudio: efeitos sonoros procedurais (recrutamento, combate, flechas, torres, muralhas, castelo, waves e interface), sons ambientais por bioma e volume de interface/ambiente dedicados
* Biomas: Campo (1–5), Deserto (6–10), Neve (11–15), Vulcânico (16–20), Ruínas (21–25) e Vazio Cósmico (26+) com transições durante a preparação
* Modo Aventuras: card disponível na seleção de modos; abre o mapa do continente (Fase 1 jogável; Fases 2–3 reveladas como "EM DESENVOLVIMENTO" após concluir a Fase 1; regiões misteriosas sob névoa animada); mapa 4000×4000 com câmera expandida, fundo procedural, névoa animada revelada por unidades (atrás de tropas/estruturas), 12 territórios com nomes e estados desconhecido/revelado, castelo inimigo vermelho atacável por tropas paradas em alcance, defesa do castelo inimigo com 8 cavaleiros/3 arqueiros/2 tanques que permanecem próximos ao castelo e reagem a tropas próximas (podem perseguir e destruir o castelo aliado), minas começam neutras ou inimigas e são capturadas ao serem ocupadas por tropas aliadas (apenas minas capturadas geram ouro), HUD próprio (modo, objetivo, castelo inimigo), recrutamento apenas de cavaleiros (cap 50), telas de vitória/derrota com tempo, minas capturadas e territórios revelados, retorno ao continente após o resultado, desbloqueio das Fases 2–3 e progresso persistido em `localStorage` (`nikolight-adventure`)
* Barreira invisível corrigida na origem: o clamp de movimento usava as dimensões do mundo Infinito (3000) em vez das dimensões do mundo Aventuras (4000), impedindo tropas de alcançar o castelo inimigo em (3200,800); `updateUnits` agora recebe as dimensões do mundo ativo
* Polish visual do mapa do continente (somente apresentação, lógica preservada): fundo pré-renderizado orgânico (oceano com gradiente e profundidade, massas de terra irregulares, campos, florestas, cadeia de montanhas com neve, lago, rio sinuoso e trilha antiga), névoa viva em múltiplas camadas (máscara pré-renderizada com bordas irregulares e fade, nuvens e brumas que derivam lentamente, partículas de poeira e pontos luminosos, vinheta), regiões com marcadores personalizados (halo pulsante na fase disponível, brilho e ✅ na concluída, cadeado 🔒 e "EM DESENVOLVIMENTO" integrados ao mapa nas fases 2–3), estradas de campanha com traçado curvilíneo, textura, glow e animação sutil, rio com brilho de água animado, header e botão voltar em estilo vidro neon coerente com o menu e transição de revelação com dissolve quando uma área é descoberta
* Modo Criativo (editor de batalhas): tela própria "CRIE SUA HISTÓRIA" com entrada no editor; mapa com terreno, árvores e pedras reutilizando o motor existente (bioma campo 3000x3000), linha central vertical animada com áreas AZUL (esquerda) e VERMELHA (direita) e quadrado de área central; HUD inferior com indicador "TIME ATUAL" (🔵 AZUL / 🔴 VERMELHO com realce neon do time ativo), seletor 🔵 AZUL / 🔴 VERMELHO (contadores de entidades), paleta de tropas (🪖 Cavaleiro, 🏹 Arqueiro, 🛡️ Tanque, ⭐ Campeão, 👑 Boss), paleta de estruturas (🏰 Base, 🏠 Casa, 🏪 Mercado, 🗼 Torre, ⛩️ Muralha, ⛏️ Mina), botão 🗑️ Remover e botão ▶ COMEÇAR BATALHA; colocar (clique com item da paleta selecionado, com validação de sobreposição, limites do mapa e lado do time, fantasma do item com prévia transparente da posição/rotação e feedback verde (válido) / vermelho (inválido)), rotação de estruturas (tecla `R` gira a prévia em 90° durante o posicionamento; muralhas ficam na horizontal ou vertical conforme a rotação e o fantasma acompanha), identidade visual de time (anel + marcador acima das unidades, aura luminosa no Boss e anel + marcador nas estruturas base/casa/mercado/torre, nas cores do time), selecionar (clique), mover (arrastar entidade ou clique direito, limitado ao lado do time) e remover durante a preparação; câmera livre com zoom (roda) e pan (WASD/setas ou arrastar no vazio); ao iniciar a batalha valida que ambos os times possuem pelo menos uma entidade e que existe ao menos uma entidade de combate (unidade ou base/torre), bloqueia a edição e executa a transição 3-2-1 com animação para o estado espectador BATALHA; cenário mantido em memória (`CreativeScenario` com mapa + entidades por time/tipo/posição/rotação/estado), sem persistência
* Modo Criativo (batalha simulada com IA dos dois times): após o 3-2-1, o jogador vira espectador (câmera com zoom/pan, pausa com `Esc`) e ambos os times passam a ser controlados por IA que reutiliza os sistemas existentes de combate, movimento, formações, squads, torres, muralhas, minas, castelos e economia; cada time decide por intervalos (~0,5 s) seguindo as prioridades DEFENDER (castelo ameaçado → tanques/cavaleiros/campeões na frente e arqueiros atrás) → CAPTURAR MINAS (minas neutras/inimigas viram do time ao ser ocupadas, com progresso de captura) → ATACAR (base inimiga primeiro, depois torres e minas; muralhas bloqueando o caminho são atacadas antes) e também defende minas próprias ameaçadas; divisão do exército em grupos (defesa, captura e ataque) com objetivos estáveis (evita troca constante), Boss (👑) usável pelos dois times com comportamento existente (alvos e habilidades por time oposto), torres atacam o time oposto, economia própria por time (base + minas capturadas + mercados geram ouro) com recrutamento automático quando há castelo e recursos (limite de tropas baseado em casas, custos existentes), e vitória por destruição de castelo inimigo (ou eliminação quando não há castelos); ao final, tela "⚔️ BATALHA FINALIZADA" com vencedor (🔵 AZUL VENCEU / 🔴 VERMELHO VENCEU), tempo, tropas restantes e inimigos derrotados por time, e botões TENTAR NOVAMENTE (reinicia exatamente o cenário), EDITAR CENÁRIO (volta à preparação com o mesmo mapa) e MENU PRINCIPAL; sem multiplayer/online/save/ranking. Polish do espectador: transição 3-2-1 com banner "⚔️ BATALHA!" com fade e impacto visual, HUD discreto do espectador com tempo de simulação, contagem de tropas 🔵/🔴, dica de controles (arrastar/WASD, zoom, Esc), botão de pausa e velocidade da simulação ▶ 1x/2x/4x (aplica-se só à simulação, não à câmera), pausa com título "CRIATIVO — PAUSADO", e tela de resultado com Tempo, Tropas restantes, Perdas e Inimigos derrotados por time com o nome do vencedor destacado na cor do time; o cenário original nunca é alterado pela simulação
* Alvo inicial de performance: 500 unidades simultâneas
