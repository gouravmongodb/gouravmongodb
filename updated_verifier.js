// Install fs, js-yaml and crypto-js libraries before running.
// Run the script in a terminal: mongosh --nodb updated_verifier.js

// In case you get ssl certificate error: npm set strict-ssl false
// npm install js-yaml

// Data generation simulation software:
//https://github.com/schambon/SimRunner
(async function () {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const CryptoJS = require('crypto-js');
    const config = yaml.load(fs.readFileSync('verifier_config_stg.yaml', 'utf8'));
    let allTests = new Map();

    // Function to write log messages to a file
    function writeLog(message) {
        const logFilePath = 'verifier_msgs_stg.log';

        // Create or append to the log file
        fs.appendFile(logFilePath, `${message}\n`, (err) => {
            if (err) {
                console.error('Error writing to log file:', err);
            }
        });
    }

    // >>>>>>>>> MAKING CONNECTIONS: <<<<<<<<
    writeLog("TEST 0: MAKING CONNECTIONS TO SOURCE AND DESTINATION:")
    // Change the source connection string accordingly, example here Replica set of a cloud manager setup
    const myURIdestination = config.myURIdestination;
    // Change the destination connection string accordingly, example here Replica set of an atlas deployment
    const myURIsource = config.myURIsource;

    // Making the necessary connection to the source cluster
    let source = connect(myURIsource);
    let myURIsourceSanitized1 = myURIsource.replace(
        /(mongodb\+srv:\/\/)(.*?):(.*?)@/, // Regex to capture the connection string pattern
        '$1****:****@'                    // Replace username and password with ****
    );
	let myURIsourceSanitized = myURIsourceSanitized1.replace(
        /(mongodb:\/\/)(.*?):(.*?)@/, // Regex to capture the connection string pattern
        '$1****:****@'                    // Replace username and password with ****
    );
	
    allTests.set('Source Connection String', myURIsourceSanitized);
    writeLog('Source Connection String - ' + myURIsourceSanitized)
    // Check if the connection was successful to the source
    if (source) {
        allTests.set('Source Connection', 'Success');
        writeLog('Source Connection - Success')
    } else {
        allTests.set('Source Connection', 'Failed');
        writeLog('Source Connection - Failed')
    }

    // Making the necessary connection to the destination cluster
    let destination = connect(myURIdestination);
    let myURIdestinationSanitized1 = myURIdestination.replace(
        /(mongodb\+srv:\/\/)(.*?):(.*?)@/, // Regex to capture the connection string pattern
        '$1****:****@'                    // Replace username and password with ****
    );
	let myURIdestinationSanitized = myURIdestinationSanitized1.replace(
        /(mongodb:\/\/)(.*?):(.*?)@/, // Regex to capture the connection string pattern
        '$1****:****@'                    // Replace username and password with ****
    );
	
    writeLog('Destination Connection String - ' + myURIdestinationSanitized);
    allTests.set('Destination Connection String', myURIdestinationSanitized);
    // Check if the connection was successful to the destination
    if (source) {
        allTests.set('Destination Connection', 'Success');
        writeLog('Destination Connection - Success')
    } else {
        allTests.set('Destination Connection', 'Failed');
        writeLog('Destination Connection - Failed')
    }

    // >>>>>>>>> CHECKING ALL DBS: <<<<<<<<
    writeLog("")
    writeLog("TEST 1: CHECKING ALL DBS:")
    // Get all the names of databases in source
    let dbsSrc = source.getSiblingDB('admin').adminCommand('listDatabases').databases
    let dbsNamesSrc = [];
    // Print the database names in source
    dbsSrc.forEach(function (db) {
        if (['admin', 'local', 'config', 'mongosync_reserved_for_internal_use'].indexOf(db.name) === -1) {
            dbsNamesSrc.push(db.name);
        }
    });
    console.log("Database names in the source cluster other than (local, admin, config, mongosync_reserved_for_internal_use):");
    writeLog("Database names in the source cluster other than (local, admin, config, mongosync_reserved_for_internal_use):");
    dbsNamesSrc.sort();
    console.log(dbsNamesSrc);
    writeLog(dbsNamesSrc);

    // Get all the names of databases in destination
    let dbsDest = destination.getSiblingDB('admin').adminCommand('listDatabases').databases
    let dbsNamesDest = [];
    // Print the database names in destination
    console.log("Database names in the destination cluster other than (local, admin, config, mongosync_reserved_for_internal_use):");
    writeLog("Database names in the destination cluster other than (local, admin, config, mongosync_reserved_for_internal_use):");
    dbsDest.forEach(function (db) {
        if (['admin', 'local', 'config', 'mongosync_reserved_for_internal_use'].indexOf(db.name) === -1) {
            dbsNamesDest.push(db.name);
        }
    });
    dbsNamesDest.sort();
    console.log(dbsNamesDest);
    writeLog(dbsNamesDest);

    function areListsSame(listSrc, listDest, type) {
        // Check if the list of db-names in source and destination have the same length
        if (listSrc.length !== listDest.length) {
            console.log("Number of " + type + " in source and destination do not match...");
            writeLog("Number of " + type + " in source and destination do not match...")
            return false;
        }

        // Iterate over each element in the lists and compare them
        for (let i = 0; i < listSrc.length; i++) {
            // If any pair of elements is not equal, return false
            if (listSrc[i] !== listDest[i]) {
                console.log(type + " names in source and destination are different...");
                writeLog(type + " names in source and destination are different...")
                return false;
            }
        }
        console.log("All " + type + " names match at source and destination. Continue executing...");
        writeLog("All " + type + " names match at source and destination. Continue executing...");
        return true;
    }

    let testConditionDBs = areListsSame(dbsNamesSrc, dbsNamesDest, "DBs");
    if (testConditionDBs) {
        allTests.set('Test 1-DB', 'Success');
    } else {
        allTests.set('Test 1-DB', 'Failed');
        writeLog('Test 1-DB: Failed');
    }

    // >>>>>>>>> CHECKING ALL COLLECTIONS IN EACH ELIGIBLE DB: <<<<<<<<
    writeLog("")
    writeLog("TEST 2: CHECKING ALL COLLECTIONS IN EACH ELIGIBLE DB:")
    let testConditionCollections = []
    dbsNamesSrc.forEach(function (db) {
        let collNamesSrc = source.getSiblingDB(db).getCollectionNames().sort();
        let collNamesDest = destination.getSiblingDB(db).getCollectionNames().sort();
        console.log("Database: " + db,
            ", Coll names list in source: [" + collNamesSrc,
            "] Coll names list in destination: [" + collNamesDest + "]");
        writeLog("Database: " + db,
            ", Coll names list in source: [" + collNamesSrc,
            "] Coll names list in destination: [" + collNamesDest + "]");
        testConditionCollections.push(areListsSame(collNamesSrc, collNamesDest, "Collections"));
    });
    let breakLoop = false;
    for (let i = 0; i < testConditionCollections.length; i++) {
        if (testConditionCollections[i]) {
            allTests.set('Test 2-Collection', 'Success');
        } else {
            allTests.set('Test 2-Collection', 'Failed');
            breakLoop = true; // Set the flag to true if the condition fails
        }

        if (breakLoop) {
            writeLog('Test 2-Collection: Failed');
            break; // Exit the for loop
        }
    }

    // >>>>>>>>> CHECKING COUNTS OF DOCS IN EACH COLLECTION IN EACH ELIGIBLE DB: <<<<<<<<
    writeLog("")
    writeLog("TEST 3: CHECKING COUNTS OF DOCS IN EACH COLLECTION IN EACH ELIGIBLE DB:")

    // Function to test the count of documents in the source and destination for the collection of a DB requested
    function testCountDocs(source, destination, dbName, collName) {
        let colSrc = source.getSiblingDB(dbName).getCollection(collName);
        let colDest = destination.getSiblingDB(dbName).getCollection(collName);
        console.log("Testing the counts of documents for collection: " + collName + " in source and destination")
        console.log("Count of documents in collection:" + collName + " in source = " + colSrc.estimatedDocumentCount())
        console.log("Count of documents in collection:" + collName + " in destination = " + colDest.estimatedDocumentCount())

        writeLog("Testing the counts of documents for collection: " + collName + " in source and destination")
        writeLog("Count of documents in collection:" + collName + " in source = " + colSrc.estimatedDocumentCount())
        writeLog("Count of documents in collection:" + collName + " in destination = " + colDest.estimatedDocumentCount())

        let condition = colSrc.estimatedDocumentCount() === colDest.estimatedDocumentCount();

        if (!condition) {
            console.log("Count of documents do not match in source and destination for collection: " + collName)
            writeLog("Count of documents do not match in source and destination for collection: " + collName)
            return false;
        } else {
            console.log("Count of documents do match in source and destination for collection: " + collName +
                ". Continue executing...");
            writeLog("Count of documents do match in source and destination for collection: " + collName +
                ". Continue executing...");
            return true;
        }
    }

    // Call the test count documents function for each collection in eligible DB
    let testConditionCountDocs = []
    dbsNamesSrc.forEach(function (db) {
        let collNamesSrc = source.getSiblingDB(db).getCollectionNames().sort();
        collNamesSrc.forEach(function (collNameSrc) {
            console.log("Database: " + db);
            writeLog("Database: " + db);
            testConditionCountDocs.push(testCountDocs(source, destination, db, collNameSrc));
        });
    });
    breakLoop = false;
    for (let i = 0; i < testConditionCountDocs.length; i++) {
        if (testConditionCountDocs[i]) {
            allTests.set('Test 3-Count Documents', 'Success');
        } else {
            allTests.set('Test 3-Count Documents', 'Failed');
            breakLoop = true; // Set the flag to true if the condition fails
        }

        if (breakLoop) {
            writeLog('Test 3-Count Documents: Failed');
            break; // Exit the for loop
        }
    }

    // >>>>>>>>> CHECKING COUNTS OF INDEXES IN EACH COLLECTION IN EACH ELIGIBLE DB: <<<<<<<<
    writeLog("")
    writeLog("TEST 4: CHECKING COUNTS OF INDEXES IN EACH COLLECTION IN EACH ELIGIBLE DB:")

    function testIndex(source, destination, dbName, collName) {
        let colSrc = source.getSiblingDB(dbName).getCollection(collName);
        let colDest = destination.getSiblingDB(dbName).getCollection(collName);
        let countIndexSrc = colSrc.stats().nindexes
        let countIndexDest = colDest.stats().nindexes

        console.log("Testing the count of indexes for collection: " + collName + " in source and destination")
        console.log("Count of indexes in collection:" + collName + " in source = " + countIndexSrc)
        console.log("Count of indexes in collection:" + collName + " in destination = " + countIndexDest)

        writeLog("Testing the count of indexes for collection: " + collName + " in source and destination")
        writeLog("Count of indexes in collection:" + collName + " in source = " + countIndexSrc)
        writeLog("Count of indexes in collection:" + collName + " in destination = " + countIndexDest)

        let condition = countIndexSrc === countIndexDest;

        if (!condition) {
            console.log("Count of indexes do not match in source and destination for collection: " + collName)
            writeLog("Count of indexes do not match in source and destination for collection: " + collName)
            return false;
        } else {
            console.log("Count of indexes do match in source and destination for collection: " + collName +
                ". Continue executing...");
            writeLog("Count of indexes do match in source and destination for collection: " + collName +
                ". Continue executing...");
            return true;
        }
    }

    // Call the test index function for each collection in eligible DB
    let testConditionIndexCount = []
    dbsNamesSrc.forEach(function (db) {
        let collNamesSrc = source.getSiblingDB(db).getCollectionNames().sort();
        collNamesSrc.forEach(function (collNameSrc) {
            console.log("Database: " + db);
            writeLog("Database: " + db);
            testConditionIndexCount.push(testIndex(source, destination, db, collNameSrc));
        });
    });
    breakLoop = false;
    for (let i = 0; i < testConditionIndexCount.length; i++) {
        if (testConditionIndexCount[i]) {
            allTests.set('Test 4-Index Count', 'Success');
        } else {
            allTests.set('Test 4-Index Count', 'Failed');
            breakLoop = true; // Set the flag to true if the condition fails
        }

        if (breakLoop) {
            writeLog('Test 4-Index Count: Failed');
            break; // Exit the for loop
        }
    }

    // >>>>>>>>> CHECKING INDIVIDUAL INDEX OF EACH COLLECTION IN EACH ELIGIBLE DB: <<<<<<<<
    writeLog("")
    writeLog("TEST 5: CHECKING INDIVIDUAL INDEX OF EACH COLLECTION IN EACH ELIGIBLE DB:")

    function testIndividualIndex(source, destination, dbName, collName) {
        let colSrc = source.getSiblingDB(dbName).getCollection(collName);
        let colDest = destination.getSiblingDB(dbName).getCollection(collName);

        let indexesSrcObj = colSrc.getIndexes();
        let indexesDestObj = colDest.getIndexes();

        //Get index names in the source side
        let indexesSrc = []
        indexesSrcObj.forEach(function (index) {
            indexesSrc.push(index.name);
        });
        indexesSrc.sort();

        //Get index names in the destination side
        let indexesDest = []
        indexesDestObj.forEach(function (index) {
            indexesDest.push(index.name);
        });
        indexesDest.sort();

        console.log("Testing following indexes in source and destination: [" + indexesSrc + "]");
        writeLog("Testing following indexes in source and destination: [" + indexesSrc + "]");
        let testCondition = areListsSame(indexesSrc, indexesDest, "Indexes");
        if (testCondition === false) {
            console.log('Testing failed.')
            writeLog('Testing failed.')
            return false;
        }
        return true;
    }

    let testConditionIndexNames = []
    dbsNamesSrc.forEach(function (db) {
        let collNamesSrc = source.getSiblingDB(db).getCollectionNames().sort();
        console.log("Database: " + db);
        writeLog("Database: " + db);
        collNamesSrc.forEach(function (collNameSrc) {
            console.log("Collection: " + collNameSrc);
            writeLog("Collection: " + collNameSrc);
            testConditionIndexNames.push(testIndividualIndex(source, destination, db, collNameSrc));
        });
        console.log("");
    });

    breakLoop = false;
    for (let i = 0; i < testConditionIndexNames.length; i++) {
        if (testConditionIndexNames[i]) {
            allTests.set('Test 5-Index Names', 'Success');
        } else {
            allTests.set('Test 5-Index Names', 'Failed');
            breakLoop = true; // Set the flag to true if the condition fails
        }

        if (breakLoop) {
            writeLog('Test 5-Index Names: Failed');
            break; // Exit the for loop
        }
    }

    // >>>>>>>>> SAMPLING DOCS IN SOURCE AND DESTINATION: <<<<<<<<
    let sampleSizePercent = config.sampleSizePercent
	let batchSize = config.batchSize // Adjust batch size based on memory constraints
    writeLog("")
    writeLog("TEST 6: SAMPLING " + sampleSizePercent + "% OF DOCS IN SOURCE AND DESTINATION: ");
    //Logic/algorithm to test the equality of two docs in the source and destination:

    // Step 1, we use the hex values to compare the two documents in the source and destination for equality
    // (benefit very low processing time as value of the document is converted to hexadecimal binary value) to compare against.
    // In case the order of the keys remained intact then the values match then we do not need to proceed to step 2.

    // Step 2, in case the hex value does not match for the source and destination, we use my compareDocs fn which goes
    // inside the doc and compares values one by one (expensive process).

    // Benefit of this modified algo: This algo will work much faster than when we have only the compareDocs fn.
    // But its success lies on the fact as to “what is the percentage of times mongosync does not preserve the order of
    // keys in docs?”
    function calculateHash(document) {
        // Convert the document object to a JSON string
        const docString = JSON.stringify(document);

        // Calculate the MD5 hash
        return CryptoJS.MD5(docString).toString();
    }

    // Function to compare two objects
    function areDocsEqual(obj1, obj2) {
        // Get the keys of both objects
        var keys1 = Object.keys(obj1);
        var keys2 = Object.keys(obj2);

        // Check if the number of keys is the same
        if (keys1.length !== keys2.length) {
            writeLog(keys1.length + ", " + keys2.length + " do not match")
            return false;
        }

        // Iterate over the keys and compare the values
        for (var key of keys1) {

            if (obj1[key] instanceof Date) {
                obj1[key] = obj1[key].toString();
            }
            if (obj2[key] instanceof Date) {
                obj2[key] = obj2[key].toString();
            }


            // Check if both values are objects
            if ((typeof obj1[key] === 'object' && typeof obj2[key] === 'object') && (obj1[key] !== null && obj2[key] !== null)) {
                // If both values are arrays, compare them element by element
                if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
                    if (!arraysAreEqual(obj1[key], obj2[key])) {
                        writeLog("Arrays are not equal")
                        return false;
                    }
                } else { // Otherwise, recursively compare nested objects
                    if (!areDocsEqual(obj1[key], obj2[key])) {
                        writeLog("Docs do not match")
                        return false;
                    }
                }
            } else {
                if ((obj1[key] === null && obj2[key] === null) || (isNaN(obj1[key]) && isNaN(obj2[key]))) {
                    return true;
                } else {
                    try {
                        if (obj1[key] !== obj2[key]) {
                            writeLog("Error Point 1>> Object 1:" + obj1[key] + " do not match Object 2: " + obj2[key])
                            return false;
                        }
                    } catch (error) {
                        // Code to handle the error
                        console.error("An error occurred:", error.message); // Output: An error occurred: division by zero
                        if (obj1[key].toString() !== obj2[key].toString()) {
                            writeLog("Error Point 2>> Object 1:" + obj1[key].toString() + " do not match Object 2: " + obj2[key].toString())
                            return false;
                        }
                    }
                }
            }
        }

        // If all keys and values match, return true
        return true;
    }

    // Function to check if two arrays are equal
    function arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) {
            writeLog("Array length do no tmatch")
            return false;
        }
        for (var i = 0; i < arr1.length; i++) {
            if (arr1[i] instanceof Date) {
                arr1[i] = arr1[i].toString();
            }
            if (arr2[i] instanceof Date) {
                arr2[i] = arr2[i].toString();
            }

            if (typeof arr1[i] === 'object' && typeof arr2[i] === 'object') {
                // If both values are arrays, compare them element by element
                if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
                    if (!arraysAreEqual(arr1[i], arr2[i])) {
                        writeLog("Array length do no tmatch")
                        return false;
                    }
                } else { // Otherwise, recursively compare nested objects
                    if (!areDocsEqual(arr1[i], arr2[i])) {
                        writeLog("Docs do not match")
                        return false;
                    }
                }
            } else {
                if (arr1[i] !== arr2[i]) {
                    writeLog("Array elements do not match")
                    return false;
                }
            }
        }
        return true;
    }

    let testSampling = [];

    async function processSampling() {
        for (const db of dbsNamesDest) {
            let collNamesDest = destination.getSiblingDB(db).getCollectionNames().sort();
            console.log("Checking Database: " + db);
            writeLog("Checking Database: " + db);

            for (const collNameDest of collNamesDest) {
                console.log("Collection: " + collNameDest);
                writeLog("Collection: " + collNameDest);

                if (collNameDest === "system.views") {
                    writeLog("Skipping the Collection: " + collNameDest);
                    continue;
                }

                let collDestObj = destination.getSiblingDB(db).getCollection(collNameDest);
                let countDestDocs = collDestObj.estimatedDocumentCount();
                let sampleSize = Math.ceil(countDestDocs * (sampleSizePercent / 100.0));
                sampleSize = Math.min(sampleSize, countDestDocs);

                console.log(`Sampling ${sampleSize} documents from collection - Destination side: ${collNameDest}`);
                writeLog(`Sampling ${sampleSize} documents from collection - Destination side: ${collNameDest}`);

                // Use cursor to fetch documents in batches
                let cursor = collDestObj.aggregate([{$sample: {size: sampleSize}}]).batchSize(batchSize);

                while (await cursor.hasNext()) {
                    let docDest = await cursor.next();

                    try {
                        // Process each document one by one
                        let docSrc = await destination.getSiblingDB(db)
                            .getCollection(collNameDest)
                            .findOne({_id: docDest._id});

                        if (!docSrc) {
                            writeLog(`Document with _id - ${docDest._id} not found in db - ${db} collection - ${collNameDest}`);
                            continue;
                        }

                        let docSrcHash = calculateHash(docSrc);
                        let docDestHash = calculateHash(docDest);

                        if (docSrcHash === docDestHash) {
                            testSampling.push(true);
                            continue;
                        }

                        let result_docs_test = areDocsEqual(docSrc, docDest);
                        if (!result_docs_test) {
                            writeLog(`Match failed in db - ${db} collection - ${collNameDest} _id - ${docDest._id}`);
                        }
                        testSampling.push(result_docs_test);
                    } catch (error) {
                        console.error(`Error processing document in collection: ${collNameDest} db: ${db}`, error);
                    }
                }

                console.log(`Finished processing collection: ${collNameDest}`);
                writeLog(`Finished processing collection: ${collNameDest}`);
            }

            console.log(`Finished checking database: ${db}`);
            writeLog(`Finished checking database: ${db}`);
        }

        console.log(`Total results in testSampling: ${testSampling.length}`);
        return testSampling;
    }

    // Start processing
    await processSampling();

    console.log(testSampling.length)

    breakLoop = false;
    for (let i = 0; i < testSampling.length; i++) {
        if (testSampling[i]) {
            allTests.set('Test 6-Sampling', 'Success');
        } else {
            allTests.set('Test 6-Sampling', 'Failed');
            breakLoop = true; // Set the flag to true if the condition fails
        }

        if (breakLoop) {
            writeLog('Test 6-Sampling: Failed');
            break; // Exit the for loop
        }
    }

    // Loop through the Map and write to the log file
    allTests.forEach((value, key) => {
        const logMessage = `${key}: ${value}`;
        console.log(logMessage); // Print to console (optional)
        writeLog(logMessage);    // Write to log file
    });
})();

