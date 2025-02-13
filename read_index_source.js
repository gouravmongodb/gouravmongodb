const fs = require('fs');
const yaml = require('js-yaml');
const MongoClient = require('mongodb').MongoClient;

async function exportIndexes() {
  const config = yaml.load(fs.readFileSync('verifier_config_dev.yaml', 'utf8'));
  const url = config.myURIsource;
  const client = await MongoClient.connect(url, { useUnifiedTopology: true });
  const db = client.db(); // Connect to the default database or specify a database

  const databases = await client.db().admin().listDatabases();  // List all databases
  const allIndexes = {};

  for (let database of databases.databases) {
    const dbName = database.name;
    const collections = await client.db(dbName).listCollections().toArray(); // List all collections in the database
    allIndexes[dbName] = {};

    for (let collection of collections) {
      const collName = collection.name;
      const indexes = await client.db(dbName).collection(collName).indexes();
      allIndexes[dbName][collName] = indexes;
    }
  }

  // Save the index information to a JSON file
  fs.writeFileSync('indexes.json', JSON.stringify(allIndexes, null, 2));

  console.log('Indexes exported to indexes.json');
  await client.close();
}

exportIndexes().catch(console.error);
