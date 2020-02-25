# Kraken Crypto Payments Challenge Solution

Hi! I'm [Lautaro](https://tarokun.io) and this is my solution for the Crypto Payments Challenge.

The challenge given is intentionally vague, giving very little information. I think there may be more than one valid solution, even though it's stated that the results of the solution will be matched against regex.

In my case, I've made a couple of observations and assumptions:
1. The two data files contain transactions generated in a regtest and possibly manually expanded or modified. I suspect the data doesn't make sense unless a very deep reorg took place and `include_removed` was not passed to `listsinceblock`.
1. The challenge mentions "known user addresses". I've interpreted this as "addresses WE (Kraken) and only we have the keys for, which we have generated for users to transfer their bitcoins to, one or more per user but never shared between different users". I've made this assumption because
    1. This seems like a realistic production set up with HD wallets.
    1. `listsinceblock`'s [_send_ transactions list the address sent to, _receive_ transactions list the address received with.](https://github.com/bitcoin/bitcoin/issues/16040#issuecomment-493315929), which means the addresses that sent bitcoins to us won't show up in the `listsinceblock` response.
1. I've only taken `category='receive'` transactions into account. Including `category='send'` transactions would result in lower balances. It may feel intuitive that if some bitcoins sent to us by a user were later sent somewhere else, we should no longer consider them in their balance, but this is unlikely to be the case in a production exchange, since it'd be reasonable for Kraken to move some of the balances to a cold wallet and keep track of who has what in a traditional database. Also, from my understanding of what the `address` field means in entries of the `listsinceblock` output, the same address can only appear in both `send` and `receive` transactions if we ourselves moved bitcoins inside the same bitcoin wallet from one address to another.

## Configuration

### Float & Decimal

By default, users' amounts are summed using JavaScript's native addition, which uses [Double-precision floating-point](https://en.wikipedia.org/wiki/Double-precision_floating-point_format) and has some small rounding errors that do add up. An environment variable `DECIMAL=1` can be passed to use [decimal.js](https://github.com/MikeMcl/decimal.js) addition instead, which is more accurate and better for handling money. 

### Output Verbosity

Logging verbosity can be increased by passing a `VERBOSE=1` environment variable. This will make the output richer but it will also not match the expected structure, and thus fail the regex tests.

# Links

1. [listsinceblock docs](https://bitcoin.org/en/developer-reference#listsinceblock)
1. [SO: target-confirmations](https://bitcoin.stackexchange.com/questions/25103/listsinceblock-parameter-target-confirmations)
1. [Author's comment on target-confirmations](https://github.com/bitcoin/bitcoin/pull/199#issuecomment-1514952)

# Thinking Out Loud

1. `listsinceblock` returns transactions affecting addresses known to bitcoind's wallet.
    1. This hypothetical Kraken software uses bitcoind's wallet rather than its own wallet implementation.
1. `listsinceblock` takes a mandatory `blockhash` argument and three optional ones: `target_confirmations`, `include_watchonly` and `include_removed`. 
    1. None of them were provided in the challenge. Does it matter? 
    1. `target_confirmations` affects the result's `lastblock`. 
    1. `include_removed` doesn't seem to matter in this case since both files have `remoted: []`.
    1. Every transaction in both files has `involvesWatchonly` set to `true`, `include_watchonly` was probably enabled, but it doesn't really matter.
 
Filtering by `.confirmations >= 6` should be enough, assuming my node knows the chain tip at all times with insignificant lag and no reorgs larger than 6 blocks occur.  

But what to infer from two different sets? Should I just merge them? Why are there 12 transactions present in both, with the same amount of confirmations in both?

# Random Data

## Transaction Count

```
$ jq '.transactions | length' transactions-1.json 
176
$ jq '.transactions | length' transactions-2.json 
136
```

## Blocks

```
> db.listsinceblock1.distinct("blockhash").length
48
> db.listsinceblock2.distinct("blockhash").length
49
```

## Addresses

```
> db.listsinceblock1.distinct('address').length
32
> db.listsinceblock2.distinct('address').length
31
```

## Confirmed Transactions

```
> db.listsinceblock1.find({ confirmations: { $gte: 6 } }).count()
73
> db.listsinceblock1.find({ confirmations: { $gte: 6 }, category: 'receive' }).count()
59
> db.listsinceblock2.find({ confirmations: { $gte: 6 } }).count()
136
> db.listsinceblock2.find({ confirmations: { $gte: 6 }, category: 'receive' }).count()
121
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

## Repeated Transactions

```
> let txs1 = db.listsinceblock1.distinct("txid")
> let txs2 = db.listsinceblock2.distinct("txid")
> txs1.filter(_ => txs2.includes(_)).length
12
> txs2.filter(_ => txs1.includes(_)).length
12
> txs2.filter(_ => txs1.includes(_)).sort().join() === txs1.filter(_ => txs2.includes(_)).sort().join()
true
> txs1.filter(_ => txs2.includes(_))
[
	"8aa80d8d09ec01163984e214295c2177563aaba4a595267b8a2c0215be8b4d7d",
	"c828a14c948aadb71f4fd25e898bf4c147c6bfa4c26cf950d6026c536c855c9a",
	"6feb5e58452e07b074497f0082659b0463759418479e166a74b92b98eeed1a15",
	"1ab5c27a4896b8fb241271e2d7bba0306bb2da18bd763eecc8cbb6476449b56c",
	"c7af9e3d47ea1e526227ae34d297ca57d95de89397fdf20342fe5d39d93b1041",
	"d2344f32357fcde1464c7dcd643a0e38f58283e4eaaa630831777d9ebcce8817",
	"58c33ad7c98754cce27b0ad60cc8bb612d8a37946d5a1439806c8ee4c0d295fd",
	"fa96000f88693427485181510f57119a1704015b9f96b9c19efffb277d202548",
	"f674a728f69e3f27054fd4cf1fcbb953275b214bf9a48936017a7a85fa6e2663",
	"ecebebf6ea1a46bf7df9ba3d38ffebcdd8f5b284b8b94b523ca131f751219554",
	"111dc83db39d452daf199b1aa3829c39d79e802a9d7ba416a7560b2a4ceee3f0",
	"5862934ea32180ea6d8ccc2de7a937568f94277a74c2c37be6596041806d1984"
]
> let repeatedtxs = txs1.filter(_ => txs2.includes(_))
> db.listsinceblock1.find({ txid: { $in: repeatedtxs } }).pretty()
...
```

The transaction `8aa80d8d09ec01163984e214295c2177563aaba4a595267b8a2c0215be8b4d7d` appears in both transaction sets and has `55` confirmations both times, so the two `listsinceblock` calls must have been made at the same time (relatively, no new blocks between calls).

```
> db.listsinceblock1.find({ txid: '8aa80d8d09ec01163984e214295c2177563aaba4a595267b8a2c0215be8b4d7d' }).pretty()
> db.listsinceblock2.find({ txid: '8aa80d8d09ec01163984e214295c2177563aaba4a595267b8a2c0215be8b4d7d' }).pretty()
```

This should mean that both sets contain different transactions because the `blockhash` passed was different.

But if this is so, shouldn't one set contain the other? Maybe some transactions were reorg'd and are no longer present in the main chain, but aren't present in the `removed` entry because `include_removed` was not passed? Or maybe it's all random data, not even `regtest`...

## Weird Transaction

There's a transaction in the second set that seems duplicated in all but the `vout`. 

```
> db.listsinceblock2.aggregate([{ $group: { _id: { txid: "$txid" }, count: { $sum: 1 }}}, { $match: { count: { $gt: 1 } } } ])
{ "_id" : { "txid" : "b1c7e3b67d128088c829c31a323c883a05bd9fa8b9a5a7bfd56d67c8579f6473" }, "count" : 2 }
> db.listsinceblock2.find({ txid: 'b1c7e3b67d128088c829c31a323c883a05bd9fa8b9a5a7bfd56d67c8579f6473' }).pretty()
{
	"_id" : ObjectId("5e4ce2c415ac811367cd539e"),
	"involvesWatchonly" : true,
	"account" : "",
	"address" : "2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo",
	"category" : "receive",
	"amount" : 4.36,
	"label" : "",
	"confirmations" : 76,
	"blockhash" : "833ff1c3e9270a7b014b0f684a89e3f751a58a268dc6f127597d538db69e0a3b",
	"blockindex" : 67,
	"blocktime" : 1524868087278,
	"txid" : "b1c7e3b67d128088c829c31a323c883a05bd9fa8b9a5a7bfd56d67c8579f6473",
	"vout" : 57,
	"walletconflicts" : [ ],
	"time" : 1524868072379,
	"timereceived" : 1524868072379,
	"bip125-replaceable" : "no"
}
{
	"_id" : ObjectId("5e4ce2c415ac811367cd53aa"),
	"involvesWatchonly" : true,
	"account" : "",
	"address" : "2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo",
	"category" : "receive",
	"amount" : 4.36,
	"label" : "",
	"confirmations" : 76,
	"blockhash" : "833ff1c3e9270a7b014b0f684a89e3f751a58a268dc6f127597d538db69e0a3b",
	"blockindex" : 67,
	"blocktime" : 1524868087278,
	"txid" : "b1c7e3b67d128088c829c31a323c883a05bd9fa8b9a5a7bfd56d67c8579f6473",
	"vout" : 56,
	"walletconflicts" : [ ],
	"time" : 1524868072379,
	"timereceived" : 1524868072379,
	"bip125-replaceable" : "no"
}
```

Doesn't really matter I guess, but why would a user create a transaction with two different but identical outputs?

## Repeated Blocks

```
let blocks1 = db.listsinceblock1.distinct("blockhash")
let blocks2 = db.listsinceblock2.distinct("blockhash")
> blocks1.filter(_ => blocks2.includes(_)).length
5
> blocks2.filter(_ => blocks1.includes(_)).length
5
> blocks2.filter(_ => blocks1.includes(_)).sort().join() === blocks1.filter(_ => blocks2.includes(_)).sort().join()
true
> blocks1.filter(_ => blocks2.includes(_))
[
	"4f66926440f1b39fcd5db66609737f877ce32abfc68a945fbd049996ce7d0da2",
	"b6efb29ff8e47646a03f65fffa92e452251b9833decbc749358dcef5ba581ebc",
	"d8a4b1bf5b2c6ba9c3f796fb73793a0e043a22045f53ae8be78114bb8b3f5b90",
	"ecd4cb244481d18d782c60302ac432074b68873cf646be79b3892e0764b0fc47",
	"ef712de73bc81deb766e1f1b55324e3f0b6b543bcc70560bc7af1204d64c2233"
]
```

## Replace By Fee

We may want to treat RBF transactions in some special way. There are none, though.

```
> db.listsinceblock1.distinct("bip125-replaceable")
[ "no" ]
> db.listsinceblock2.distinct("bip125-replaceable")
[ "no" ]
```

## ???

```
$ jq '.transactions | map(select(.blockhash=="4f66926440f1b39fcd5db66609737f877ce32abfc68a945fbd049996ce7d0da2")) | length' transactions-1.json 
3
$ jq '.transactions | map(select(.blockhash=="3125fc0ebdcbdae25051f0f5e69ac2969cf910bdf5017349ef55a0ef9d76d591")) | length' transactions-1.json 
16
$ jq '.transactions | map(select(.blockhash=="4f66926440f1b39fcd5db66609737f877ce32abfc68a945fbd049996ce7d0da2")) | length' transactions-2.json 
3
$ jq '.transactions | map(select(.blockhash=="3125fc0ebdcbdae25051f0f5e69ac2969cf910bdf5017349ef55a0ef9d76d591")) | length' transactions-2.json 
0
```
