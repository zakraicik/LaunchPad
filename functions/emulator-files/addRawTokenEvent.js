const admin = require('firebase-admin')
const fs = require('fs')

// Initialize Firebase with emulator settings
admin.initializeApp({
  projectId: 'launch-pad-18192'
})

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'

// Read the raw test data
const rawEvent = JSON.parse(fs.readFileSync('./rawTokenEvent.json', 'utf8'))

// Create the wrapped structure to match production
const wrappedEvent = {
  data: rawEvent,
  timestamp: admin.firestore.Timestamp.now() // This adds the server timestamp
}

// Add to Firestore
async function addTestData () {
  const db = admin.firestore()

  try {
    // Add the document with the wrapped structure
    const docRef = await db.collection('rawEvents').add(wrappedEvent)
    console.log('Document written with ID: test-event-1')
  } catch (error) {
    console.error('Error adding document:', error)
  } finally {
    process.exit(0)
  }
}

addTestData()
