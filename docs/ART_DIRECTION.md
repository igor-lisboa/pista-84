# PISTA 84 — direção de arte 1.3

Referência: imagem enviada pelo usuário nesta conversa, usada como direção visual; não incluída como asset no jogo.

## Resultado integrado

- Câmera de perseguição com horizonte a 25,5% da tela, veículos maiores, com teto e traseira visíveis.
- Cidade em camadas, nuvens em clusters de pixels, coníferas com sombras e acostamento azul/branco.
- Atlas transparente com oito veículos; renderização sem suavização e recortes por limites de alpha. As pinturas continuam funcionando por remapeamento de cor no runtime.
- Sprites antigos permanecem como fallback se o PNG não puder carregar. O atlas final é `web/assets/vehicle-atlas-v1.png` e tem alpha real.
- Skyline e árvores são código Canvas original, com cache para evitar redesenhar milhares de janelas por frame.
- `docs/screenshots/reference-scene.png` é uma composição determinística feita pelo renderer real, com esportivo vermelho, esportivo amarelo, Fusca e hatch azul. Não é um mockup gerado.

## Proveniência e ferramenta

Atlas criado pela ferramenta integrada `image_gen`, modo built-in, com transparência. A segunda chamada removeu emblemas. Nenhum segredo ou chave de API foi necessário. Os prompts completos estão abaixo.

### Geração

Use case: stylized-concept. Asset type: production transparent sprite atlas for a playable 16-bit pseudo-3D racing game. Reference image role: the attached user image is a visual style/camera reference, not an edit target. Create ONE square transparent PNG atlas containing exactly EIGHT original vehicle sprites arranged on a precise 4-column by 2-row grid, each vehicle entirely inside its cell with ample transparent separation. No labels, text, ground, road, shadow background, grid lines, logos or watermark. All vehicles face away from the viewer, viewed from elevated rear chase camera at about 35 degrees down: visible roof, rear windshield, rear deck and substantial rear bumper, rear wheels, subtle view of sides. Each sprite is symmetric rear view, aligned straight ahead, high quality hand drawn pixel art like the supplied 1990s 16-bit racing screenshot. Crisp pixel clusters, dark blue outlines, sophisticated limited-palette highlights and body shading, clearly readable taillights and chrome/exhaust, no smooth illustration or photoreal 3D. Row 1 left to right: (1) rounded beige 1970s Brazilian beetle with curved roof and oval rear window, round tail lamps and chrome bumper; (2) mint green boxy vintage Brazilian station wagon; (3) cobalt blue rounded 1990s hatchback; (4) orange compact 1990s hatchback. Row 2 left to right: (5) small white commuter motorcycle with helmeted rider, rear view; (6) bright red classic exotic wedge supercar with dark rear louvered deck, broad horizontal taillights, rear spoiler and twin exhausts, similar visual detail and proportions to the central red car in the reference; (7) olive-beige rugged boxy 4x4 SUV, rear spare tire; (8) purple sports motorcycle with helmeted rider. Ensure each car has substantial vertical depth like the reference, NOT a flat thin rear bumper icon. Sprites at consistent camera angle and scale; motorcycles narrower. Canvas square; each cell quarter canvas width and half height. Every sprite centered in its cell. True transparent alpha background.

### Ajuste final

Edit only tiny identifying emblems/logos on the cars: remove the small horse badge at the center of the red sports car rear and replace that tiny area with the same plain dark grille pixels. Remove any other tiny maker insignia while preserving body pixels. Keep every vehicle, its position, size, colors, pixel-art details and transparent alpha exactly unchanged. Do not rearrange, redraw, crop, add text or change the canvas dimensions. This is the final transparent sprite atlas used in a playable game.

