export function publicConfig(env={},fallback={coins:null}){
 const value=env.PISTA84_COINS;
 if(value===undefined)return fallback;
 if(String(value).trim()==='')return {coins:null};
 const coins=Number(value);
 if(!Number.isSafeInteger(coins)||coins<0)throw Error('PISTA84_COINS deve ser um inteiro maior ou igual a zero, ou ficar vazio.');
 return {coins};
}
