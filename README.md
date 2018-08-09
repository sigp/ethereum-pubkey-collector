# Ethereum Public Key Collector

This repository contains two services. A javascript service which connects to a
node via IPC using the web3 library and collects all known public keys from signed transactions on
the blockchain. The second service is a RESTful API which can serve the
ethereum address to associated elliptic curve public key mapping. 

These services are designed for the [E2E Dapp](https://github.com/sigp/e2e). 

**This repository is currently under development and core functionality is
likely to change rapidly**

## Overview

### Public key collector

This service connects to a web3 client and pulls transaction data from the
blockchain. In particular, it extracts r,v,s signature components of each
transaction and calculates the secp256k1 public key associated with the
Ethereum account that created the transaction. The service then sends a
collection of found public keys and their associated Ethereum addresses to the
api (also found in this repo). The api stores these in a rocksdb and serves
the results via HTTP. 

### Mapping API 

This is a simple flask app which maintains a local rocksdb database of ethereum public
keys. Its intention is to store keys from all chains, mainnet, ropsten, kovan
etc. 

## Usage 

Coming soon. 

