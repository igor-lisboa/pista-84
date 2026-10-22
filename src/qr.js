import QRCode from 'qrcode';
export async function qrImage(text){return QRCode.toDataURL(text,{width:256,margin:2,errorCorrectionLevel:'M',color:{dark:'#152824',light:'#f2eedf'}});}
