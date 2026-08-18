# AGENTS.md

## 🧠 Contexto do projeto

Este projeto é o **NikoLight**, um jogo de estratégia em pixel art focado em batalhas em tempo real com grandes quantidades de unidades simultaneamente.

O jogo está em **desenvolvimento ativo** e possui um modo Infinito funcional, um modo História com a Fase 1 jogável e uma arquitetura preparada para futuras expansões.

A prioridade é construir uma experiência estratégica clara, estável e escalável, mantendo o código simples e fácil de expandir.

---

## 🎯 Objetivo do agente

Você é um agente de desenvolvimento trabalhando neste projeto através do OpenCode.

Sua função é:

* analisar o código existente;
* implementar funcionalidades solicitadas;
* corrigir bugs;
* melhorar performance;
* manter o código organizado;
* preservar funcionalidades existentes;
* evitar regressões.

---

## ⚠️ Regra mais importante: código é a fonte definitiva

A ordem de autoridade é:

```text
Código atual
↓
AGENTS.md
↓
README.md
```

O README e este arquivo descrevem o estado e as intenções conhecidas do projeto, mas **não devem ser tratados como prova de que uma funcionalidade existe ou funciona exatamente daquela maneira**.

Antes de modificar qualquer sistema:

1. Leia os arquivos relevantes.
2. Confirme como o sistema realmente funciona.
3. Identifique dependências e pontos de integração.
4. Verifique se a funcionalidade já existe parcialmente.
5. Só então implemente a alteração.

Nunca invente:

* arquivos;
* funções;
* classes;
* sistemas;
* APIs;
* comportamentos que não foram encontrados no projeto.

Quando documentação e código divergirem, considere o **código atual como verdadeiro** e informe a divergência quando ela for relevante.

---

## 🛠️ Tecnologias

Stack atual:

* **TypeScript**
* **Canvas 2D API**
* **Vite**

Essas tecnologias devem ser preservadas por padrão.

Antes de introduzir uma nova tecnologia ou biblioteca:

1. verifique se ela é realmente necessária;
2. verifique se o problema pode ser resolvido com as ferramentas atuais;
3. considere o impacto na arquitetura e performance;
4. explique brevemente a justificativa.

Não substituir a stack atual sem uma razão técnica clara.

---

## 🧩 Arquitetura

Priorizar:

* separação de responsabilidades;
* baixo acoplamento;
* código reutilizável;
* sistemas independentes;
* facilidade de manutenção;
* simplicidade.

Evitar:

* concentrar toda a lógica em um único arquivo;
* abstrações prematuras;
* sistemas excessivamente genéricos;
* duplicação de lógica.

Não criar uma estrutura de pastas complexa apenas por aparência.

---

## ⚡ Performance

Performance é uma prioridade importante do projeto.

O objetivo atual é suportar aproximadamente **500 unidades simultâneas**, podendo crescer futuramente.

Ao implementar sistemas relacionados a:

* unidades;
* movimentação;
* combate;
* colisões;
* busca de inimigos;
* projéteis;
* partículas;
* renderização;
* IA;

considere sempre o impacto no game loop.

Evitar:

* loops desnecessários;
* cálculos repetidos;
* buscas globais por frame;
* criação excessiva de objetos;
* processamento duplicado;
* estruturas que não escalam.

Não otimizar prematuramente sem motivo, mas também não introduzir soluções obviamente ruins para grandes quantidades de entidades.

---

## 🧱 Alterações no código

Ao implementar uma tarefa:

* faça a menor alteração necessária;
* preserve funcionalidades existentes;
* reutilize sistemas existentes quando apropriado;
* evite reescrever arquivos inteiros sem necessidade;
* não altere sistemas não relacionados à tarefa.

Antes de remover ou substituir uma implementação existente, verifique onde ela é utilizada.

Não transformar uma pequena tarefa em uma grande refatoração sem necessidade.

---

## 🐛 Correção de bugs

Ao corrigir um bug:

1. identifique a causa;
2. corrija a causa em vez de apenas esconder o problema;
3. verifique efeitos colaterais;
4. valide a funcionalidade afetada;
5. confirme que sistemas relacionados continuam funcionando.

Não introduzir soluções provisórias silenciosas.

Quando uma limitação temporária for intencional, respeitá-la em vez de tentar reativar o comportamento antigo.

---

## 🪖 Estado atual da movimentação e IA

### Importante

A formação e a movimentação automática geral das tropas foram **intencionalmente limitadas/desativadas** após problemas de movimento espontâneo.

Atualmente:

* comandos manuais do jogador continuam funcionando;
* formações `L`, `V`, `Q` e `B` continuam funcionando;
* squads continuam funcionando;
* tropas sem ordem não devem começar a se mover espontaneamente;
* combate deve continuar funcionando sem criar perseguição ou reposicionamento automático indevido.

**Não reativar ou reconstruir automaticamente a formação/movimentação global das tropas sem uma solicitação explícita.**

Se uma tarefa futura pedir uma nova IA de formação, tratar isso como um sistema novo e avaliar sua integração cuidadosamente.

---

## 📦 Dependências

Não adicionar bibliotecas sem necessidade.

Antes de instalar uma nova dependência, verificar:

* se ela realmente é necessária;
* se já existe solução no projeto;
* se o problema pode ser resolvido com TypeScript/Canvas/Web APIs.

Evitar dependências pesadas para funcionalidades simples.

---

## 🧪 Testes

Sempre que possível, validar:

* `tsc --noEmit`;
* `vite build`;
* execução do jogo;
* ausência de erros no console;
* funcionamento da mecânica alterada.

Quando não for possível executar o jogo, declarar isso claramente.

Não afirmar que algo foi testado se não foi.

---

## 📝 Código

Priorizar código:

* legível;
* simples;
* previsível;
* tipado;
* modular.

Evitar `any` quando estiver usando TypeScript.

Não adicionar comentários óbvios.

Comentários devem explicar decisões, limitações ou comportamentos que não sejam evidentes pelo código.

---

## 🔄 Antes de implementar

Antes de começar uma tarefa complexa:

1. leia `README.md`;
2. leia este `AGENTS.md`;
3. entenda a estrutura atual;
4. identifique os arquivos envolvidos;
5. verifique se a funcionalidade já existe parcialmente;
6. analise possíveis efeitos colaterais;
7. planeje a alteração;
8. implemente somente o necessário.

Não recriar sistemas já existentes.

---

## ✅ Depois de implementar

Após finalizar:

* verifique os arquivos alterados;
* procure erros de compilação;
* valide a funcionalidade solicitada;
* procure efeitos colaterais;
* remova código morto introduzido pela tarefa;
* atualize o README quando houver mudança estrutural ou de gameplay relevante.

---

## 📚 README

O `README.md` descreve:

* conceito do jogo;
* gameplay;
* controles;
* roadmap;
* tecnologias;
* estrutura geral;
* estado conhecido do projeto.

O README deve ser atualizado quando mudanças importantes forem realizadas.

Não modificar o README para registrar pequenas alterações internas.

Quando uma afirmação do README ficar desatualizada, corrigi-la em vez de manter documentação incorreta.

---

## 🚫 Não fazer

Não:

* inventar funcionalidades existentes;
* inventar arquivos;
* trocar toda a arquitetura sem necessidade;
* instalar dezenas de dependências;
* substituir tecnologias sem motivo;
* apagar código funcional sem verificar dependências;
* reescrever todo o projeto para implementar uma pequena feature;
* implementar funcionalidades que não foram solicitadas;
* reativar sistemas deliberadamente desativados sem solicitação;
* adicionar complexidade apenas por antecipação.

---

## 🎮 Filosofia do projeto

O projeto deve priorizar:

1. **Jogabilidade**
2. **Estabilidade**
3. **Performance**
4. **Clareza e UX**
5. **Organização do código**
6. **Facilidade de expansão**
7. **Visual**

A arquitetura deve servir ao jogo, e não o contrário.
