export interface BillboardAd {
  readonly title: string;
  readonly subtitle: string;
  readonly background: string;
  readonly foreground: string;
}

// House ads, rendered locally and available offline. Replace these entries
// with a sponsor's approved copy/colors; no ad network or tracking is used.
export const BILLBOARD_ADS: readonly BillboardAd[] = Object.freeze([
  { title: 'SUA MARCA', subtitle: 'ANUNCIE AQUI', background: '#ffda65', foreground: '#24315a' },
  { title: 'PISTA 84', subtitle: 'A ESTRADA CONTINUA', background: '#8ae3be', foreground: '#17302b' },
  { title: 'SEU ANÚNCIO', subtitle: 'NESTA ESTRADA', background: '#669df4', foreground: '#f7f5ec' },
  { title: 'BOA VIAGEM', subtitle: 'VAMOS MAIS LONGE', background: '#ff638d', foreground: '#fff3d6' },
]);
