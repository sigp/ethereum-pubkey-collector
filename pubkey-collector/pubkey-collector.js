
/*******************************************************************************
 * Public Key Collector
 * This scans through the ethereum blockchain pulling public keys from confirmed
 * transactions and populates the connected mongo database.
 * This will also update the database regularly as blocks are solved.
 ******************************************************************************/

'use strict'
const Web3 = require('web3')
const secp256k1 = require('secp256k1')
const ethJS = require('ethereumjs-lib')
const BN = require('bn.js') // Require big numbers for 256 bit operations.
const util = ethJS.util;
const utility = require('util');
const MongoClient = require('mongodb').MongoClient
const assert = require('assert')
const winston = require('winston')
const moment = require('moment-timezone')
var net = require('net')

// Initialize global variables
let chainId = 1;    // The main-net for transaction signatures

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

/**
 * PublicKeyCollector class holds the state information, including the Web3
 * connection, database connection and current processing block.
 * The majority of the logic is contained within this class.
 * @param config - The object that holds configuration data.
 */
class PublicKeyCollector {

    constructor(config) {
        // Set up initial state variables
        this.currentBlock = 0;
        this.lastBlock = 0;
        this.db = undefined;
        this.dbURL = config.dbURL;
        this.knownAddresses = {};
        this.transactionTally = 0;
        this.chainId = config.chainId;
        this.updateMode = false // We are not updating single blocks yet.
        this.web3 = new Web3(config.provider,net);

    }

    /**
     * Sets up the global database connection and initializes the state
     * variables.
     */
    initialize() {
        return this.web3.eth.getBlockNumber()
        .then((blockNumber) => {
            this.lastBlock = blockNumber;

            winston.info("Connecting to the database");
            return new Promise((resolve,reject)=> {
               MongoClient.connect(this.dbURL, (err, client) => {
                   const dbConn = client.db('e2e');
                   if (err || dbConn == null) {
                       winston.error("Could not connect to the database. Exiting")
                       reject(err)
                   }
                   // Find the last processed block
                   dbConn.collection("stats").findOne({attribute: "Processed Block Number"}, (err,res) => {
                       // Set the current block
                       if(res == null || res == {})
                           this.currentBlock = 0
                       else
                           this.currentBlock = res.value;
                        winston.info(`Resuming from Block Number: ${this.currentBlock}`);
                        this.db = dbConn;
                        resolve(true);
                    })
                })
              })
        })
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

        // Debugging
        /*
        console.log(derivedAddress)
        console.log(transaction.from)
        */
        assert(derivedAddress.toLowerCase() === transaction.from.toLowerCase())
        return {
            'address': transaction.from,
            'pubKey': pubKey.toString('hex'),
        }
    }

    /**
     * Stores the Public key mappings in the database.
     * This does a bulk write of all the transactions in the block currently
     * being Processed
     * @param pkList - An object containing a list of mongo update statements to
     * by used in the bulkWrite function.
     */
    _storePKInDb(pkList) {
        // winston.info(`Storing addresses: ${pkList}`)
        return new Promise((resolve,reject)  => {
          //winston.info(`Inserting PK List of size: ${pkList.length}`)
          this.db.collection("keys").bulkWrite(pkList, (err, res) => {
              if (err) {
                  winston.error(`Failed to insert transactions in: ${this.currentBlock}`)
                  reject(err);
              }
              resolve();
            })
          })
    }

    /**
     * This updates misc statistics.
     * Currently this only updates the current block number, which allows processing
     * to resume if the collector is restarted.
     */
    _updateDBStats() {

      this.db.collection("stats").updateOne(
        {attribute: "Processed Block Number"},
        { $set: { value: this.currentBlock}},
        { upsert: true },
        (err,res) => {
          if (err) {
              winston.error(`Failed to insert block Number: ${this.currentBlock}`);
	      console.log(err);
          }
          return;
        })
    }

    /**
     * This batch processes blocks until it reaches the current block height.
     * The transactions within each block are processed and the public keys
     * are added to the database.
     */
    processBlocks() {
        if(this.currentBlock > this.lastBlock) {
            winston.info("Completed searching.");
            return Promise.resolve();
        }
        if(this.currentBlock % 1000 == 0 && this.currentBlock != 0){
          winston.info(`Transactions Processed (last 1000 blocks): ${this.transactionTally}`)
          this.transactionTally = 0;
          winston.info(`Processing Block ${this.currentBlock}`)
        }
        return this.web3.eth.getBlock(this.currentBlock, true)
            .then((res,err) => {
                if(err || res == null)
                    return Promise.resolve();
                if(res.transactions.length === 0) {
                    return Promise.resolve();
                }
                let pkList = []
                let pkListObject = {}
                for (let i = 0; i < res.transactions.length; i++) {
                    // Only process transactions we haven't seen before.
                    if (this.knownAddresses[res.transactions[i].from] == undefined){
                      this.transactionTally += 1;
                      this.knownAddresses[res.transactions[i].from] = true;
                      let pkEntry = this._processTransaction(res.transactions[i]);
                      pkListObject.updateOne = {
                        "filter" : pkEntry,
                        "update" : {$set: { pkEntry}},
                        "upsert" : true
                      }
                      pkList.push(pkListObject);
                    }
                }
                if (pkList.length > 0)
                  return this._storePKInDb(pkList)
                return Promise.resolve();
            })
            .then(() => {
                this._updateDBStats();
                if (this.currentBlock >= this.lastBlock)
                    return Promise.resolve()
                // Do nothing if we are only updating a single block
                if (this.updateMode)
                    return Promise.resolve();

                // Lets process the next block
                this.currentBlock++;
                // If we are approaching the last block
                if (this.lastBlock - this.currentBlock < 100)
                    return this.web3.eth.getBlockNumber()
                      .then((blockNumber) => {
                          this.lastBlock = blockNumber;
                          return this.processBlocks();
                      })
                else
                    return this.processBlocks();
            })
            .catch(err => {
              console.log(err);
              winston.error("Closing database connection")
              this.db.close()
              return Promise.reject();
            })
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

// Set up the configuration - currently set for the docker containers
const config = {
        provider: process.env.RPCADDR,
        rpchost: "geth db",
        dbURL: process.env.DBADDR,
      //  dbURL: 'mongodb://localhost/e2e', // use this for local db
        chainId: process.env.CHAINID // 1 is default for the mainnet.
    }


async function main() { 

  // Start the main processing.
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
      // We are up to date.
      // Now continue the update process for new blocks.
      await pkCollector.continualUpdate();
  }
  else {
        winston.info("Node is currently syncing. Waiting until it completes...");
  }
}

// execute the main function
main() 
