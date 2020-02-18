import { MongoClient } from 'mongodb'

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://kraken:krakenPass@mongo:27017/kraken')
  const dbConnection = await mongoClient.db()
  const collection1 = dbConnection.collection('listsinceblock1')

  await collection1.insertOne({ hihi: true })

  await mongoClient.close()

  console.log('hello world')
}

main().catch(console.error)
