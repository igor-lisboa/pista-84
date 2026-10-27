# PISTA 84 — direção de arte 1.4

Referência: imagem enviada pelo usuário nesta conversa, usada como direção visual; não incluída como asset no jogo.

## Resultado integrado

- Câmera de perseguição com horizonte a 27,5% da tela, veículos maiores, com teto e traseira visíveis.
- Cidade em camadas, nuvens em clusters de pixels, coníferas com sombras e acostamento azul/branco.
- Atlas transparente com oito veículos (`web/assets/vehicle-atlas-v1.png`) e folha de curvas com 16 poses (`vehicle-turns-v2.png`, veja [turn-sprites-v2.md](turn-sprites-v2.md)); renderização sem suavização e recortes por limites de alpha. As pinturas continuam funcionando por remapeamento de cor no runtime.
- **Seis veículos novos sem arte de atlas** (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS e Maverick GT): usam sprites pixel art procedurais de 128×80 desenhados em Canvas por `src/render/sprites.ts` (Kombi bicolor com janela traseira dividida, Uno com escada no teto, Chevette com lanternas redondas, Opala com porta-malas longo, Maverick com faixa preta e três lanternas). Os mesmos sprites procedurais servem de fallback para os oito carros do atlas se o PNG não puder carregar. Arte autoral de atlas para esses seis veículos continua pendente (ART-01 no [roadmap](../specs/09-roadmap.md)).
- Skyline e árvores são código Canvas original (`src/render/scenery.ts`), com cache para evitar redesenhar milhares de janelas por frame.
- `docs/screenshots/reference-scene.png` é uma composição determinística feita pelo renderer real (`node scripts/reference-shot.ts`), com esportivo vermelho, esportivo amarelo, Fusca e hatch azul. Não é um mockup gerado.
- **Interface 1.4 (pôr do sol arcade):** fundo roxo-escuro, amarelo-sol, rosa e ciano; fontes Bungee (títulos) e Chakra Petch (texto) via Google Fonts, com fallback de sistema; contornos duros, sombras deslocadas sem desfoque e uma faixa quadriculada no topo do menu. O HUD é só uma barra superior (velocidade à esquerda; distância, pontos e checkpoint no centro; combustível e pausa à direita). Os cantos inferiores ficam para os controles de toque.

## Proveniência e ferramenta

Atlas criado pela ferramenta integrada `image_gen`, modo built-in, com transparência. A segunda chamada removeu emblemas. Nenhum segredo ou chave de API foi necessário. Os prompts completos estão abaixo.

### Geração

Use case: stylized-concept. Asset type: production transparent sprite atlas for a playable 16-bit pseudo-3D racing game. Reference image role: the attached user image is a visual style/camera reference, not an edit target. Create ONE square transparent PNG atlas containing exactly EIGHT original vehicle sprites arranged on a precise 4-column by 2-row grid, each vehicle entirely inside its cell with ample transparent separation. No labels, text, ground, road, shadow background, grid lines, logos or watermark. All vehicles face away from the viewer, viewed from elevated rear chase camera at about 35 degrees down: visible roof, rear windshield, rear deck and substantial rear bumper, rear wheels, subtle view of sides. Each sprite is symmetric rear view, aligned straight ahead, high quality hand drawn pixel art like the supplied 1990s 16-bit racing screenshot. Crisp pixel clusters, dark blue outlines, sophisticated limited-palette highlights and body shading, clearly readable taillights and chrome/exhaust, no smooth illustration or photoreal 3D. Row 1 left to right: (1) rounded beige 1970s Brazilian beetle with curved roof and oval rear window, round tail lamps and chrome bumper; (2) mint green boxy vintage Brazilian station wagon; (3) cobalt blue rounded 1990s hatchback; (4) orange compact 1990s hatchback. Row 2 left to right: (5) small white commuter motorcycle with helmeted rider, rear view; (6) bright red classic exotic wedge supercar with dark rear louvered deck, broad horizontal taillights, rear spoiler and twin exhausts, similar visual detail and proportions to the central red car in the reference; (7) olive-beige rugged boxy 4x4 SUV, rear spare tire; (8) purple sports motorcycle with helmeted rider. Ensure each car has substantial vertical depth like the reference, NOT a flat thin rear bumper icon. Sprites at consistent camera angle and scale; motorcycles narrower. Canvas square; each cell quarter canvas width and half height. Every sprite centered in its cell. True transparent alpha background.

### Ajuste final

Edit only tiny identifying emblems/logos on the cars: remove the small horse badge at the center of the red sports car rear and replace that tiny area with the same plain dark grille pixels. Remove any other tiny maker insignia while preserving body pixels. Keep every vehicle, its position, size, colors, pixel-art details and transparent alpha exactly unchanged. Do not rearrange, redraw, crop, add text or change the canvas dimensions. This is the final transparent sprite atlas used in a playable game.

