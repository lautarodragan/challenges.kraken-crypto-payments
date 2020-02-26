import { Decimal } from 'decimal.js'
import { readFile as readFileCb } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

import { MongoClient } from 'mongodb'

const readFile = promisify(readFileCb)

Decimal.set({ toExpNeg: -10 })

interface User {
  readonly name: string
  readonly address: string
}

const users: readonly User[] = [
  {
    name: 'Wesley Crusher',
    address: 'mvd6qFeVkqH6MNAS2Y2cLifbdaX5XUkbZJ',
  },
  {
    name: 'Leonard McCoy',
    address: 'mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp',
  },
  {
    name: 'Jonathan Archer',
    address: 'mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n',
  },
  {
    name: 'Jadzia Dax',
    address: '2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo',
  },
  {
    name: 'Montgomery Scott',
    address: 'mutrAf4usv3HKNdpLwVD4ow2oLArL6Rez8',
  },
  {
    name: 'James T. Kirk',
    address: 'miTHhiX3iFhVnAEecLjybxvV5g8mKYTtnM',
  },
  {
    name: 'Spock',
    address: 'mvcyJMiAcSXKAEsQxbW9TYZ369rsMG6rVV',
  },
]

async function main({
  mongoUrl = 'mongodb://localhost:27017/kraken',
  useDecimal = true,
  verbose = false,
  dataDirectory = './challenge',
}) {
  function trace(...args: readonly unknown[]) {
    if (verbose)
      console.log(...arguments)
  }

  function info(...args: readonly unknown[]) {
    console.log(...args)
  }

  trace({ mongoUrl, useDecimal, verbose, dataDirectory })

  const mongoClient = await MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()

  const collection = dbConnection.collection('listsinceblock')
  await collection.createIndex({ blockhash: 1, txid: 1, vout: 1 }, { unique: true })

  async function fileToCollection(filePath: string) {
    const file = JSON.parse(await readFile(filePath, 'utf8'))

    trace(`Adding ${file.transactions.length} entries from ${filePath} to DB.listsinceblock...`)
    try {
      const writeResult = await collection.insertMany(file.transactions, { ordered: false })
      trace(`Added ${writeResult.result.n} entries.`)
    } catch (error) {
      if (!isDuplicateKeyError(error))
        return console.error('Unexpected error:', error)
      trace(`Added ${error.result.nInserted} entries. Ignored ${error.result.result.writeErrors.length} duplicate entries.`)
    }
  }

  async function findBalances() {
    const sum = useDecimal ? sumDecimal : sumFloat

    const findTransactionsByUser = async ({ name, address }: User) => {
      const transactions = await collection.find({
        address,
        category: 'receive',
        confirmations: { $gte: 6 },
        amount: { $gte: 0.0001 },
      }).toArray()
      const amount = transactions.map(_ => _.amount).reduce(sum, 0)
      return {
        name,
        address,
        count: transactions.length,
        amount,
      }
    }

    const findTransactionsByUnknownUsers = async () => {
      const transactions = await collection.find({
        address: { $not: { $in: users.map(_ => _.address) } },
        category: 'receive',
        confirmations: { $gte: 6 },
        amount: { $gte: 0.0001 },
      }).toArray()
      const balanceToDeposit = transactions.map(_ => _.amount).reduce(sum, 0)
      info(`Deposited without reference: count=${transactions.length} sum=${balanceToDeposit}`)
    }

    const findSmallestValidDeposit = async () => {
      const transaction = await collection.findOne({
        category: 'receive',
        confirmations: { $gte: 6 },
        amount: { $gte: 0.0001 },
      }, {
        sort: { amount: 1 },
      })
      info(`Smallest valid deposit: ${new Decimal(transaction.amount)}`)
    }

    const findLargestValidDeposit = async () => {
      const transaction = await collection.findOne({
        category: 'receive',
        confirmations: { $gte: 6 },
      }, {
        sort: { amount: -1 },
      })
      info(`Largest valid deposit: ${transaction.amount}`)
    }

    const deposits = await Promise.all(users.map(findTransactionsByUser))

    for (const { name, count, amount } of deposits)
      info(`Deposited for ${name}: count=${count} sum=${amount}`)

    await findTransactionsByUnknownUsers()
    await findSmallestValidDeposit()
    await findLargestValidDeposit()
  }

  await fileToCollection(join(dataDirectory, 'transactions-1.json'))
  await fileToCollection(join(dataDirectory, 'transactions-2.json'))

  await findBalances()

  await mongoClient.close()

  trace('Bye bye!')
}

const sumFloat = (accumulator: number, currentValue: number) => accumulator + currentValue

const sumDecimal = (accumulator: Decimal, currentValue: number) =>
  accumulator instanceof Decimal
    ? accumulator.plus(currentValue)
    : new Decimal(accumulator).plus(currentValue)

const isDuplicateKeyError = (error: any) => error.code === 11000

main({
  mongoUrl: process.env.MONGO_URL,
  useDecimal: !!process.env.DECIMAL,
  verbose: !!process.env.VERBOSE,
  dataDirectory: process.env.DATA_DIR,
}).catch(console.error)
