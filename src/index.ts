import { readFile as readFileCb } from 'fs'
import { promisify } from 'util'

import { MongoClient, Db } from 'mongodb'

const readFile = promisify(readFileCb)

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017/kraken', { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()

  await fileToCollection('./challenge/transactions-1.json', dbConnection, 'listsinceblock1')

  await mongoClient.close()

  console.log('Bye bye!')
}

async function fileToCollection(filePath: string, dbConnection: Db, collectionName: string) {
  const collection = dbConnection.collection(collectionName)
  await collection.createIndex({ txid: 1 }, { unique: true })

  const file = JSON.parse(await readFile(filePath, 'utf8'))

  console.log(`Adding ${file.transactions.length} entries from ${filePath} to DB.${collectionName}...`)
  try {
    await collection.insertMany(file.transactions, { ordered: false })
  } catch (error) {
    if (!error.message.includes('E11000 duplicate key error'))
      throw error
    console.log(`Ignored ${error.writeErrors.length} duplicate entries.`)
  }
}

main().catch(console.error)
