// test-token-event.js
const admin = require("firebase-admin");
const {ethers} = require("ethers");

// Initialize with emulator connection
admin.initializeApp({projectId: "launch-pad-18192"});
const db = admin.firestore();
db.settings({
  host: "localhost:8080",
  ssl: false,
});

// Calculate the TokenRegistryOperation signature
const eventSignature = "TokenRegistryOperation(uint8,address,uint256,uint8)";
const TOKEN_REGISTRY_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(eventSignature)
);

// Use a real Ethereum address
const tokenAddress = "0x5deac602762362fe5f135fa5904351916053cf70";
// Convert address to bytes32 format (left-padded with zeros)
const tokenAddressBytes32 = "0x000000000000000000000000" + tokenAddress.slice(2);

// Sample data with the correct signature
const sampleEvent = {
  timestamp: new Date(),
  data: {
    event: {
      data: {
        logs: [
          {
            topics: [TOKEN_REGISTRY_OP_SIGNATURE, tokenAddressBytes32],
            data: "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000012",
            block: {
              number: 12345,
              timestamp: Math.floor(Date.now() / 1000),
            },
            transaction: {
              hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            },
            account: {
              address: "0x1234567890123456789012345678901234567890",
            },
          },
        ],
      },
    },
  },
};

// Write to the emulator's rawEvents collection
db.collection("rawEvents")
  .add(sampleEvent)
  .then((docRef) => {
    console.log("Test event created with ID:", docRef.id);
  })
  .catch((err) => {
    console.error("Error creating test event:", err);
  });
