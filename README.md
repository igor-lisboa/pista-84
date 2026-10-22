# Car game · PISTA 84

Implementação do plano de corrida em [pista-84/](pista-84/).

- **[Game specifications — start here](specs/README.md)**
- [Gameplay rules](specs/02-gameplay.md)
- [Vehicles and economy](specs/03-vehicles-and-economy.md)
- [Pending work and acceptance criteria](specs/09-roadmap.md)
- [Execução, controles e testes](pista-84/README.md)

```powershell
cd pista-84
npm install
npm run build
npm start
```

Jogue em http://localhost:4173.




# PISTA 84

Arcade brasileiro de corrida infinita em pixel art.

**[Game specifications — start here](../specs/README.md)** · [Gameplay](../specs/02-gameplay.md) · [Pending work and acceptance criteria](../specs/09-roadmap.md).

The canonical definitions are in the workspace-root `specs/` folder, alongside this application's `pista-84/` directory. The older `docs/SPECS.md` and `docs/PENDENCIAS.md` paths now point there.

Visual 1.3 baseado na imagem de referência enviada: cidade no horizonte, árvores detalhadas, pista azul/branco e atlas de oito veículos em perspectiva. [Direção de arte e prompts](docs/ART_DIRECTION.md) · [Composição renderizada no jogo](docs/screenshots/reference-scene.png). O atlas também fica no cache offline; pinturas e progressos existentes são preservados.

## Executar localmente

Node.js **24** é o ambiente validado, inclusive para os testes SQL com `node:sqlite`.

```powershell
cd pista-84
npm install
npm run build
npm start
```

Abra **http://localhost:4173**. O terminal mostra o endereço da rede para o celular. `PORT` configura outra porta. Edite `src/` e `web/`, depois execute `npm run build`. `www/` e `dist/` são gerados.

## Jogar

Versão 1.2: escolha carro e opções no menu inicial. Ao tocar em **JOGAR**, só ficam na tela a corrida, velocidade, distância, combustível e pausa. No celular, controles táteis ficam nas bordas inferiores; retrato e paisagem são suportados sem cortar a pista. A garagem e as opções ficam fora da corrida.

←/→ ou A/D dirigem; ↑/W acelera; ↓/S/espaço freia; P/Esc pausa. O carro anda automaticamente. Colete galões verdes, evite trânsito e não pare na pista. 25 metros rendem uma moeda, salva em checkpoints, pausa e fim de corrida. Uma segunda chance gratuita por corrida. Som é ativado no cabeçalho e sua preferência é lembrada.

Garagem: oito veículos com desempenho, sprites e áudio distintos. Bruto 4×4 suporta duas colisões; motos têm menor área de colisão e perdem mais aderência na chuva. Cinco pinturas compráveis com moedas. Exportação/importação de progresso; no site hospedado, backup manual por conta com proteção contra conflitos de gravação. Restaurar backup substitui os dados do aparelho.

Celular: pedais e setas. Inclinação é opcional, exige HTTPS/permissão e tem calibração de posição neutra. O jogo solo pode ser instalado como PWA e funciona offline depois da primeira visita. No iPhone, use Adicionar à Tela de Início; em navegadores compatíveis, aparece a opção de instalar.

## Celular como controle

1. Abra o jogo hospedado no computador e clique em **Controle no celular**.
2. Leia o QR no celular; no site privado, faça login com sua conta nos dois aparelhos.
3. Aguarde a conexão, feche o modal no computador e inicie a corrida.
4. Use setas/pedais ou ative a inclinação no celular.

Pareamento usa HTTP/D1. Comandos usam WebRTC quando possível, com **fallback HTTPS**; o Safari começa pelo modo de compatibilidade. Assim, o controle não depende de TURN ou suporte a WebRTC. QR expira em 10 minutos e admite uma conexão. Perda de sinal pausa a corrida; gere outro QR para reconectar. No controle, toque em **Iniciar corrida** para começar na tela principal. Não usa câmera ou microfone.

No iPhone, abra o endereço HTTPS diretamente no Safari, entre com a mesma conta do jogo privado e leia um QR recém-gerado. A inclinação é opcional e só solicita acesso quando você toca no botão. Sem permissão/sensor, use setas e pedais. Adicionar à Tela de Início remove as barras do navegador. A validação automatizada usa WebKit; teste em aparelho físico ainda é necessário.

Localmente, o Node mantém a sinalização em memória. O link troca localhost pelo endereço de rede detectado. Se houver várias interfaces, confira esse endereço; firewall deve permitir a porta na rede privada. Para sensores, sirva o Node atrás de HTTPS (`PUBLIC_ORIGIN` deve corresponder à URL externa). Relay WebSocket original permanece em `/relay`, como alternativa técnica. O controle remoto no wrapper nativo usa a versão web até validação específica.

## Android e iOS

Projetos gerados em `android/` e `ios/`, com ícones/splash próprios. Assets são sincronizados com:

```powershell
npm run native:sync
npm run native:android
# Em macOS com Xcode:
npm run native:ios
```

Compilação Android exige JDK/Android SDK; iOS exige macOS/Xcode. Não disponíveis neste ambiente. Não há APK/AAB/IPA validado nem certificados de assinatura. Ver NAT-01/NAT-02. Para regenerar ícones e splash a partir do SVG do projeto: `node scripts/native-assets.mjs` (requer Chromium Playwright instalado).

## Testes e publicação

```powershell
npm test
npx playwright install chromium webkit
npm run test:browser
```

Build gera assets web/nativos em `www/` e Worker ESM em `dist/server/index.js`. Worker serve jogo, pareamento e backup; Sites provisiona o binding D1 `DB` e aplica migrações de `drizzle/`. Preserve project ID em `.openai/hosting.json`. Para alterar schema: editar `db/schema.ts`, executar `npm run db:generate` e inspecionar a nova migração. Não editar migrações aplicadas.

Somente o gateway Sites deve fornecer identidade ao Worker. O Node local não aceita backup por cabeçalhos de identidade. Nenhum segredo fica no frontend. Cache offline cobre assets, sem APIs ou tokens. A fonte Google Fonts é opcional, com fallback local.

Pagamentos, anúncios e carteira premium ainda dependem de provedores e configuração comercial. O backup atual é para progresso casual e não torna moedas locais uma carteira segura para dinheiro real. Contratos, dependências e testes de conclusão estão em [PENDENCIAS.md](docs/PENDENCIAS.md).

