# PISTA 84

Arcade brasileiro de corrida infinita em pixel art. Funciona no navegador, instala como PWA, tem celular como controle remoto e projetos nativos Android/iOS (Capacitor).

Visual 1.3: cidade no horizonte, árvores detalhadas, pista azul/branco e atlas de oito veículos em perspectiva. Veja a [direção de arte](docs/ART_DIRECTION.md) e a [composição renderizada](docs/screenshots/reference-scene.png).

## Sumário

- [Início rápido](#início-rápido)
- [Como jogar](#como-jogar)
- [Celular como controle](#celular-como-controle)
- [Android e iOS](#android-e-ios)
- [Testes e publicação](#testes-e-publicação)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Documentação](#documentação)

## Início rápido

Requer Node.js **24** (ambiente validado, inclusive para os testes SQL com `node:sqlite`).

```powershell
npm install
npm run build
npm start
```

Abra **http://localhost:4173**. O terminal também mostra o endereço da rede para acessar do celular. Use `PORT` para trocar a porta.

Edite `src/` e `web/` e rode `npm run build` de novo. `www/` e `dist/` são gerados; não os edite.

## Como jogar

| Ação | Teclado |
| --- | --- |
| Dirigir | ←/→ ou A/D |
| Acelerar | ↑ ou W |
| Frear | ↓, S ou espaço |
| Pausar | P ou Esc |

- O carro anda automaticamente. Colete galões verdes, evite o trânsito e não pare na pista.
- **Curvas empurram o carro para fora:** quanto mais forte a curva e maior a velocidade, mais você precisa esterçar ou frear. As curvas aparecem no horizonte e avançam até o carro, e o aviso de curva pisca quando é preciso frear.
- **Fora do asfalto** a grama te segura, levanta poeira e treme a tela; bater na barreira externa conta como colisão.
- **Checkpoint a cada 1 km** devolve 15% de combustível. A barra de progresso no HUD mostra o próximo checkpoint e a marca rosa indica seu recorde.
- A cada 25 metros você ganha uma moeda, salva em checkpoints, na pausa e no fim da corrida. Com o tempo o trânsito fica mais denso, passam a bloquear duas faixas de uma vez e as curvas ficam mais fechadas.
- Há uma segunda chance gratuita por corrida.
- Durante a corrida só aparecem pista, velocidade, distância, combustível e pausa. Garagem e opções ficam no menu inicial.
- O som é ativado no cabeçalho e a preferência é lembrada.

**Garagem:** oito veículos com desempenho, sprites e áudio distintos. O Bruto 4×4 aguenta duas colisões; as motos têm área de colisão menor, mas perdem mais aderência na chuva. Há cinco pinturas compráveis com moedas.

**Progresso:** exporte e importe o progresso pelo jogo. No site hospedado há backup manual por conta, com proteção contra conflitos de gravação. Restaurar um backup substitui os dados do aparelho.

**Celular:** pedais e setas na tela, em retrato ou paisagem. A inclinação é opcional, exige HTTPS e permissão, e tem calibração da posição neutra. O jogo solo instala como PWA e funciona offline depois da primeira visita. No iPhone, use Adicionar à Tela de Início.

## Celular como controle

1. Abra o jogo hospedado no computador e clique em **Controle no celular**.
2. Leia o QR no celular. No site privado, entre com a mesma conta nos dois aparelhos.
3. Aguarde a conexão, feche o modal no computador e inicie a corrida (ou toque em **Iniciar corrida** no controle).
4. Use setas e pedais, ou ative a inclinação.

- **Conexão:** o pareamento usa HTTP/D1. Os comandos usam WebRTC quando possível, com fallback HTTPS (o Safari começa pelo modo de compatibilidade), então não é preciso TURN. O relay WebSocket original continua em `/relay` como alternativa técnica.
- **Segurança:** o QR expira em 10 minutos e admite uma conexão. Não usa câmera nem microfone. Perda de sinal pausa a corrida; gere outro QR para reconectar.
- **iPhone:** abra o endereço HTTPS direto no Safari e leia um QR recém-gerado. A inclinação só pede acesso quando você toca no botão. A validação automatizada usa WebKit; o teste em aparelho físico ainda é necessário.
- **Execução local:** o Node mantém a sinalização em memória e troca `localhost` pelo endereço de rede detectado. Com várias interfaces, confira o endereço. O firewall deve liberar a porta na rede privada. Para usar sensores, sirva o Node atrás de HTTPS e defina `PUBLIC_ORIGIN` com a URL externa.
- O controle remoto no wrapper nativo usa a versão web até haver validação específica.

## Android e iOS

Os projetos estão em `android/` e `ios/`, com ícones e splash próprios.

```powershell
npm run native:sync
npm run native:android
# Em macOS com Xcode:
npm run native:ios
```

- Android exige JDK e Android SDK; iOS exige macOS e Xcode. Nenhum está disponível neste ambiente.
- Não há APK/AAB/IPA validado nem certificados de assinatura (NAT-01/NAT-02 no [roadmap](specs/09-roadmap.md)).
- Para regenerar ícones e splash a partir do SVG do projeto: `node scripts/native-assets.mjs` (requer Chromium do Playwright).

## Testes e publicação

```powershell
npm test
npx playwright install chromium webkit
npm run test:browser
```

- O build gera os assets web/nativos em `www/` e o Worker ESM em `dist/server/index.js`.
- O Worker serve o jogo, o pareamento e o backup. O Sites provisiona o binding D1 `DB` e aplica as migrações de `drizzle/`. Preserve o project ID em `.openai/hosting.json`.
- Para alterar o schema: edite `db/schema.ts`, rode `npm run db:generate` e inspecione a nova migração. Não edite migrações já aplicadas.
- Somente o gateway Sites deve fornecer identidade ao Worker; o Node local não aceita backup por cabeçalhos de identidade. Nenhum segredo fica no frontend. O cache offline cobre apenas assets, sem APIs ou tokens. A fonte Google Fonts é opcional, com fallback local.
- Pagamentos, anúncios e carteira premium ainda dependem de provedores e configuração comercial. O backup atual serve para progresso casual e não torna as moedas locais uma carteira segura para dinheiro real.

## Estrutura do projeto

| Caminho | Conteúdo |
| --- | --- |
| `src/`, `web/` | Código-fonte do jogo e da interface |
| `worker/`, `db/`, `drizzle/` | Worker (jogo, pareamento, backup), schema e migrações D1 |
| `server.mjs` | Servidor Node local |
| `scripts/` | Build e geração de assets nativos |
| `tests/` | Testes Node e Playwright |
| `android/`, `ios/` | Projetos nativos (Capacitor) |
| `www/`, `dist/` | Saída de build (gerada) |
| `specs/`, `docs/` | Especificações e documentação |

## Documentação

- **[Especificações do jogo — comece aqui](specs/README.md)**
- [Regras de jogo](specs/02-gameplay.md)
- [Veículos e economia](specs/03-vehicles-and-economy.md)
- [Pendências e critérios de aceite](specs/09-roadmap.md)
- [Direção de arte e prompts](docs/ART_DIRECTION.md)
- [Pendências (contratos, dependências e testes de conclusão)](docs/PENDENCIAS.md)

`docs/SPECS.md` e `docs/PENDENCIAS.md` são caminhos antigos; as definições canônicas estão em `specs/`.
