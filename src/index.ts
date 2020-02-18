import { readFile as readFileCb } from 'fs'
import { promisify } from 'util'

import { MongoClient } from 'mongodb'

const readFile = promisify(readFileCb)

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017/kraken', { useUnifiedTopology: true })
  const dbConnection = await mongoClient.db()
  const collection1 = dbConnection.collection('listsinceblock1')
  const collection2 = dbConnection.collection('listsinceblock2')

  await collection1.createIndex({ txid: 1 }, { unique: true })
  await collection2.createIndex({ txid: 1 }, { unique: true })

  const file1 = JSON.parse(await readFile('./challenge/transactions-1.json', 'utf8'))

  console.log(`Adding ${file1.transactions.length} entries from transactions-1.json to DB...`)
  try {
    await collection1.insertMany(file1.transactions, { ordered: false })
  } catch (error) {
    if (!error.message.includes('E11000 duplicate key error'))
      throw error
    console.log(`Ignored ${error.writeErrors.length} duplicate entries.`)
  }

  await mongoClient.close()

  console.log('hello world')
}

main().catch(console.error)
