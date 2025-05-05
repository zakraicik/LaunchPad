export const CAMPAIGN_EVENT_COLLECTOR_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_platformAdmin",
        type: "address",
      },
      {
        internalType: "address",
        name: "_owner",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "errCode",
        type: "uint8",
      },
      {
        internalType: "address",
        name: "addr",
        type: "address",
      },
    ],
    name: "CampaignEventCollectorError",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "NotAuthorizedAdmin",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bool",
        name: "status",
        type: "bool",
      },
      {
        indexed: true,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "AdminOverrideSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "opType",
        type: "uint8",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "targetAddress",
        type: "address",
      },
    ],
    name: "CampaignEventCollectorOperation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "oldStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "newStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "reason",
        type: "uint8",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "CampaignStatusChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "contributor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "Contribution",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
      {
        internalType: "bool",
        name: "status",
        type: "bool",
      },
    ],
    name: "setAdminOverride",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
      {
        internalType: "uint8",
        name: "newStatus",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "reason",
        type: "uint8",
      },
    ],
    name: "setCampaignStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "contributor",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "trackContribution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "contributor",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "trackRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "contributor",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "campaignId",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "campaignAddress",
        type: "address",
      },
    ],
    name: "trackFundsClaimed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
