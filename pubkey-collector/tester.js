const Web3 = require('web3')
const secp256k1 = require('secp256k1')
const ethJS = require('ethereumjs-lib')
const BN = require('bn.js')
const TX = ethJS.Tx
const util = ethJS.util


let gas = 1292444
/*
transaction = {
  to: "0xc083e9947cf02b8ffc7d3090ae9aea72df98fd47",
  from: "0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3",
  gas: 129244,
  gasPrice: 80525500000,
  nonce: 21,
  input: "0x",
  r: "0xa254fe085f721c2abe00a2cd244110bfc0df5f4f25461c85d8ab75ebac11eb10",
  s: "0x30b7835ba481955b20193a703ebc5fdffeab081d63117199040cdf5a91c68765",
  v: "0x1c",
  value: 100000000000000000000,
  chainId: 0,
//  gasLimit: "0x" + gas.toString(16),
 // data: "0x"
}
*/
/*
 { blockHash: '0x5793f91c9fa8f824d8ed77fc1687dddcf334da81c68be65a782a36463b6f7998',
   blockNumber: 46169,
   from: '0xbD08e0cDDEc097DB7901EA819a3d1FD9de8951A2',
   gas: 21000,
   gasPrice: '909808707606',
   hash: '0x19f1df2c7ee6b464720ad28e903aeda1a5ad8780afc22f0b960827bd4fcf656d',
   input: '0x',
   nonce: 0,
   to: '0x5C12A8e43Faf884521C2454f39560e6C265a68C8',
   transactionIndex: 0,
   value: '19900000000000000000',
   v: '0x1b',
   r: '0x6bf8f2ac14eb21a072f51a3cc75ee8aec5125255f06702ce3d40d4386de825f3',
   s: '0x12799e552161d4730177fecd66c2e286d39505a855017eb1f05fa9fd4075e3cc' }
 0xbd08e0cddec097db7901ea819a3d1fd9de8951a2
 0xbd08e0cddec097db7901ea819a3d1fd9de8951a2
 */
transaction = { blockHash: '0xf4a537e8e2233149929a9b6964c9aced6ee95f42131aa6b648d2c7946dfc6fe2',
   blockNumber: 46170,
   from: '0x63Ac545C991243fa18aec41D4F6f598e555015dc',
   gas: 21000,
   gasPrice: '500000000000',
   hash: '0x9e6e19637bb625a8ff3d052b7c2fe57dc78c55a15d258d77c43d5a9c160b0384',
   input: '0x',
   nonce: 0,
   to: '0xC93f2250589a6563f5359051c1eA25746549f0D8',
   transactionIndex: 0,
   value: '599989500000000000000',
   chainId: 0,
   v: '0x1b',
   r: '0x34b6fdc33ea520e8123cf5ac4a9ff476f639cab68980cd9366ccae7aef437ea0',
   s: '0xe517caa5f50e27ca0d1e9a92c503b4ccb039680c6d9d0c71203ed611ea4feb33'
 }
 transaction ={ blockHash: '0x7e5a9336dd82efff0bfe8c25ccb0e8cf44b4c6f781b25b3fc3578f004f60b872',
   blockNumber: 46420,
   from: '0x22F2DcFf5aD78c3Eb6850B5Cb951127B659522E6',
   gas: 23000,
   gasPrice: '500000000000',
   hash: '0xe363505adc6b2996111f8bd774f8653a61d244cc6567b5372c2e781c6c63b737',
   input: '0x432ced046274630000000000000000000000000000000000000000000000000000000000',
   nonce: 3,
   to: '0x0000000000000000000000000000000000000000',
   transactionIndex: 0,
   value: '0',
   v: '0x1b',
   r: '0x51fa13200c3e4a21b15b9cb423c6f7b846e0071692311d26643b42f005a67e7d',
   s: '0x3eca8f648fd6138e98cecb6806f1ad865085010a7512a4102c25323a0f327559' }
transaction ={
blockHash: '0xf2988b9870e092f2898662ccdbc06e0e320a08139e9c6be98d0ce372f8611f22',
   blockNumber: 47884,
   from: '0x8bae48F227d978d084B009b775222BAaF61ed9fe',
   gas: 24004,
   gasPrice: '50000000000',
   hash: '0x6adb1cbeecf7520708a57a0e50fbeeeaa7a5058d0fceb02e60372aaaef3847a7',
   input: '0x0000000000000000000000000000000000000000000000454e4854505a334747',
   nonce: 2,
   to: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2',
   transactionIndex: 1,
   value: '1000000000000000000',
   v: '0x1b',
   r: '0x2fefde3e8220f77d030b20f7461b66600bbd417b0b5f99ef0f71d7264aa0d08a',
   s: '0x6a44ad8ad3df1bdc9d7bdd4445f2c3eabd68907d6909a619b11dcbf6f111a40e'}

transaction = { blockHash: '0x69ec33ee19d4ef67b014da1f9efb3431402079cfedf76892de6b8b05dade1de6',
   blockNumber: 69447,
   from: '0x4E567864EC2EFAd2a2186806b9aFeeF0cAF9a427',
   gas: 22000,
   gasPrice: '59060142275',
   hash: '0xcbca3a4bc479b7769094b18623ba9c3f9a9daa8c6919c7987f367375ea2957c9',
   input: '0x00',
   nonce: 0,
   to: '0x4E567864EC2EFAd2a2186806b9aFeeF0cAF9a427',
   transactionIndex: 0,
   value: '0',
   v: '0x1b',
   r: '0xde60d4a5bbef1926bb9c92e2d7e77731f728f2b1b1ed6c855f0194161ab78786',
   s: '0x4e2c63234d8bbb822addc1f8a9054774cd8fc829aaaa998edaf2d682ef255832' }


transaction = { blockHash: '0x1309e1a92ef75aab3f34cadb5cd4e69d88334e6b0d237e0d63d57c9e067fe617',
   blockNumber: 2675002,
   from: '0x007944eAF77E851e2Fe68A4abc183579455B2C52',
   gas: 121000,
   gasPrice: '61000000000',
   hash: '0x318dc42241dbf51817c0b0488fc85a8c72a1f3eff540ab90d4871ace0e431c0b',
   input: '0x',
   nonce: 0,
   to: '0xA821B1425FF268bbd6275DeA95F8B186167532bd',
   transactionIndex: 0,
   value: '5000000000000000000',
   v: '0x26',
   r: '0xde1ee3daae4591b408855a64c69271cdb4ee4259fc985f8a362cbd6aabc784df',
   s: '0x6491939cf5be33b5c3bea00237f0512fa3889cffd9193992f0fde94247a7b6e1' }

transaction = {
   blockHash: '0x4df15a2b8b557ead7fee2c142678ae68141d8320995315e0244ff54d7934ebb2',
   blockNumber: 2312,
   from: '0x76CC4F3a4d5a028A6b081Ebd41fe40b5FAA3C675',
   gas: 21000,
   gasPrice: '18000000000',
   hash: '0xe2ab7da70b825d9aa8a62a00261bd69e2283b3038a9599c6152c1c76a6c44c77',
   input: '0x',
   nonce: 0,
   to: '0x11a88963Bb7419ad0d0FF94478225c1Bc9B74158',
   transactionIndex: 0,
   value: '7812500000000000000000',
   v: '0xa95',
   r: '0xf52c3f335424446be8afd84afa3e158527c73a3d7e0565ac898b18ad46c79252',
   s: '0x4c258f523b3d830114604826976566ebc933b7102aa64c509d018ab93eaf2e63'
}


let chainId = 1337
var rawSig = []
rawSig[0] = util.toBuffer(new BN(transaction.nonce));
rawSig[1] = util.toBuffer(new BN(transaction.gasPrice));
rawSig[2] = util.toBuffer(new BN(transaction.gas));
rawSig[3] = util.toBuffer(transaction.to);
rawSig[4] = util.toBuffer(new BN(transaction.value));
rawSig[5] = util.toBuffer(transaction.input);
rawSig[6] = util.toBuffer(transaction.v);
rawSig[7] = util.toBuffer(transaction.r);
rawSig[8] = util.toBuffer(transaction.s);

transaction.nonce = util.toBuffer(new BN(transaction.nonce));
transaction.gasPrice = util.toBuffer(new BN(transaction.gasPrice));
transaction.gas = util.toBuffer(new BN(transaction.gas));
transaction.value = util.toBuffer(new BN(transaction.value));

for (let i = 0, len= rawSig.length; i< len; i++){

    if(rawSig[i].toString('hex') === '00'){
        rawSig[i] = Buffer.allocUnsafe(0)
    }
    if (i !=3 && i !=5)
      rawSig[i] = util.stripZeros(rawSig[i])
}

console.log(rawSig)

var msg = undefined
if (parseInt(transaction.v) > 28) {
  rawSig[6] = util.toBuffer(chainId);
  rawSig[7] = Buffer.allocUnsafe(0)
  rawSig[8] = Buffer.allocUnsafe(0)

  msg = rawSig.slice()
  console.log('Here');
} else {
  msg = rawSig.slice(0, 6)
}
console.log(msg)
tx = new TX(transaction);
console.log(tx.raw);
console.log(util.rlphash(msg));
console.log(tx.hash(false));

//console.log(util.rlphash(msg))

// console.log(util.ecrecover(util.rlphash(msg), 28, transaction.r, transaction.s))
// pk = util.ecrecover(util.rlphash(msg), 28, transaction.r, transaction.s)
pk = util.ecrecover(tx.hash(false), 27, transaction.r, transaction.s)
console.log(util.publicToAddress(pk))

// console.log(tx.getSenderPublicKey())
console.log(tx.getSenderAddress())
//console.log(util.publicToAddress(tx.getSenderPublicKey()))
