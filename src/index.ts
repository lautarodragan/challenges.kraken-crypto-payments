import { readFile as readFileCb } from 'fs'
import { promisify } from 'util'

import { MongoClient, Db } from 'mongodb'

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

function trace(...args: readonly unknown[]) {
  if (process.env.VERBOSE)
    console.log(...arguments)
}

function info(...args: readonly unknown[]) {
  console.log(...args)
}

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017/kraken', { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()

  await fileToCollection('./challenge/transactions-1.json', dbConnection, 'listsinceblock')
  await fileToCollection('./challenge/transactions-2.json', dbConnection, 'listsinceblock')

  await findBalances(dbConnection, 'listsinceblock')

  await mongoClient.close()

  trace('Bye bye!')
}

async function fileToCollection(filePath: string, dbConnection: Db, collectionName: string) {
  const collection = dbConnection.collection(collectionName)
  // await collection.createIndex({ blockhash: 1, txid: 1, vout: 1 }, { unique: true })

  const file = JSON.parse(await readFile(filePath, 'utf8'))

  trace(`Adding ${file.transactions.length} entries from ${filePath} to DB.${collectionName}...`)
  try {
    const writeResult = await collection.insertMany(file.transactions, { ordered: false })
    trace(`Added ${writeResult.result.n} entries.`)
  } catch (error) {
    if (!isDuplicateKeyError(error))
      return console.error('Unexpected error:', error)
    trace(`Added ${error.result.nInserted} entries. Ignored ${error.result.result.writeErrors.length} duplicate entries.`)
  }
}

async function findBalances(dbConnection: Db, collectionName: string) {
  const collection = dbConnection.collection(collectionName)

  const findTransactionsByUser = async ([username, address]: [string, string]) => {
    const transactions = await collection.find({ address, category: 'receive', confirmations: { $gte: 6 } }).toArray()
    const balanceToDeposit = transactions.reduce((accumulator: number, currentValue: any) => accumulator + currentValue.amount, 0)
    info(`Deposited for ${username}: count=${transactions.length} sum=${balanceToDeposit}`)
  }

  await Promise.all(Object.entries(users).map(findTransactionsByUser))
}

const isDuplicateKeyError = (error: any) => error.code === 11000

main().catch(console.error)
