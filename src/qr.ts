import QRCode from 'qrcode';

const QR_SIZE_PX = 256;
const QR_MARGIN = 2;
const QR_DARK = '#152824';
const QR_LIGHT = '#f2eedf';

/** Renders `text` as a QR code and returns it as a PNG data URL. */
export function qrImage(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: QR_SIZE_PX,
    margin: QR_MARGIN,
    errorCorrectionLevel: 'M',
    color: {dark: QR_DARK, light: QR_LIGHT},
  });
}
