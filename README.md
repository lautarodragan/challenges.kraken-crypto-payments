# Thinking Out Loud

1. `listsinceblock` returns transactions affecting addresses known to bitcoind's wallet.
1. This hypothetical Kraken software uses bitcoind's wallet rather than its own wallet implementation.
1. At least some of the block hashes mentioned in the files don't exist in either mainnet or testnet, so it's probably some regtest data.
1. [`listsinceblock`](https://bitcoin-rpc.github.io/en/doc/0.17.99/rpc/wallet/listsinceblock/) takes a mandatory `blockhash` argument and three optional ones: `target_confirmations`, `include_watchonly` and `include_removed`. None of them were provided in the challenge. Does it matter? 
  1. `target_confirmations` affects the result's `lastblock`. 
  1. `include_removed` doesn't seem to matter in this case since both files have `remoted: []`.
 
# Random Data

## Transaction Count

```
$ jq '.transactions | length' transactions-1.json 
176
$ jq '.transactions | length' transactions-2.json 
136
```

## Other Data

```
$ jq 'del(.transactions)' transactions-1.json 
{
  "removed": [],
  "lastblock": "4f66926440f1b39fcd5db66609737f877ce32abfc68a945fbd049996ce7d0da2"
}
$ jq 'del(.transactions)' transactions-2.json 
{
  "removed": [],
  "lastblock": "3125fc0ebdcbdae25051f0f5e69ac2969cf910bdf5017349ef55a0ef9d76d591"
}
```
