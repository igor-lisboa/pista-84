# PISTA 84

Arcade brasileiro de corrida infinita em pixel art. Funciona no navegador, instala como PWA, tem celular como controle remoto e projetos nativos Android/iOS (Capacitor).

Versão 1.4: visual arcade de pôr do sol (fontes Bungee e Chakra Petch, contornos duros e faixa quadriculada), 14 veículos, trânsito mais pesado, pontuação por ritmo, 7 idiomas e trilha sonora procedural. O código é todo em TypeScript. Veja a [direção de arte](docs/ART_DIRECTION.md) e a [composição renderizada](docs/screenshots/reference-scene.png).

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

Edite `src/` e `web/` e rode `npm run build` de novo. `www/` e `dist/` são gerados; não os edite. Todo o código é TypeScript: o Node 24 executa os `.ts` diretamente (apenas sintaxe apagável, imports com extensão `.ts`), o `tsc --noEmit` faz a checagem de tipos e o esbuild empacota o app do navegador (`src/app.ts` e `web/sw.ts` em `www/app.js` e `www/sw.js`) e o Worker.

## Configuração local (.env)

O arquivo `.env` na raiz é lido pelo servidor e pelo build. Use `.env.example` como modelo:

```dotenv
PISTA84_COINS=10000
PORT=4173
```

`PISTA84_COINS` define seu saldo ao abrir/recarregar o jogo e ao importar ou restaurar progresso, com prioridade sobre o saldo local e o backup no banco. Aceita inteiros não negativos, incluindo `0`. Deixe vazio para usar o saldo salvo. Compras e ganhos continuam alterando o saldo durante a sessão; recarregar reaplica o valor configurado. A leitura do backup não altera o registro no banco; salvar na nuvem continua sendo uma ação manual.

Depois de editar `.env`, reinicie `npm start`. Para gerar os arquivos web, nativos ou hospedados, rode `npm run build` novamente. No Worker, a variável de ambiente `PISTA84_COINS` pode sobrescrever o valor do build. Essa configuração vale para todos os jogadores desse ambiente. Apenas esse saldo é exposto ao navegador, por `GET /runtime-config.json` (servido pelo Node e pelo Worker e gravado em `www/` no build, para os apps nativos); o app busca esse arquivo ao iniciar. Não coloque segredos nele. O `.env` fica fora do Git.

## Como jogar

| Ação | Teclado |
| --- | --- |
| Dirigir | ←/→ ou A/D |
| Acelerar | ↑ ou W |
| Frear | ↓, S ou espaço |
| Iniciar / continuar | Enter |
| Pausar | P ou Esc |

- Segure ↑ / W ou ACELERAR para ganhar velocidade. Soltar o acelerador desacelera; o freio reduz a velocidade com mais força. Parar permite retomar a corrida sem game over.
- **Curvas empurram o carro para fora:** quanto mais forte a curva e maior a velocidade, mais você precisa esterçar ou frear. As curvas aparecem no horizonte e avançam até o carro, e o aviso de curva pisca quando é preciso frear.
- **Qualquer batida é fatal:** tocar em um carro do trânsito ou na barreira externa encerra a corrida na hora, sem limite de velocidade, sem vida e sem quique. A tela "VOCÊ BATEU!" mostra a velocidade do impacto. A outra forma de perder é ficar sem combustível.
- **Fora do asfalto** (a grama) a velocidade é puxada para 40 km/h em cerca de meio segundo, o motor quase não tem tração (10%), levanta poeira, treme a tela e o HUD avisa "FORA DA PISTA". Volte para o asfalto antes de acelerar de novo.
- **Checkpoint a cada 1 km** devolve 15% de combustível e zera o relógio do quilômetro (veja a pontuação). A barra de progresso no HUD mostra o próximo checkpoint e a marca ciano indica seu recorde. Latas de combustível na pista devolvem 32%.
- **Pontuação por ritmo:** cada metro vale pontos multiplicados pela velocidade média do quilômetro atual: `multiplicador = clamp(km/h médios ÷ 100, 0,2, 3,5)`, reiniciado a cada checkpoint. O HUD mostra os pontos e o multiplicador (×1,0 = 100 km/h de média). O fim da corrida mostra pontos e o melhor placar.
- **Moedas vêm da pontuação:** 1 moeda a cada 25 pontos. Elas são salvas a cada 5 s de corrida, na pausa, no fim da corrida e ao voltar ao menu.
- **Dificuldade progressiva:** ao longo dos primeiros quatro minutos (240 s) de corrida o trânsito fica mais frequente, recebe mais duplas e trios em faixas diferentes (sempre sobram ao menos duas faixas livres, no máximo 16 carros) e acelera gradualmente. A velocidade dos oponentes fica limitada a 82% da máxima do jogador e a 85% da máxima do próprio veículo. Os carros trocam de faixa quando há espaço, seguem o carro da frente e nunca se sobrepõem. Pausar também pausa essa progressão.
- **Velocidade e distância usam a mesma medida:** a 120 km/h constantes, você percorre 2 km por minuto de simulação. A câmera mais próxima do chão reforça a sensação de velocidade sem multiplicar a quilometragem.
- Há uma segunda chance gratuita por corrida (3 s de invencibilidade).
- Durante a corrida só aparecem pista, velocidade, distância, pontos, combustível e pausa (barra superior). Garagem, opções e idioma ficam no menu inicial.
- **Som:** vem ligado, mas o navegador só libera o áudio no primeiro toque ou tecla. Um único botão em Opções liga/desliga música, motor e efeitos, e a preferência é lembrada. A música é procedural (Web Audio, sem arquivos): um loop calmo para menu/pausa (74 bpm) e três faixas de corrida (Neon Highway 132 bpm, Turbo Rush 150 bpm, Sunset Drive 118 bpm), uma sorteada por corrida, nunca a mesma duas vezes seguidas.
- **Idiomas:** português (Brasil), English, português (Portugal), français, italiano, 日本語 e Deutsch, em Opções. O padrão vem de `navigator.languages`; idioma desconhecido cai em inglês. As traduções ainda não foram revisadas por falantes nativos.

**Garagem:** 14 veículos com desempenho e áudio distintos. Os carros comuns se desbloqueiam com moedas; os dois PREMIUM (Veloce GT, R$ 29,90, e Raio 1000, R$ 19,90) só podem ser comprados com dinheiro real por meio da interface `CashStore` (`src/ui/store.ts`). Nenhum provedor de pagamento está conectado: a loja padrão informa "indisponível" e o jogo mostra um aviso. As motos têm área de colisão menor, mas perdem mais aderência na chuva. Os seis veículos novos (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS e Maverick GT) usam sprites pixel art procedurais, ainda sem arte de atlas. Há cinco pinturas compráveis com moedas.

**Progresso:** exporte e importe o progresso pelo jogo. No site hospedado há backup manual por conta, com proteção contra conflitos de gravação. Restaurar um backup substitui os dados do aparelho. O save (v2) guarda moedas, recorde de distância e de pontos, veículos, pinturas, som e idioma.

**Celular:** pedais no canto inferior direito e setas no inferior esquerdo, em retrato ou paisagem; as setas somem enquanto a inclinação está ligada. A inclinação é opcional, exige HTTPS e permissão, e tem calibração da posição neutra. O jogo solo instala como PWA e funciona offline depois da primeira visita. No iPhone, use Adicionar à Tela de Início.

## Anúncios nas placas

As placas aparecem a cada 228 metros, alternando os lados da pista. Os textos de exemplo estão em [`src/render/billboards.ts`](src/render/billboards.ts): edite `title`, `subtitle`, `background` e `foreground` para colocar a identidade de um patrocinador, depois rode `npm run build`. O texto se ajusta à largura da placa; prefira títulos curtos.

As peças são locais e funcionam offline. A veiculação paga, métricas e integração com uma rede de anúncios ainda não estão implementadas.

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
- Para regenerar ícones e splash a partir do SVG do projeto: `node scripts/native-assets.ts` (requer Chromium do Playwright).

## Testes e publicação

```powershell
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:browser
```

- `npm run typecheck` roda `tsc --noEmit` em todo o projeto. `npm test` executa `node --test tests/*.test.ts`: **54 testes** de simulação, trânsito, mundo/save/áudio, i18n, sinalização, backup e configuração. `npm run test:browser` roda 16 casos do Playwright (`tests/browser/*.spec.ts`) em Chromium e WebKit; eles empacotam com esbuild um *harness* que expõe `window.Pista` (módulos do jogo, renderer e sprites) ao `page.evaluate`. O servidor local sobe sozinho (`npm start`), então rode `npm run build` antes.
- Todo o código, comentários, identificadores, nomes de teste e mensagens de erro de servidor/API estão em inglês; o texto visível ao jogador fica em `src/i18n/locales/*.ts`.
- O build gera os assets web/nativos em `www/` e o Worker ESM em `dist/server/index.js`.
- O Worker serve o jogo, `/runtime-config.json`, o pareamento (`/api/rooms`), o backup (`/api/progress`) e `/health`. O Sites provisiona o binding D1 `DB` e aplica as migrações de `drizzle/`. Preserve o project ID em `.openai/hosting.json`.
- Para alterar o schema: edite `db/schema.ts`, rode `npm run db:generate` e inspecione a nova migração. Não edite migrações já aplicadas.
- Somente o gateway Sites deve fornecer identidade ao Worker; o Node local não aceita backup por cabeçalhos de identidade. Nenhum segredo fica no frontend. O cache offline (service worker `pista84-v10`) cobre apenas assets locais, sem APIs ou tokens; as fontes do Google Fonts são opcionais, com fallback para fontes do sistema, e não ficam em cache.
- Pagamentos, anúncios e carteira premium ainda dependem de provedores e configuração comercial: os carros PREMIUM só serão vendáveis quando uma integração de cobrança implementar `CashStore`. O backup atual serve para progresso casual e não torna as moedas locais uma carteira segura para dinheiro real.
- Scripts auxiliares (Node 24, com o servidor local rodando quando abrem o jogo): `node scripts/screenshots.ts` (capturas em `docs/screenshots/`), `node scripts/reference-shot.ts` (cena de referência), `node scripts/native-assets.ts` (ícones e splash) e `node scripts/verify-hosted.ts` (verificação do site hospedado, configuração por stdin).

## Estrutura do projeto

| Caminho | Conteúdo |
| --- | --- |
| `src/game/` | Simulação pura, sem DOM: carros, ambiente, estrada, pontuação, trânsito, corrida, save e `index.ts` (barrel) |
| `src/render/` | Renderer Canvas, cenário, sprites (atlas e procedurais), placas e ruído |
| `src/audio/` | Motor de áudio, player de música procedural e dados das faixas |
| `src/i18n/` | Tradutor, tipos e `locales/*.ts` (pt-BR é a fonte; en, pt-PT, fr, it, ja, de) |
| `src/ui/` | Orquestrador (`game-app`), HUD, entrada, overlays, opções, garagem, diálogo do celular, página do controle, notificações, `store` (`CashStore`), arte dos carros e DOM |
| `src/net/remote.ts` | Cliente de pareamento (WebRTC e fallback HTTPS) |
| `src/server/` | Sinalização das salas, backup em nuvem e tipos D1 (compartilhados pelo Node e pelo Worker) |
| `src/shared/config.ts` | Configuração pública (`PISTA84_COINS`) |
| `src/app.ts`, `src/qr.ts` | Ponto de entrada do navegador e geração do QR |
| `web/` | HTML, CSS, manifesto, ícones, atlas de veículos e `sw.ts` (service worker) |
| `worker/index.ts`, `db/`, `drizzle/` | Worker (jogo, pareamento, backup), schema e migrações D1 |
| `server.ts` | Servidor Node local (estáticos, sinalização em memória, `/runtime-config.json`, `/network`, `/qr`, relay WebSocket) |
| `scripts/*.ts` | Build, ambiente, assets nativos, capturas e verificação hospedada |
| `tests/` | Testes Node (`*.test.ts`), `tests/support/` e testes Playwright (`tests/browser/*.spec.ts`) |
| `tsconfig.json`, `drizzle.config.ts`, `playwright.config.ts` | Configurações |
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

`docs/SPECS.md` e `docs/PENDENCIAS.md` são caminhos antigos (a segunda traz um resumo do que ainda falta); as definições canônicas estão em `specs/`.
