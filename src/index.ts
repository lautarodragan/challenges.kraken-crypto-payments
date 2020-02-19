import { readFile as readFileCb } from 'fs'
import { promisify } from 'util'

import { MongoClient, Db } from 'mongodb'

const readFile = promisify(readFileCb)

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017/kraken', { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()

  await fileToCollection('./challenge/transactions-1.json', dbConnection, 'listsinceblock1')
  await fileToCollection('./challenge/transactions-2.json', dbConnection, 'listsinceblock2')

  await mongoClient.close()

  console.log('Bye bye!')
}

async function fileToCollection(filePath: string, dbConnection: Db, collectionName: string) {
  const collection = dbConnection.collection(collectionName)
  await collection.createIndex({ blockhash: 1, txid: 1, vout: 1 }, { unique: true })

  const file = JSON.parse(await readFile(filePath, 'utf8'))

  console.log(`Adding ${file.transactions.length} entries from ${filePath} to DB.${collectionName}...`)
  try {
    const writeResult = await collection.insertMany(file.transactions, { ordered: false })
    console.log(`Added ${writeResult.result.n} entries.`)
  } catch (error) {
    if (!isDuplicateKeyError(error))
      return console.error('Unexpected error:', error)
    console.log(`Added ${error.result.nInserted} entries. Ignored ${error.result.result.writeErrors.length} duplicate entries.`)
  }
}

const isDuplicateKeyError = (error: any) => error.code === 11000

main().catch(console.error)
