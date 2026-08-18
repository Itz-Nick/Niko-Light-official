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
* Sistema atual de upgrades temporariamente desativado para futura reformulação
* Formações manuais para o exército selecionado: linha (`L`), V (`V`), quadrado (`Q`) e defensiva (`B`)
* Formações manuais são preservadas durante o movimento
* Tropas sem ordens não devem realizar movimentação espontânea
* Modo História como campanha de 10 fases (Fases 1–10 jogáveis)
* Desbloqueio progressivo de fases: concluir uma fase libera a próxima
* Sistema de 3 estrelas por fase, com critérios próprios de cada missão e melhor resultado preservado
* Fases 1–10: Escolta Real, O Primeiro Cerco, Flechas na Névoa, Duas Frentes, Linha de Ferro, Emboscada, Minas Perdidas, O Cerco, Marcha do Exército e Senhor da Ruína
* Fase 10 com confronto contra o Boss Senhor da Ruína: entidade própria com barra de vida, IA própria, ataque normal e habilidade especial de área com aviso prévio
* Ao concluir a Fase 10, a primeira campanha é marcada como concluída com tela de final específica
* Cenários (biomas) que mudam conforme o avanço das waves
* Foco em estratégia e controle macro

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
* [ ] Sistema de upgrades completo
* [ ] Tela de progressão de tropas/castelo/economia
* [x] Progressão
* [ ] Melhorias de performance
* [x] Menu principal
* [x] Seleção de modo de jogo
* [x] Pausa
* [x] Configurações
* [x] HUD
* [x] Música (menu e batalha)
* [x] Cenários por wave
* [x] Modo História (Fases 1–10 — Escolta Real, O Primeiro Cerco, Flechas na Névoa, Duas Frentes, Linha de Ferro, Emboscada, Minas Perdidas, O Cerco, Marcha do Exército, Senhor da Ruína)
* [x] Modo História (sistema de estrelas, desbloqueio e persistência de campanha)
* [x] Modo História (Fase 10 — Boss)
* [x] Conclusão da primeira campanha
* [ ] Modo Aventuras
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
├── input/                   # teclado, mouse e câmera
├── entities/                # unidades, castelo, minas e carroça
├── economy/                 # ouro e economia
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
* Upgrades atuais temporariamente desativados para futura reformulação
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
* Áudio: efeitos sonoros procedurais (recrutamento, combate, flechas, torres, muralhas, castelo, waves e interface), sons ambientais por bioma e volume de interface/ambiente dedicados
* Biomas: Campo (1–5), Deserto (6–10), Neve (11–15), Vulcânico (16–20), Ruínas (21–25) e Vazio Cósmico (26+) com transições durante a preparação
* Alvo inicial de performance: 500 unidades simultâneas
