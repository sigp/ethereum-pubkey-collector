# Ethereum Public Key Collector

This repository contains two services. A javascript service which connects to a
node via web3 and collects all known public keys from signed transactions on
the blockchain. The second service is a RESTful API which can serve the
ethereum address to associated elliptic curve public key mapping. 

These services are designed for the [E2E Dapp](https://github.com/sigp/e2e). 

**This repository is currently under development and core functionality is
likely to change rapidly**

## Overview

### Public key collector

This service connects to a web3 service and pulls transaction data from the
blockchain. In particular, it extracts r,v,s signature components of each
transaction and calculates the secp256k1 public key associated with the
Ethereum account that created the transaction. Each public key service stores
a mapping of Ethereum addresses to public keys in a local mongo database. 


### Mapping API 

This is a simple flask app which maintains it's own database of ethereum public
keys. Its intention is to store keys from all chains, mainnet, ropsten, kovan
etc. 

## Usage 

Coming soon. 

