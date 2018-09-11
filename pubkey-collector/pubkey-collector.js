
/*******************************************************************************
 * Public Key Collector
 * This scans through the Ethereum blockchain pulling public keys from confirmed
 * transactions and sends new addresses to the api.
 * This service will also watch for new transactions as they appear. 
 ******************************************************************************/

'use strict'
const Web3 = require('web3')
const secp256k1 = require('secp256k1')
const ethJS = require('ethereumjs-lib')
const BN = require('bn.js') // Require big numbers for 256 bit operations.
const util = ethJS.util;
const utility = require('util');
const assert = require('assert')
const winston = require('winston')
const moment = require('moment-timezone')
var net = require('net')
const fs = require('fs')
const https = require('https') // Modify this to http if needed
//const https = require('http') // Modify this to http if needed

// Set up the configuration - currently set for the docker containers
const config = {
  provider: process.env.IPCADDR,
  // providerRPC: process.env.RPCADDR, // pub/subs over ipc for now
  apiHost: process.env.APIHOST,
  apiPort: process.env.APIPORT,
  apiKey: process.env.APIKEY,
  apiPath: "/addkeys",
  chainId: process.env.CHAINID, // 1 is default for the mainnet.
  dataStore: "./data/pkcollector.json" // stores current stats
}

// Setup the logging with Winston library
winston.configure({
  transports: [
    new (winston.transports.Console)({
      timestamp: function() {
        return moment().tz("Australia/Sydney").format()
      },
      formatter: function(options) {
        return utility.format(
          '[%s][%s]: %s',
          options.timestamp(),
          options.level.toUpperCase(),
          options.message)
      }
    }),
  ]
});

/* Main Function */
async function main() { 

  // initialise the main class
  let pkCollector = new PublicKeyCollector(config);
  await pkCollector.initialize();

  let syncEmitter = pkCollector.syncEmitter();

  syncEmitter.on("changed", async (syncing)=> {
    if (syncing == undefined) {
      winston.error("Syncing status undefined. Exiting");
      return;
    }
    else if (syncing)
      winston.info("Node is currently syncing. Waiting until sync completes...");
    else if (!syncing) {
      winston.info("Syncing Complete. Processing blocks...")
      await pkCollector.processBlocks()
      winston.info("Completed searching.");
      // We are up to date.
      // Now continue the update process for new blocks.
      await pkCollector.continualUpdate();
    }
  });

  // Check if we are syncing.
  let isSyncing = await pkCollector.isSyncing(); 
  if (!isSyncing) { // not syncing

    winston.info("Processing blocks...")
    await pkCollector.processBlocks()
    winston.info("Completed searching.");
    // We are up to date.
    // Now continue the update process for new blocks.
    await pkCollector.continualUpdate();
  }
  else {
    winston.info("Node is currently syncing. Waiting until it completes...");
  }
}

/**
 * PublicKeyCollector class holds the state information, including the Web3
 * connection, api connection and block processing.
 * The majority of the logic is contained within this class.
 * @param config - The object that holds configuration data.
 */
class PublicKeyCollector {

  constructor(config) {
    // Set up initial state variables
    this.currentBlock = 0;
    this.lastBlock = 0;
    this.failedBlocks = [];
    this.transactionTally = 0;
    this.chainId = config.chainId;
    this.updateMode = false; // we are not updating single blocks yet.
    this.web3 = new Web3(config.provider,net);
    this.dataStore = config.dataStore;
    this.apiKey = config.apiKey;
    this.apiOptions = {
      host: config.apiHost,
      path: config.apiPath,
      port: config.apiPort,
      method: 'PUT'
    }
  }

  /**
   * Sets up the global database connection and initializes the state
   * variables.
   */
  async initialize() {
    let blockNumber = await this.web3.eth.getBlockNumber()
    this.lastBlock = blockNumber;

    winston.info("Checking for past processing...");
    if (fs.existsSync(this.dataStore)) {
      let dataVars = JSON.parse(fs.readFileSync(this.dataStore,'utf8'));
      // explicitly add them to the class variables 
      if (dataVars.currentBlock)
        this.currentBlock = dataVars.currentBlock;
      if (dataVars.failedBlocks)
        this.failedBlocks = dataVars.failedBlocks;

      winston.info("Loaded previous state");
      winston.info("Blocks processed:" + this.currentBlock);
      if (this.failedBlocks.length !== 0) {
        winston.info("Failed blocks found. Reprocessing failed blocks");
        await this._processFailedBlocks();
        winston.info("Completed processing of failed blocks");
      }



    }
    else  
      winston.info("No previous state found. Starting from scratch...");
  }

  /**
   * This builds the signature hash, given a transaction object.
   * We build this manually to deal with EIP155 and to improve efficiency
   * in many calculations
   * @param - transaction object
   */
  _buildSignatureHash(transaction) {
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
    for (let i = 0, len= rawSig.length; i< len; i++){
      if(rawSig[i].toString('hex') === '00' && i !=3 && i != 5){
        rawSig[i] = Buffer.allocUnsafe(0)
      }
      if (i != 3 && i !=5) //Don't strip 0's from addresses or input values
        rawSig[i] = util.stripZeros(rawSig[i])
    }
    var msg = undefined
    // EIP155 check the value of v
    if (parseInt(transaction.v) > 28) {
      rawSig[6] = util.toBuffer(parseInt(this.chainId));
      rawSig[7] = Buffer.allocUnsafe(0);
      rawSig[8] = Buffer.allocUnsafe(0);
      msg = rawSig.slice()
    } else {
      msg = rawSig.slice(0, 6)
    }
    return util.rlphash(msg);
  }

  /**
   * Process an individual transaction
   * this returns an address and its public key given a transaction
   */
  _processTransaction(transaction) {

    let sigHash = this._buildSignatureHash(transaction);
    let v = parseInt(transaction.v)
    if (v > 28){
      v -= this.chainId * 2 + 8
    }
    let pubKey = util.ecrecover(sigHash,v,transaction.r,transaction.s)
    let derivedAddress = util.bufferToHex(util.publicToAddress(pubKey))

    assert(derivedAddress.toLowerCase() === transaction.from.toLowerCase())
    return {
      'address': transaction.from,
      'pubKey': pubKey.toString('hex'),
    }
  }

  /**
   * Sends the public keys to the api. 
   * This performs a bulk upload of all the transactions in the block currently
   * being processed. We only care about addresses we haven't seen before. 
   * @param pkList - A list of objects containing a public key and their
   * associated Ethereum address  */
   _sendPktoAPI(pkObj, blockNumber) {
    return new Promise(function(resolve, reject) { 
      let putObj = JSON.stringify({
        key: this.apiKey,
        addresses: pkObj.addresses,
        pubkeys: pkObj.pubkeys
      })
      let headers = {
        'Content-Type': 'application/json',
        'Content-Length': putObj.length
      };
    
      var callback = (res) => { 
        if (res.statusCode != 200) { 
          this.failedBlocks.push(blockNumber)
          winston.error("API Failed. Status code:" + res.statusCode)
          resolve()
        }
        res.setEncoding('utf8');
        let returnData='';
        res.on('data', (chunk) => { 
          returnData += chunk; 
        });
        res.on('end', () => {
	  if (res.statusCode == 200) {
		  returnData = JSON.parse(returnData) 
		  if (returnData.result != 'success') {
		    winston.error("API: Storage of Key Failed\n")
		    this.failedBlocks.push(blockNumber)
		    resolve()
		  }
		  resolve()
		}
		resolve();
	})

      }
      https.request({...this.apiOptions, headers: headers}, callback).write(putObj)
    }.bind(this));
  }

  /* Update any statistics we want to store. Currently just the successful
   * block number 
   */
  _updateStats() {
    let stats = JSON.stringify({ currentBlock: this.currentBlock, failedBlocks: this.failedBlocks});
    fs.writeFileSync(this.dataStore, stats);
  }


  /**
   * This batch processes blocks until it reaches the current block height.
   * The transactions within each block are processed and the public keys
   * are sent to the api.
   */
  async processBlocks() {
    while(this.currentBlock < this.lastBlock) { 
      if(this.currentBlock % 1000 == 0 && this.currentBlock != 0){
        winston.info(`Transactions Processed (last 1000 blocks): ${this.transactionTally}`)
        this.transactionTally = 0;
        winston.info(`Processing Block ${this.currentBlock}`)
      }

      // process the current block
      await this._processBlock(this.currentBlock)

      if (this.currentBlock >= this.lastBlock)
        break;
      // Exit the loop if we are only updating a single block
      if (this.updateMode)
        break;

      // Lets process the next block
      this.currentBlock++;
      // If we are approaching the last block
      if (this.lastBlock - this.currentBlock < 5) {
        let blockNumber = await this.web3.eth.getBlockNumber()
        this.lastBlock = blockNumber;
      }
    }
  }

  async _processFailedBlocks() { 
    var failedBlocks = this.failedBlocks.slice(0);
    for (let i = 0; i < failedBlocks.length; i++) { 
      winston.info(`Processing failed block: ${failedBlocks[i]}`)
      await this._processBlock(failedBlocks[i])
    }
  }
  
  /**
   * This processes an individual block
   * The transactions within each block are processed and the public keys
   * are sent to the api.
   */
  async _processBlock(blockNumber) {

    // if the current block is in failed-blocks list. Remove it. 
    let index = this.failedBlocks.indexOf(blockNumber)
    if (index > -1) {
      this.failedBlocks.splice(index, 1);
    }

    let blockData = await this.web3.eth.getBlock(blockNumber, true)
    if(blockData.transactions.length != 0) {
      let pkObj = {addresses: [], pubkeys: []}
      for (let i = 0; i < blockData.transactions.length; i++) {
        // Only process transactions we haven't seen before.
        if (blockData.transactions[i].nonce == 0) {
          this.transactionTally += 1;
          let pkEntry = this._processTransaction(blockData.transactions[i]);
          pkObj.addresses.push(pkEntry.address)  
          pkObj.pubkeys.push(pkEntry.pubKey)  
        }
      }
      if (pkObj.addresses.length > 0)  {
        // batch api requests. 
        let batchSize = 200;
        if (pkObj.addresses.length > batchSize) {
          while (pkObj.addresses.length > 0) {
            let tmpPkObj = { addresses: pkObj.addresses.splice(0,batchSize), pubkeys: pkObj.pubkeys.splice(0,batchSize) } 
            await this._sendPktoAPI(tmpPkObj, blockNumber) // wait for these api calls
          }
        } 
        else  // Don't batch
        {
          this._sendPktoAPI(pkObj, blockNumber) // don't wait for the api calls
        }
      }
    }

    await this._updateStats();
  }
  /**
   * This updates the database as blocks are found.
   * This is designed for perpetual real-time updates of the
   * database
   */
  continualUpdate() {
    winston.info("Starting the continual update...")
    this.updateMode = true;
    this.web3.eth.subscribe('newBlockHeaders')
      .on('data', (blockHeader) => {
        winston.info(`Processing Block: ${blockHeader.number}`)
        this.currentBlock = blockHeader.number;
        this.lastBlock = blockHeader.number;
        this.processBlocks(); // Process this new block
      })
  }

  syncEmitter() {
    return this.web3.eth.subscribe('syncing')
  }

  isSyncing() {
    return this.web3.eth.isSyncing();
  }
}

// execute the main function
main() 
