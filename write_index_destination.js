const fs = require('fs');
const yaml = require('js-yaml');
const MongoClient = require('mongodb').MongoClient;

async function recreateIndexes() {
  const config = yaml.load(fs.readFileSync('verifier_config_stg.yaml', 'utf8'));
  const url = config.myURIdestination;
  const client = await MongoClient.connect(url, { useUnifiedTopology: true });
  
  // Read the saved JSON file containing index information
  const indexData = JSON.parse(fs.readFileSync('indexes.json', 'utf8'));

  for (let dbName in indexData) {
    const db = client.db(dbName);

    for (let collName in indexData[dbName]) {
      const indexes = indexData[dbName][collName];

      // Skip the default "_id_" index which exists by default in all collections
      const customIndexes = indexes.filter(index => index.name !== '_id_');

      for (let index of customIndexes) {
        try {
          await db.collection(collName).createIndex(index.key, index.options);
          console.log(`Index created for ${dbName}.${collName}`);
        } catch (err) {
          console.error(`Failed to create index for ${dbName}.${collName}:`, err);
        }
      }
    }
  }

  await client.close();
  console.log('Indexes recreated on the destination cluster.');
}

recreateIndexes().catch(console.error);
