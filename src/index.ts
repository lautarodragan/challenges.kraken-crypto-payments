import { Decimal } from 'decimal.js'
import { readFile as readFileCb } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

import { MongoClient } from 'mongodb'

const readFile = promisify(readFileCb)

const users = {
  'Wesley Crusher': 'mvd6qFeVkqH6MNAS2Y2cLifbdaX5XUkbZJ',
  'Leonard McCoy': 'mmFFG4jqAtw9MoCC88hw5FNfreQWuEHADp',
  'Jonathan Archer': 'mzzg8fvHXydKs8j9D2a8t7KpSXpGgAnk4n',
  'Jadzia Dax': '2N1SP7r92ZZJvYKG2oNtzPwYnzw62up7mTo',
  'Montgomery Scott': 'mutrAf4usv3HKNdpLwVD4ow2oLArL6Rez8',
  'James T. Kirk': 'miTHhiX3iFhVnAEecLjybxvV5g8mKYTtnM',
  'Spock': 'mvcyJMiAcSXKAEsQxbW9TYZ369rsMG6rVV',
}

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

    const findTransactionsByUser = async ([username, address]: [string, string]) => {
      const transactions = await collection.find({ address, category: 'receive', confirmations: { $gte: 6 } }).toArray()
      const balanceToDeposit = transactions.map(_ => _.amount).reduce(sum, 0)
      return {
        username,
        address,
        count: transactions.length,
        balanceToDeposit,
      }
    }

    const findTransactionsByUnknownUsers = async () => {
      const transactions = await collection.find({ address: { $not: { $in: Object.values(users) } }, category: 'receive', confirmations: { $gte: 6 } }).toArray()
      const balanceToDeposit = transactions.map(_ => _.amount).reduce(sum, 0)
      info(`Deposited without reference: count=${transactions.length} sum=${balanceToDeposit}`)
    }

    const findSmallestValidDeposit = async () => {
      const transaction = await collection.findOne({ category: 'receive', confirmations: { $gte: 6 } }, { sort: { amount: 1 } })
      info(`Smallest valid deposit: ${transaction.amount}`)
    }

    const findLargestValidDeposit = async () => {
      const transaction = await collection.findOne({ category: 'receive', confirmations: { $gte: 6 } }, { sort: { amount: -1 } })
      info(`Largest valid deposit: ${transaction.amount}`)
    }

    const deposits = await Promise.all(Object.entries(users).map(findTransactionsByUser))

    for (const { username, count, balanceToDeposit } of deposits)
      info(`Deposited for ${username}: count=${count} sum=${balanceToDeposit}`)

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
