import { readFile as readFileCb } from 'fs'
import { promisify } from 'util'

import { MongoClient } from 'mongodb'

const readFile = promisify(readFileCb)

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017/kraken', { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()
  const collection1 = dbConnection.collection('listsinceblock1')

  await collection1.createIndex({ txid: 1 }, { unique: true })

  const file = JSON.parse(await readFile('./challenge/transactions-1.json', 'utf8'))

  try {
    await collection1.insertMany(file.transactions)
  } catch (error) {
    if (!error.message.includes('E11000 duplicate key error'))
      throw error
  }

  await mongoClient.close()

  console.log('hello world')
}

main().catch(console.error)
