const admin = require('firebase-admin')

// Initialize with emulator
admin.initializeApp({
  projectId: 'launch-pad-18192'
})

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const db = admin.firestore()

// Mock event data
const mockRawEvent = {
  timestamp: new Date('2025-03-29T15:47:43.896Z'),
  data: {
    event: {
      data: {
        block: {
          hash: '0x02b9dda34f6433ad4f815ccd3d364d1588bf92fb98ae5fa79098d42520909604',
          number: 23747487,
          timestamp: 1743263262
        },
        logs: [
          {
            account: {
              address: '0xbf99588b84cad40da4c7c46379be79651fa62f60'
            },
            data: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000012',
            index: 75,
            topics: [
              '0x182d4d874fd1e70e5b453811d53b80d9193e3bd36704cef2fe5da37175b46825',
              '0x0000000000000000000000001197766b82eee9c2e57674e53f0d961590e43769'
            ],
            transaction: {
              createdContract: null,
              cumulativeGasUsed: 2950267,
              effectiveGasPrice: '0xf43ba',
              from: {
                address: '0xbf8e22884d8d91434bc162ff6514f61dbd6fa67a'
              },
              gas: 131001,
              gasPrice: '0xf43ba',
              gasUsed: 129903,
              hash: '0xc5e44544f398d6ac8220fb1285fd55fe13e3d7f05f283d6cd1c2f1fa3b290613',
              index: 19,
              maxFeePerGas: '0xf441d',
              maxPriorityFeePerGas: '0xf4240',
              nonce: 33,
              status: 1,
              to: {
                address: '0xbf99588b84cad40da4c7c46379be79651fa62f60'
              },
              value: '0x0'
            }
          }
        ],
        network: 'BASE_SEPOLIA',
        sequenceNumber: '10000000060468190001'
      },
      id: 'whevt_h69lb8xa711mc2ym',
      type: 'GRAPHQL',
      webhookId: 'wh_twltupuxtebuz5r8'
    }
  }
}

// Add document to rawEvents collection
db.collection('rawEvents')
  .add(mockRawEvent)
  .then(docRef => {
    console.log('Document written with ID:', docRef.id)
    process.exit(0)
  })
  .catch(error => {
    console.error('Error adding document:', error)
    process.exit(1)
  })
